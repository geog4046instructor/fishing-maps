# Imagery sources

Service metadata recorded October 7, 2026. Acquisition dates refer to photography, not service publication or the fishing overlays.

## USDA NAIP 2025

The default basemap uses [MARIS 2025 NAIP imagery](https://maris.mississippi.edu/HTML/DATA/data_Aerial/NAIP/NAIP2025.html), served by the [official map service](https://gis.mississippi.edu/server/rest/services/Raster/MS_NAIP_2025/MapServer). Lake Tangipahoa is covered by layer 25, `Pike_NAIP_2025.sid`.

- Ground sample distance: 30 cm.
- Mississippi acquisition period: June 21–September 27, 2025; leaf-on photography. The specific acquisition day over the lake is unspecified.
- Coverage: Mississippi, with surface glare visible in parts of the lake.
- Attribution: USDA APFO, MARIS.

The service's native cache uses EPSG:26915 (UTM 15N). The map requests 256-pixel JPEG exports in EPSG:3857 to match Leaflet's tile grid. Native zoom is capped at 19; zoom 20 enlarges those tiles. Imagery is requested as needed and is not bundled or prefetched.

## Esri World Imagery

[Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) is an alternative basemap. Metadata layer 9 at longitude -90.525, latitude 31.185 reports:

| Property | Value |
| --- | --- |
| Acquisition date | November 21, 2024 (`SRC_DATE=20241121`) |
| Source resolution | 0.34 m |
| Sampled resolution | 0.3 m |
| Source | Vantor Vivid (`SRC_DESC=LG01`) |
| Coverage levels | 12–19 |
| Service release | Raster Basemaps 2026.R02 |

This metadata applies to the sampled location and coverage levels. Acquisition dates can vary by location and zoom; the service release date is separate from the photography date.

## OpenStreetMap

[OpenStreetMap](https://www.openstreetmap.org/copyright) provides the street basemap. Tile use is subject to the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
