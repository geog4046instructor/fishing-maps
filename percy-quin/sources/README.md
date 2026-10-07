# MDWFP depth map and extraction

[lake-tangipahoa-2016.pdf](lake-tangipahoa-2016.pdf) is the original [MDWFP Lake Tangipahoa depth map](https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf), archived October 7, 2026. It was exported from ArcMap on October 5, 2016 and is labeled "Updated Oct. 2016."

## Reproduction

Install the Python dependencies and run the extraction scripts from the repository root:

```sh
python -m pip install -r scripts/requirements-contours.txt
python scripts/extract-contours.py
python scripts/extract-channel.py
python -m unittest discover -s tests -p test_contours.py
```

The scripts write GeoJSON to `percy-quin/data/` and extraction reports to `percy-quin/sources/`. Diagnostic images are written to the Git-ignored `.local/` directory. Python is not required to serve the website.

## Georeferencing

The PDF's main `Lake` viewport embeds four geographic control points and the NAD83(HARN) / Mississippi TM coordinate system. Both scripts fit an affine transformation in that projected system, then transform coordinates to WGS84 longitude/latitude.

The interpretation of `/GPTS`, `/LPTS`, `/BBox`, and `/GCS` follows the [GDAL GeoPDF reader](https://github.com/OSGeo/gdal/blob/master/frmts/pdf/pdfdataset.cpp) and [geospatial PDF documentation](https://gdal.org/en/stable/drivers/raster/pdf.html).

## Depth contours

The source contains five colored depth bands: 0–4, 4–8, 8–12, 12–16, and 16–20 feet. Their internal boundaries provide contours at 4, 8, 12, and 16 feet. The printed "20" near the dam has no corresponding band boundary. The lake edge is excluded from the contour layer.

The extraction assembles 15 lossless raster strips using their PDF placement matrices and verifies all 14 overlapping seams. It classifies the five depth colors, computes signed distance fields for the four nested depth thresholds, and applies a Gaussian filter with a 4 m standard deviation. The closest water class is extended over land only during filtering, to avoid treating the shoreline as a depth boundary. All exported lines are masked to known water pixels.

Zero contours of the smoothed fields give the 4, 8, 12, and 16 ft lines. Averaging adjacent signed-distance fields gives estimated midpoint contours at 6, 10, and 14 ft. The fields stay ordered, keeping intermediate contours between adjacent levels. This assumes distance-based depth transitions; it does not recover additional survey measurements. No 18 or 20 ft lines are extrapolated. The UI uses dashed strokes and explicit estimate labels for the intermediate levels, and each GeoJSON feature carries an `estimated` flag.

Marching-square output is simplified by at most 0.15 m to reduce file size. Smoothing rounds raster stair steps and may shrink, split, or remove small features. [contour-extraction.json](contour-extraction.json) records the source hash, control points, transformation, raster dimensions, smoothing settings, output counts, and Hausdorff distances to the original boundaries. Those distances include removed isolated features and are not estimates of positional accuracy.

## Creek channel

The channel is extracted from the PDF's 77 white cubic vector strokes. Curves are flattened to a tolerance of 0.02 PDF points. Consecutive dash endpoints are joined with straight segments; the largest gap is approximately 21.7 meters. The line is not extended beyond the source endpoints.

The output is one 369-vertex LineString approximately 3.17 km long. [channel-extraction.json](channel-extraction.json) records the source hash, transformation, gap sizes, and endpoints.

## Accuracy and limitations

- The control-point fit residual is approximately 0.20 m and the source raster cell size is approximately 1.24 m. These describe registration and raster resolution, not depth-survey accuracy.
- Source survey accuracy, water-surface datum, and channel width are unspecified.
- Intermediate 6, 10, and 14 ft depths are interpolated estimates. No depths are adjusted for current water level.
- Straight segments across the channel's printed dash gaps are approximations.
- The layers represent the published 2016 map; present shoreline and bottom conditions may differ.
