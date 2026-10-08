# Fishing Maps

Interactive fishing maps for exploring lake depths, finding fish attractors, and measuring distances on a phone or computer. Currently featuring [Lake Tangipahoa at Percy Quin State Park, Mississippi](percy-quin/README.md).

## Features

- 2025 aerial imagery, with Esri imagery and OpenStreetMap alternatives.
- Current location, accuracy radius, and optional map following.
- Smooth depth contours every 2 feet from 4–16 feet; bank-fishing mode shows 4, 6, and 8 feet. Dashed 6, 10, and 14 ft lines are interpolated estimates.
- Historical creek channel and fish-attractor locations.
- Straight-line measurements in feet with draggable endpoints.

## Map controls

- **Lake Tangipahoa / basemap badge** at the top left: select 2025 aerial imagery, Esri imagery, or the street map directly on the map. The sidebar also includes basemap and fishing-overlay controls.
- **Location icon**: enable location or resume following after panning; **Stop** in the location status ends tracking.
- **Ruler icon**: turn measurement on, tap two points, then drag **A** or **B** to adjust. Distance appears on the line; tapping the ruler again clears it and exits. Escape also exits.
- **Zoom-out icon**: return to the whole-lake overview.
- **Hamburger icon**: open or close the sidebar for map layers, sources, and instructions. On phones the sidebar opens as a drawer; close it with its X button or Escape.

Location requires HTTPS and browser permission. Location fixes and measurements are not saved or uploaded. Internet access is required for imagery; offline maps are not included.

## Data

Depth contours, the creek channel, and fish-attractor locations come from 2016 publications by the Mississippi Department of Wildlife, Fisheries, and Parks (MDWFP). Current water levels and underwater structure may differ. Sources and data limitations are documented in the [lake data notes](percy-quin/README.md).
