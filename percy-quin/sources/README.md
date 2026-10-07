# MDWFP depth source and extraction

`lake-tangipahoa-2016.pdf` is the original [MDWFP Lake Tangipahoa depth map](https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf), downloaded October 7, 2026. It was exported from ArcMap on October 5, 2016 and is labeled "Updated Oct. 2016."

## What the line layer represents

The source has five colored depth bands: 0-4, 4-8, 8-12, 12-16, and 16-20 feet. Their internal boundaries supply contours at **4, 8, 12, and 16 feet**. A printed "20" near the dam does not define a separate 20-foot boundary; none was invented. The lake edge is not exported as a depth contour.

The source is a geospatial PDF. The main `Lake` viewport embeds four geographic control points and the NAD83(HARN) / Mississippi TM projected coordinate system. Its depth colors are stored as 15 lossless raster strips, independently of the overprinted labels and brush symbols.

## Reproduce

Install the extraction dependencies in a Python environment, then run:

```sh
python -m pip install -r scripts/requirements-contours.txt
python scripts/extract-contours.py
```

The script also supports this workspace's optional `.local/python` dependency directory. Python is used only to generate the GeoJSON; the website remains static.

1. Read the main viewport's ISO 32000 `/GPTS`, `/LPTS`, `/BBox`, and `/GCS` metadata.
2. Project the geographic control points into the embedded CRS and fit the affine transformation there. Transform output coordinates to WGS84, retaining correct longitude/latitude order.
3. Reassemble the raster strips according to their PDF placement matrices, including each strip's vertical flip. Verify that all 14 overlapping seam rows agree exactly.
4. Classify the five exact RGB depth colors. Extract shared edges between water pixels on opposite sides of each depth threshold. Roads, land, legends, and inset images do not create contour lines.
5. Merge connected edges into lines and simplify with a maximum 1.5-meter deviation. Retain every merged line, including small isolated depth features. Export 123 GeoJSON LineStrings (60 at 4 ft, 37 at 8 ft, 20 at 12 ft, 6 at 16 ft).

`contour-extraction.json` records the source hash, coordinate controls, transformation, raster dimensions, fit residuals, and output counts. QA images are generated under `.local/contour-qa/` and are excluded from publishing.

## Verification and limits

- Extracted linework was visually compared with the source's depth bands and original rendered PDF.
- The source shoreline was compared with the OpenStreetMap lake outline (way 585268743); it aligns with the main lake, while inlet and shoreline detail differ. This comparison was a registration check; the OSM outline was not used to move or reshape the contours.
- The finished overlay is also checked against satellite imagery in the Leaflet map.
- Embedded control-point fit residual is about 0.20 m and the exported raster cell size is about 1.24 m. These describe the export and registration, **not the accuracy of the depth survey**. Source survey accuracy and the water-surface reference are unspecified.
- These are historical mapped depth boundaries, with no interpolation between bands and no current-water-level adjustment. Current lake depth, shoreline, and bottom conditions can differ.

The PDF coordinate interpretation follows the [GDAL GeoPDF reader](https://github.com/OSGeo/gdal/blob/master/frmts/pdf/pdfdataset.cpp): interpret `/GPTS` latitude/longitude in the embedded CRS's geographic datum, then fit in projected coordinates. [Geospatial PDF documentation](https://gdal.org/en/stable/drivers/raster/pdf.html).

## Creek channel

`data/creek-channel.geojson` contains the historical channel shown by a dashed white line on the same October 2016 map. Run `python scripts/extract-channel.py` with the dependencies above to reproduce it.

The script extracts all 77 white cubic vector strokes forming the channel, excluding the straight legend dashes, polygonal label halos, and raster roads. It flattens the curves to a 0.02 PDF-point tolerance, checks the original south-to-north ordering, and joins the 76 printed dash gaps with straight segments. The largest gap is about 21.7 m. It does not extend either endpoint or derive a route from the depth bands. The same embedded georeferencing and datum transformation as the contours produce one 369-vertex LineString, about 3.17 km long.

`channel-extraction.json` records provenance, transformation, gap size, and endpoints. `.local/channel-qa/` contains a source rendering and the extracted line overlaid for comparison; the full route has been visually checked. The channel's route and gap bridges are approximate, with source positional accuracy and channel width unspecified. It represents the published 2016 route, not a current survey or a depth measurement.
