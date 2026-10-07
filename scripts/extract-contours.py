"""Generate smooth 2-foot contours from the MDWFP GeoPDF depth bands.

Intermediate 6/10/14-foot levels are estimates, not additional survey data.
Run from any directory; see percy-quin/sources/README.md for dependencies.
"""
from pathlib import Path
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]

import numpy as np
from PIL import Image, ImageDraw
from pypdf import PdfReader
from pyproj import CRS, Transformer
from shapely.geometry import MultiLineString, LineString
from shapely import line_merge
from scipy.ndimage import distance_transform_edt, gaussian_filter
from contourpy import contour_generator

SOURCE = ROOT / 'percy-quin/sources/lake-tangipahoa-2016.pdf'
OUTPUT = ROOT / 'percy-quin/data/depth-contours.geojson'
REPORT = ROOT / 'percy-quin/sources/contour-extraction.json'
QA = ROOT / '.local/contour-qa'
SOURCE_URL = 'https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf'
# Exact RGB colors in the embedded lossless raster, checked against the legend.
PALETTE = [(182, 237, 240), (116, 180, 232), (31, 131, 224), (29, 68, 184), (9, 9, 145)]
SIMPLIFY_METERS = 0.15
SMOOTH_SIGMA_METERS = 4.0
DEPTHS = list(range(4, 17, 2))
COLORS = ['#fff27b', '#ffc66b', '#ff934b', '#b8ed9e', '#5fffea', '#b5b4ff', '#fd79ff']


def contour_fields(classes, pixel_size_m):
    """Nested signed-distance fields; land is masked out of every output line.

    Extend the closest water class across land for filtering only, so the shore
    is not interpreted as a zero-depth contour. Signed distances of nested
    regions remain ordered after the same Gaussian filter. Their averages
    therefore place intermediate lines between adjacent smoothed boundaries.
    """
    water = classes >= 0
    nearest = distance_transform_edt(~water, return_distances=False, return_indices=True)
    filled = classes[tuple(nearest)]
    fields = {}
    for band in range(1, 5):
        deep = filled >= band
        signed = (distance_transform_edt(~deep, sampling=pixel_size_m[::-1]) -
                  distance_transform_edt(deep, sampling=pixel_size_m[::-1]))
        fields[band * 4] = gaussian_filter(signed, sigma=SMOOTH_SIGMA_METERS / pixel_size_m[::-1])
    for lower in (4, 8, 12):
        assert np.all(fields[lower] <= fields[lower + 4] + 1e-8), 'Depth fields must remain nested'
        fields[lower + 2] = (fields[lower] + fields[lower + 4]) / 2
    return fields


def main():
    reader = PdfReader(SOURCE)
    page = reader.pages[0]
    viewport = next(v for v in page['/VP'] if str(v['/Name']).rstrip('\0') == 'Lake')
    bbox = np.asarray(viewport['/BBox'], dtype=float)
    measure = viewport['/Measure']
    local_controls = np.asarray(measure['/LPTS'], dtype=float).reshape(-1, 2)
    geographic_controls = np.asarray(measure['/GPTS'], dtype=float).reshape(-1, 2)
    source_crs = CRS.from_wkt(str(measure['/GCS']['/WKT']))
    # ISO 32000 GPTS pairs are latitude,longitude in GCS's geographic datum.
    to_projected = Transformer.from_crs(source_crs.geodetic_crs, source_crs, always_xy=True)
    projected = np.column_stack(to_projected.transform(geographic_controls[:, 1], geographic_controls[:, 0]))
    matrix = np.column_stack([local_controls, np.ones(len(local_controls))])
    affine, _, _, _ = np.linalg.lstsq(matrix, projected, rcond=None)
    residuals = np.linalg.norm(matrix @ affine - projected, axis=1)
    assert residuals.max() < 1, 'Unexpected embedded georeferencing residual'
    to_wgs84 = Transformer.from_crs(source_crs, 'EPSG:4326', always_xy=True, allow_ballpark=False)

    image_matrices = {}
    def record_image(operator, args, ctm, text_matrix):
        if operator == b'Do':
            image_matrices[str(args[0]).lstrip('/')] = list(ctm)
    page.extract_text(visitor_operand_before=record_image)
    stripes = []
    for image in page.images:
        name = image.name.split('.')[0]
        ctm = image_matrices[name]
        # Select only the raster spanning the main map, excluding inset imagery.
        if abs(ctm[0] - (bbox[2] - bbox[0])) > .001:
            continue
        assert ctm[1] == ctm[2] == 0 and ctm[0] > 0 and ctm[3] < 0
        stripes.append((ctm, np.asarray(image.image.convert('RGB'))[::-1]))
    stripes.sort(key=lambda item: -item[0][5])
    assert len(stripes) == 15
    first_ctm, first_pixels = stripes[0]
    pixel_width = first_ctm[0] / first_pixels.shape[1]
    pixel_height = -first_ctm[3] / first_pixels.shape[0]
    offsets = [round((first_ctm[5] - ctm[5]) / pixel_height) for ctm, _ in stripes]
    height = max(y + arr.shape[0] for y, (_, arr) in zip(offsets, stripes))
    width = first_pixels.shape[1]
    raster = np.zeros((height, width, 3), dtype=np.uint8)
    written = np.zeros(height, dtype=bool)
    overlap_rows = 0
    for y, (ctm, arr) in zip(offsets, stripes):
        assert arr.shape[1] == width
        assert abs(ctm[4] - first_ctm[4]) < .001
        assert abs(-ctm[3] / arr.shape[0] - pixel_height) < .000001
        overlap = written[y:y + len(arr)]
        if overlap.any():
            assert np.array_equal(raster[y:y + len(arr)][overlap], arr[overlap]), 'Raster seam does not match'
            overlap_rows += int(overlap.sum())
        raster[y:y + len(arr)] = arr
        written[y:y + len(arr)] = True
    assert written.all(), 'Missing raster rows'

    classes = np.full((height, width), -1, dtype=np.int8)
    for i, color in enumerate(PALETTE):
        classes[np.all(raster == color, axis=2)] = i
    assert all(np.any(classes == i) for i in range(5))

    def pixel_to_projected(points):
        points = np.asarray(points, dtype=float)
        page_x = first_ctm[4] + points[:, 0] * pixel_width
        page_y = first_ctm[5] - points[:, 1] * pixel_height
        u = (page_x - bbox[0]) / (bbox[2] - bbox[0])
        v = (page_y - bbox[1]) / (bbox[3] - bbox[1])
        return np.column_stack([u, v, np.ones(len(points))]) @ affine

    def boundaries(threshold):
        # Edges only between water pixels. A water/land edge is NOT a depth contour.
        left, right = classes[:, :-1], classes[:, 1:]
        mask = (left >= 0) & (right >= 0) & ((left >= threshold) != (right >= threshold))
        rows, cols = np.nonzero(mask)
        vertical = np.stack([np.column_stack([cols + 1, rows]), np.column_stack([cols + 1, rows + 1])], axis=1)
        top, bottom = classes[:-1, :], classes[1:, :]
        mask = (top >= 0) & (bottom >= 0) & ((top >= threshold) != (bottom >= threshold))
        rows, cols = np.nonzero(mask)
        horizontal = np.stack([np.column_stack([cols, rows + 1]), np.column_stack([cols + 1, rows + 1])], axis=1)
        segments = np.concatenate([vertical, horizontal])
        merged = line_merge(MultiLineString(segments.tolist()))
        lines = list(merged.geoms) if merged.geom_type == 'MultiLineString' else [merged]
        return sorted(lines, key=lambda line: (-line.length, line.bounds)), len(segments)

    QA.mkdir(parents=True, exist_ok=True)
    Image.fromarray(raster).save(QA / 'source-bands.png')
    overlay = Image.fromarray(raster)
    draw = ImageDraw.Draw(overlay)
    pixel_size_m = np.linalg.norm(pixel_to_projected([[0, 0], [1, 0], [0, 1]])[1:] - pixel_to_projected([[0, 0]]), axis=1)
    fields = contour_fields(classes, pixel_size_m)
    features = []
    stats = []
    for depth in DEPTHS:
        estimated = depth % 4 != 0
        generator = contour_generator(
            x=np.arange(width) + .5, y=np.arange(height) + .5,
            z=np.ma.array(fields[depth], mask=classes < 0), corner_mask=False,
        )
        lines = sorted((LineString(points) for points in generator.lines(0)), key=lambda line: (-line.length, line.bounds))
        points_before = points_after = 0
        for index, pixel_line in enumerate(lines, 1):
            projected_line = LineString(pixel_to_projected(pixel_line.coords))
            simplified = projected_line.simplify(SIMPLIFY_METERS, preserve_topology=True)
            deviation = projected_line.hausdorff_distance(simplified)
            assert deviation <= SIMPLIFY_METERS + .000001
            coords = np.asarray(simplified.coords)
            lon, lat = to_wgs84.transform(coords[:, 0], coords[:, 1])
            coordinates = [[round(float(x), 7), round(float(y), 7)] for x, y in zip(lon, lat)]
            assert all(-90.54 < x < -90.51 and 31.17 < y < 31.20 for x, y in coordinates)
            assert simplified.is_valid and simplified.is_simple and len(coordinates) >= 2
            # GeoJSON rounding must not collapse a very short fragment.
            if len({tuple(p) for p in coordinates}) < 2:
                continue
            points_before += len(projected_line.coords)
            points_after += len(coordinates)
            features.append({
                'type': 'Feature',
                'properties': {
                    'id': f'depth-{depth}-{index:03d}', 'depth_ft': depth,
                    'estimated': estimated,
                    'length_m': round(simplified.length, 1), 'source_date': '2016-10',
                    'source': 'MDWFP Lake Tangipahoa depth map',
                    'method': ('Estimated midpoint between adjacent smoothed published depth boundaries' if estimated
                               else 'Published depth-band boundary, smoothed using a signed-distance field'),
                },
                'geometry': {'type': 'LineString', 'coordinates': coordinates},
            })
            draw.line(list(pixel_line.coords), fill=COLORS[DEPTHS.index(depth)], width=2 if estimated else 3)
        level_stats = {'depth_ft': depth, 'estimated': estimated,
                       'features': sum(f['properties']['depth_ft'] == depth for f in features),
                       'vertices_before': points_before, 'vertices_after': points_after}
        if not estimated:
            original, edge_count = boundaries(depth // 4)
            source_lines = MultiLineString([pixel_to_projected(line.coords) for line in original])
            smoothed_lines = MultiLineString([pixel_to_projected(line.coords) for line in lines])
            level_stats.update(source_features=len(original), raster_edges=edge_count,
                               source_hausdorff_distance_m=round(source_lines.hausdorff_distance(smoothed_lines), 3))
        stats.append(level_stats)

    metadata = {
        'source_url': SOURCE_URL, 'source_date': '2016-10',
        'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'generated_by': 'scripts/extract-contours.py',
        'depth_unit': 'feet', 'contours_ft': DEPTHS,
        'published_contours_ft': [4, 8, 12, 16], 'estimated_contours_ft': [6, 10, 14],
        'method': 'Gaussian-smoothed signed distances to nested depth bands; intermediate levels are zero contours of averaged adjacent fields. Land is masked; no extrapolation beyond 16 ft.',
        'source_crs': source_crs.name, 'output_crs': 'EPSG:4326',
        'georeferencing': 'Main Lake viewport ISO 32000 GPTS/LPTS; least-squares affine in the embedded projected CRS, then datum transformation to WGS84.',
        'source_raster_pixel_size_m': [round(float(v), 3) for v in pixel_size_m],
        'control_fit_max_residual_m': round(float(residuals.max()), 3),
        'simplification_tolerance_m': SIMPLIFY_METERS,
        'smoothing_sigma_m': SMOOTH_SIGMA_METERS,
        'limitations': 'Historical 2016 depth bands, smoothed for display. 6, 10 and 14 ft lines are distance-based estimates, not surveyed depths. Smoothing may remove small features and shift lines. Source survey accuracy and water-surface datum are unspecified. No 18 or 20 ft contours: the source has no 20 ft boundary to support interpolation.',
    }
    OUTPUT.write_text(json.dumps({'type': 'FeatureCollection', 'name': 'Lake Tangipahoa smoothed and estimated depth contours', 'metadata': metadata, 'features': features}, separators=(',', ':')) + '\n', encoding='utf-8')
    report = {
        **metadata,
        'viewport_bbox_pdf': bbox.tolist(), 'control_lpts': local_controls.tolist(),
        'control_gpts_latlon': geographic_controls.tolist(), 'source_crs_wkt': measure['/GCS']['/WKT'],
        'projected_affine': affine.tolist(), 'wgs84_transform': to_wgs84.get_last_used_operation().description,
        'raster_size': [width, height], 'source_stripes': len(stripes), 'verified_overlap_rows': overlap_rows,
        'water_pixel_counts': {f'{i * 4}-{(i + 1) * 4}': int(np.sum(classes == i)) for i in range(5)},
        'contours': stats,
        'feature_count': len(features), 'geojson_bytes': OUTPUT.stat().st_size,
    }
    REPORT.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    overlay.save(QA / 'bands-with-extracted-lines.png')
    print(json.dumps({k: report[k] for k in ['source_crs', 'wgs84_transform', 'source_raster_pixel_size_m', 'control_fit_max_residual_m', 'contours', 'feature_count', 'geojson_bytes']}, indent=2))


if __name__ == '__main__':
    main()
