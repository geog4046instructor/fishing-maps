export const NAIP_2025_SERVICE = 'https://gis.mississippi.edu/server/rest/services/Raster/MS_NAIP_2025/MapServer';
const HALF_WORLD_METERS = Math.PI * 6378137;

export function mercatorTileBounds({ x, y, z }) {
  const span = 2 * HALF_WORLD_METERS / 2 ** z;
  // XYZ rows increase southward; ArcGIS expects xmin,ymin,xmax,ymax.
  return [x * span - HALF_WORLD_METERS, HALF_WORLD_METERS - (y + 1) * span,
    (x + 1) * span - HALF_WORLD_METERS, HALF_WORLD_METERS - y * span];
}

export function naipTileUrl(coords) {
  const params = new URLSearchParams({
    bbox: mercatorTileBounds(coords).join(','), bboxSR: '3857', imageSR: '3857',
    size: '256,256', format: 'jpg', transparent: 'false', dpi: '96', f: 'image',
  });
  return `${NAIP_2025_SERVICE}/export?${params}`;
}

export function createNaipLayer() {
  // MARIS's cached tiles use UTM 15N, not Leaflet's Web Mercator grid.
  // Ask the official export service to reproject each visible tile instead.
  const NaipLayer = L.TileLayer.extend({ getTileUrl: naipTileUrl });
  return new NaipLayer(NAIP_2025_SERVICE, {
    tileSize: 256, maxZoom: 20, maxNativeZoom: 19,
    bounds: [[30.1, -91.7], [35.05, -88.0]], noWrap: true,
    updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 1,
    attribution: '2025 aerial: USDA APFO / <a href="https://maris.mississippi.edu/HTML/DATA/data_Aerial/NAIP/NAIP2025.html">MARIS</a>',
  });
}

export const BASEMAP_DETAILS = {
  naip2025: {
    label: '2025 aerial imagery',
    description: 'USDA NAIP · 2025 · 30 cm (about 1 ft) pixels. Mississippi coverage; photographed with leaves on. Some water glare is visible.',
    url: 'https://maris.mississippi.edu/HTML/DATA/data_Aerial/NAIP/NAIP2025.html',
    linkText: '2025 imagery source ↗',
    badge: '2025 aerial',
  },
  satellite: {
    label: 'Esri satellite / aerial imagery',
    description: 'At the lake center, Esri reported November 21, 2024 imagery at 34 cm resolution when checked October 7, 2026. Dates vary by location and zoom.',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    linkText: 'Esri imagery source ↗',
    badge: 'Esri imagery',
  },
  streets: {
    label: 'street map',
    description: 'OpenStreetMap roads and places. Switch to aerial imagery to inspect shoreline detail.',
    url: 'https://www.openstreetmap.org/copyright',
    linkText: 'OpenStreetMap source ↗',
    badge: 'Street map',
  },
};
