"""Extract the creek-channel strokes drawn in the original MDWFP GeoPDF.

Joins only adjacent dash endpoints; never infers the channel from depth bands.
"""
from pathlib import Path
import sys
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / '.local/python').exists():
    sys.path.insert(0, str(ROOT / '.local/python'))

import numpy as np
import pdfplumber
from pypdf import PdfReader
from pyproj import CRS, Transformer
from shapely.geometry import LineString
from PIL import Image, ImageDraw

SOURCE = ROOT / 'percy-quin/sources/lake-tangipahoa-2016.pdf'
OUTPUT = ROOT / 'percy-quin/data/creek-channel.geojson'
REPORT = ROOT / 'percy-quin/sources/channel-extraction.json'
QA = ROOT / '.local/channel-qa'


def sample_curve(path):
    """Flatten source cubic curves with at most 0.02 PDF-point deviation."""
    points = [np.array(path[0][1], dtype=float)]

    def flatten(a, b, c, d):
        chord = LineString([a, d])
        if LineString([a, b, c, d]).hausdorff_distance(chord) <= .02:
            points.append(d)
            return
        ab, bc, cd = (a + b) / 2, (b + c) / 2, (c + d) / 2
        abc, bcd = (ab + bc) / 2, (bc + cd) / 2
        middle = (abc + bcd) / 2
        flatten(a, ab, abc, middle)
        flatten(middle, bcd, cd, d)

    for operation in path[1:]:
        assert operation[0] == 'c'
        flatten(points[-1], *[np.array(p, dtype=float) for p in operation[1:]])
    return np.array(points)


def main():
    page = PdfReader(SOURCE).pages[0]
    viewport = next(v for v in page['/VP'] if str(v['/Name']).rstrip('\0') == 'Lake')
    bbox = np.asarray(viewport['/BBox'], dtype=float)
    measure = viewport['/Measure']
    controls = np.asarray(measure['/LPTS'], dtype=float).reshape(-1, 2)
    geographic = np.asarray(measure['/GPTS'], dtype=float).reshape(-1, 2)
    crs = CRS.from_wkt(str(measure['/GCS']['/WKT']))
    to_projected = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    projected = np.column_stack(to_projected.transform(geographic[:, 1], geographic[:, 0]))
    matrix = np.column_stack([controls, np.ones(len(controls))])
    affine, _, _, _ = np.linalg.lstsq(matrix, projected, rcond=None)
    residual = np.linalg.norm(matrix @ affine - projected, axis=1).max()
    assert residual < 1
    to_wgs84 = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True, allow_ballpark=False)

    with pdfplumber.open(SOURCE) as pdf:
        p = pdf.pages[0]
        # The 77 channel dashes are white cubic paths. Legend dashes are straight
        # lines; roads are in the raster; label halos are polygonal paths.
        strokes = [o for o in p.curves if o['stroking_color'] == (1., 1., 1.)
                   and abs(o['linewidth'] - 1.91987) < .00001
                   and o['path'][0][0] == 'm'
                   and all(op[0] == 'c' for op in o['path'][1:])]
        assert len(strokes) == 77, 'Source channel strokes changed'
        sampled = [sample_curve(o['path']) for o in strokes]
        # Source paint order follows the channel from the dam north to the inlet.
        gaps = np.array([np.linalg.norm(b[0] - a[-1]) for a, b in zip(sampled, sampled[1:])])
        assert np.all((gaps > 3) & (gaps < 4.5)), 'Unexpected dash gap or ordering'
        points = np.concatenate(sampled)
        assert np.all((points[:, 0] > 350) & (points[:, 0] < 530))
        assert np.all((points[:, 1] > 40) & (points[:, 1] < 560))
        # pdfplumber uses top-down y; the PDF viewport uses bottom-up y.
        page_xy = np.column_stack([points[:, 0], float(p.height) - points[:, 1]])
        uv = (page_xy - bbox[:2]) / (bbox[2:] - bbox[:2])
        xy = np.column_stack([uv, np.ones(len(uv))]) @ affine
        lon, lat = to_wgs84.transform(xy[:, 0], xy[:, 1])
        coordinates = [[round(float(x), 7), round(float(y), 7)] for x, y in zip(lon, lat)]
        # Remove duplicate endpoints from zero-length source Bezier segments.
        coordinates = [c for i, c in enumerate(coordinates) if i == 0 or c != coordinates[i - 1]]
        assert all(-90.54 < x < -90.51 and 31.17 < y < 31.20 for x, y in coordinates)
        line = LineString(xy)
        assert line.is_simple and 2800 < line.length < 3400
        scale = np.linalg.norm(affine[:2] / (bbox[2:] - bbox[:2])[:, None], axis=1).max()

        metadata = {
            'source_url': 'https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf',
            'source_date': '2016-10', 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            'generated_by': 'scripts/extract-channel.py',
            'method': 'Extract 77 white cubic vector strokes; join consecutive dash endpoints with straight segments. No extrapolation beyond the published line.',
            'source_crs': crs.name, 'output_crs': 'EPSG:4326',
            'georeferencing': 'Main Lake viewport GPTS/LPTS; affine in embedded projected CRS, then transform to WGS84. Same method as depth contours.',
            'control_fit_max_residual_m': round(float(residual), 3),
            'source_strokes': len(strokes), 'joined_dash_gaps': len(gaps),
            'max_joined_dash_gap_m': round(float(gaps.max() * scale), 3),
            'curve_flattening_tolerance_pdf_pt': .02,
            'limitations': 'Historical mapped channel, not a current survey. Source positional accuracy and channel width are unspecified. Straight bridges across the printed dash gaps are approximate. This line does not indicate channel depth or navigable water.',
        }
        feature = {'type': 'Feature', 'properties': {
            'id': 'creek-channel-2016', 'name': 'Creek channel', 'source_date': '2016-10',
            'source': 'MDWFP Lake Tangipahoa depth map', 'length_m': round(line.length, 1),
        }, 'geometry': {'type': 'LineString', 'coordinates': coordinates}}
        OUTPUT.write_text(json.dumps({'type': 'FeatureCollection', 'name': 'Lake Tangipahoa historical creek channel',
                                     'metadata': metadata, 'features': [feature]}, separators=(',', ':')) + '\n', encoding='utf-8')
        report = {**metadata, 'vertices': len(coordinates), 'length_m': round(line.length, 1),
                  'endpoints_lonlat': [coordinates[0], coordinates[-1]],
                  'wgs84_transform': to_wgs84.get_last_used_operation().description}
        REPORT.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

        QA.mkdir(parents=True, exist_ok=True)
        # Independent PDF rendering with the extracted path overlaid for visual QA.
        rendered = p.to_image(resolution=144).original.convert('RGB')
        rendered.save(QA / 'source.png')
        overlay = rendered.copy()
        ImageDraw.Draw(overlay).line([tuple(v * 2) for v in points], fill='#ff00a8', width=2)
        overlay.save(QA / 'channel-overlay.png')
        print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
