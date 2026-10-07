# Fishing maps

Static Leaflet fishing maps, hosted on GitHub Pages and organized by water body. Plain HTML, CSS, JavaScript, and GeoJSON; no build step, API key, or backend.

## First location

[Lake Tangipahoa, Percy Quin State Park, Mississippi](percy-quin/README.md)

## Mapping conventions

- Keep source URLs and publication dates with each location.
- Distinguish documented depths and structure from inferred fishing areas and personal observations.
- Label historical data with its date; do not present it as a current survey.
- Keep original source material separate from generated maps.

## Run locally

With Node.js installed, run from this directory:

```sh
node scripts/serve.mjs
```

Open <http://127.0.0.1:8080>. Use a local HTTP server instead of opening `index.html` directly, because the map fetches GeoJSON. The optional `PORT` environment variable changes the preview port.

## Publish on GitHub Pages

The working source lives in `D:\fishing-maps`. The static site is also copied to `C:\sites\www\fishing-maps` for the existing WSL web server at <http://localhost/fishing-maps/>. After source changes, copy `index.html`, `.nojekyll`, `assets/`, `percy-quin/data/`, and `percy-quin/sources/lake-tangipahoa-2016.pdf` into that serving directory again.

1. Add these files to your GitHub repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, your publishing branch (usually `main`), and **/(root)**.
4. Save, then open the site URL reported by GitHub.

All application paths are relative, so the map works under `https://<username>.github.io/<repository>/`. The `.nojekyll` file disables Jekyll processing. The local preview server is not used on GitHub.

[GitHub Pages setup documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## Files

- `index.html`: Lake Tangipahoa map page.
- `assets/map.js`: Leaflet map, layer toggle, attractor selection, and popups.
- `assets/location.js`: Opt-in location watch, follow state, permission errors, and fix freshness.
- `assets/depth.js`: Depth line rendering, labels, popups, and all/bank contour modes.
- `assets/channel.js`: Historical creek-channel overlay, toggle, and source popup.
- `assets/basemaps.js`: 2025 aerial imagery, source descriptions, and Web Mercator image requests.
- `assets/measure.js`: Temporary two-point measurements with draggable endpoints and feet readouts.
- `assets/styles.css`: Desktop and mobile layout.
- `percy-quin/data/fish-attractors.geojson`: Published points with source metadata.
- `percy-quin/data/depth-contours.geojson`: 123 lines at 4, 8, 12, and 16 feet from the official georeferenced PDF.
- `percy-quin/data/creek-channel.geojson`: Historical channel extracted from the original PDF's vector strokes.
- `percy-quin/sources/`: Archived source PDF and reproducible extraction metadata.
- `percy-quin/README.md`: Lake sources and remaining mapping work.

## Use on a phone

The default basemap is **2025 aerial · 30 cm**, USDA NAIP photography served by Mississippi MARIS. **Layers → Basemap** also offers the previous Esri imagery and OpenStreetMap. The imagery year is visible on the map; details and a source link appear below the selector. The 2025 imagery has Mississippi coverage and some water glare. Its 30 cm pixel size is not a statement of GPS or map-position accuracy.

The creek channel is on by default as a white dashed line. Use **Layers → Show creek channel** to toggle it independently of contours and attractors. Tap the line for its October 2016 source date and original map. It shows the historical mapped route, with approximate bridges across the source's printed dash gaps.

Depth contours are on by default. In **Layers → Contour view**, choose all four levels or **Bank fishing** for just the 4 and 8 ft lines. Shallow lines are emphasized. The legend identifies each depth; labels appear as you zoom in, and tapping a line opens its depth and source date. Closely spaced contours indicate steeper bottom slope. The 2016 source contains no separate 20 ft boundary. See the [extraction notes](percy-quin/sources/README.md) for methods and limits.

- Open the HTTPS GitHub Pages URL in Chrome. The map fills the screen; **Layers** opens the basemap and attractor controls.
- **Measure** starts a single straight-line measurement. Tap the start and end, then drag **A** or **B** to adjust. The label updates in whole feet. **Clear** starts over; **Done** removes the line and exits. You can pan and zoom while measuring. GPS following pauses, and fishing-layer popups are suppressed until you finish. **Locate me / Recenter me** or choosing an attractor exits measurement. Measurements are temporary horizontal map distances, not predictions of casting range.
- With a keyboard, focus the map, pan with arrow keys, and press **Enter** to place each endpoint at the center. Tab to an endpoint and use arrow keys to adjust it (Shift moves farther); **Escape** exits.
- **Locate me** asks Chrome for location permission and starts a high-accuracy position watch. The blue dot is the reported position; the circle is its accuracy radius. Accuracy is also displayed in feet.
- The map follows incoming fixes. Dragging the map, selecting an attractor, or tapping **Whole lake** pauses following while position updates continue. **Recenter me** resumes following. **Stop** releases the watch and removes the location marker.
- Fixes older than 30 seconds are marked stale in gray and are not used to recenter. Poor accuracy, permission denial, and temporary location failures are shown explicitly.
- Chrome may suspend location updates in the background or when the screen is locked. This is a foreground map, with no background location service or saved track.
- The app does not store or upload location fixes. Basemap providers receive tile requests for the viewed area as the map moves.

Chrome requires a [secure context and location permission](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition). `http://localhost` is suitable on the computer itself, but `http://<computer-LAN-IP>/fishing-maps/` on a phone normally cannot use geolocation. Use the HTTPS GitHub Pages site or a local server with a valid HTTPS certificate for phone testing.

Leaflet is pinned to [1.9.4](https://leafletjs.com/download.html), loaded from a CDN with integrity checks. The default [MARIS 2025 NAIP](https://maris.mississippi.edu/HTML/DATA/data_Aerial/NAIP/NAIP2025.html) basemap requests visible image tiles from the official export service in EPSG:3857; its native UTM cache cannot be used as standard Leaflet XYZ tiles. No imagery is bundled or prefetched. [Esri World Imagery](https://goto.arcgisonline.com/maps/World_Imagery) and OpenStreetMap remain available. See [imagery sources](percy-quin/sources/imagery.md) for acquisition information and checks. Imagery is not a live view of lake conditions.

Internet access is required for the page, Leaflet, and uncached tiles. Attribution remains visible; there is no tile prefetch or offline tile download. Review the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/) when choosing a provider for a larger public audience.

## Verification

Run `node --test tests/*.test.js` for measurement lifecycle and unit conversion, imagery tile projection and request checks, contour and channel data validation, source fingerprints, channel registration and continuity, bank/all filtering, and location lifecycle tests. These tests do not validate a physical phone's GPS accuracy or background behavior; check those on the phone at the lake using HTTPS.
