# Lake Tangipahoa imagery

Checked October 7, 2026. Acquisition dates below are separate from service publication dates and the 2016 fishing overlays.

## Default: 2025 USDA NAIP aerials

- [MARIS dataset documentation](https://maris.mississippi.edu/HTML/DATA/data_Aerial/NAIP/NAIP2025.html).
- [Official dynamic map service](https://gis.mississippi.edu/server/rest/services/Raster/MS_NAIP_2025/MapServer), including layer 25, `Pike_NAIP_2025.sid`.
- 30 cm ground sample distance; leaf-on photography. Statewide acquisition range June 21 through September 27, 2025. The specific flight day over the lake has not been established, so the UI labels only the year.
- Full-lake and marina previews inspected: usable coverage, visible shoreline vegetation and dock detail, with surface glare in parts of the lake. New aerials do not establish current submerged brush condition.
- Attribution: USDA APFO, MARIS. The public service requires no API key.
- The cached service uses EPSG:26915 (UTM 15N). The app instead requests square 256-pixel JPEG exports with matching square EPSG:3857 bounds, ensuring correct Leaflet alignment without a projection plugin. Only visible map requests are made; no bulk download or offline cache.
- Maximum native zoom is 19 (roughly 26 cm/display pixel at this latitude); zoom 20 enlarges the existing imagery rather than claiming additional detail.

## Retained: Esri World Imagery

[Service](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer). Querying metadata layer 9 at longitude -90.525, latitude 31.185 returned:

- Source date: November 21, 2024 (`SRC_DATE=20241121`).
- Source resolution: 0.34 m; sampled resolution: 0.3 m.
- Source: Vantor Vivid (`SRC_DESC=LG01`).
- Coverage levels: 12 through 19 in the returned record.
- Release: Raster Basemaps 2026.R02. This release date is not the photography date.

This is a point-specific metadata check, not an assertion that all Esri imagery everywhere or at every zoom has that date. The site states that dates vary by location and zoom.

## Other coverage checked

MARIS's services named `Local_High_Res_2025` and `Local_High_Res_June_2025` still describe southern Mississippi coverage as 2016-2022; the Southwest regional service identifies Pike County as 2022, 6 inch. These were not labeled as 2025 photography merely because the service name contains 2025.
