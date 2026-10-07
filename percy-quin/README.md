# Lake Tangipahoa

Percy Quin State Park, Pike County, Mississippi. First location in the fishing maps project.

## Source register

Sources identified on October 7, 2026.

| Source | Available content | Date and status |
| --- | --- | --- |
| [MDWFP lake depth map](https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf) | Four-foot depth bands through 16–20 feet, creek channel, brushtops, piers, boat ramp, and access road. | October 2016 GeoPDF downloaded, rendered, and inspected. Depth-band boundaries extracted using embedded georeferencing. See [extraction notes](sources/README.md). |
| [MDWFP Lake Tangipahoa page](https://www.mdwfp.com/fishing-boating/lakes/lake-tangipahoa-percy-quin-state-park) | Lake overview and published GPS coordinates for fish attractors installed in January 2016. | Historical attractor locations; present condition is unverified. Indexed page reviewed; direct retrieval failed. |
| [MDWFP Percy Quin State Park page](https://www.mdwfp.com/parks-destinations/park/percy-quin-state-park) | Park access, boat launch, marina, and facilities. | Source identified; exact feature positions remain to be verified. |
| [MDWFP lake depth map index](https://www.mdwfp.com/fishing-boating/lake-depth-maps) | Official directory of lake depth maps, including Percy Quin. | Useful for locating replacement or updated source files. |

## Initial map layers

- Shoreline and lake outline from a documented geographic source.
- Depth contours and creek channel from the official depth map, with source date shown.
- Published fish-attractor locations, with installation date shown.
- Verified boat launch, piers, and access points.
- Optional fishing observations, labeled separately from source data.

## Current implementation

The root `index.html` is a Leaflet map intended for GitHub Pages and phone use on the lake. It defaults to 2025 USDA NAIP aerial imagery from MARIS, with Esri imagery and OpenStreetMap alternatives, opt-in live location with accuracy and follow controls, and 26 published fish-attractor points from January 2016. The attractor overlay can be toggled; markers show coordinates and a source link. See [imagery sources](sources/imagery.md).

`data/fish-attractors.geojson` stores longitude/latitude coordinates and provenance. IDs follow the published table row by row, left to right; they are not official MDWFP identifiers. The source does not specify a coordinate datum, so interpreting its decimal degrees as WGS84 is an assumption. Present structure conditions are unverified.

## Remaining mapping work

1. Verify access-point locations and preserve source metadata with each layer.

The depth layer contains 123 line features at 4, 8, 12, and 16 feet. All contours are shown by default; bank-fishing mode keeps the 4 and 8 ft levels. Current water level is not accounted for. The original PDF is archived and linked from the map.

The creek channel is a separate, default-on white dashed overlay with its own toggle and source popup. `data/creek-channel.geojson` was extracted from the PDF's 77 vector channel strokes using the same georeferencing as the contours. The 2016 route is approximate; see the [extraction notes](sources/README.md#creek-channel). Access-point overlays remain pending.
