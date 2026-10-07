# Lake Tangipahoa

Percy Quin State Park, Pike County, Mississippi.

## Map data

| Layer | Content | Source date |
| --- | --- | --- |
| [Fish attractors](data/fish-attractors.geojson) | 26 published coordinate pairs | Installed January 2016 |
| [Depth contours](data/depth-contours.geojson) | Smoothed contours every 2 feet from 4–16 feet; 6, 10, and 14 ft are estimates | Map updated October 2016 |
| [Creek channel](data/creek-channel.geojson) | Historical channel traced from the source map's vector strokes | Map updated October 2016 |
| [Aerial imagery](sources/imagery.md) | USDA NAIP photography from MARIS, with Esri imagery and OpenStreetMap alternatives | NAIP acquisition: 2025 |

## Data notes

Attractor IDs follow the published coordinate table in row order, left to right; they are local map IDs, not official MDWFP identifiers. Coordinates use WGS84 longitude/latitude. The source table does not specify a datum, so that interpretation is an assumption. Structure condition is unverified.

The 4, 8, 12, and 16 ft contours are smoothed boundaries between the source map's colored depth bands. Dashed 6, 10, and 14 ft contours are distance-based estimates between adjacent boundaries, not additional surveyed depths. Smoothing can shift boundaries and remove small features. The map has no separate 20-foot boundary, so no 18 or 20 ft lines are generated. Contours and the creek channel are historical and are not adjusted for current water level or changes to the lake bottom.

The original depth map, extraction methods, coordinate transformations, and accuracy limits are documented in the [source notes](sources/README.md).

## Sources

- [MDWFP Lake Tangipahoa information and attractor coordinates](https://www.mdwfp.com/fishing-boating/lakes/lake-tangipahoa-percy-quin-state-park)
- [MDWFP Lake Tangipahoa depth map](https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf)
- [MDWFP Percy Quin State Park](https://www.mdwfp.com/parks-destinations/park/percy-quin-state-park)
- [Imagery sources and acquisition dates](sources/imagery.md)
