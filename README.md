# Fishing Maps

Mobile-friendly fishing maps built with Leaflet. The first location is [Lake Tangipahoa at Percy Quin State Park, Mississippi](percy-quin/README.md).

## Features

- 2025 aerial imagery, with Esri imagery and OpenStreetMap alternatives.
- Current location, accuracy radius, and optional map following.
- Smooth depth contours every 2 feet from 4–16 feet; bank-fishing mode shows 4, 6, and 8 feet. Dashed 6, 10, and 14 ft lines are interpolated estimates.
- Historical creek channel and fish-attractor locations.
- Straight-line measurements in feet with draggable endpoints.

## Map controls

- **Layers**: select a basemap and toggle fishing overlays.
- **Locate me**: enable location. **Recenter me** resumes following after panning; **Stop** ends location tracking.
- **Measure**: tap a start and end point, then drag **A** or **B** to adjust. **Clear** resets the line; **Done** exits.
- **Whole lake**: return to the lake overview.

Location requires HTTPS and browser permission. Location fixes and measurements are not saved or uploaded. Internet access is required for imagery; offline maps are not included.

## Data

Depth contours, the creek channel, and fish-attractor locations come from MDWFP's 2016 publications. Current water levels and underwater structure may differ. Source dates, coordinate assumptions, and extraction methods are documented in the [lake data notes](percy-quin/README.md).

## Development

The site uses static HTML, CSS, JavaScript, and GeoJSON, with no build step or backend. GitHub Pages can serve the repository root.

With Node.js installed, run `node scripts/serve.mjs` to serve the site on port 8080. Run `node --test tests/*.test.js` for the automated tests.

Python is needed only to regenerate the map data; see the [extraction documentation](percy-quin/sources/README.md).
