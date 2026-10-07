export const DEPTHS = [4, 6, 8, 10, 12, 14, 16];
export const DEPTH_COLORS = { 4: '#fff27b', 6: '#ffc66b', 8: '#ff934b', 10: '#b8ed9e', 12: '#5fffea', 14: '#b5b4ff', 16: '#fd79ff' };
export const isEstimatedDepth = depth => DEPTHS.includes(depth) && depth % 4 !== 0;
export const depthVisible = (depth, mode) => DEPTHS.includes(depth) && (mode === 'all' || depth <= 8);

export function validateContours(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
    throw new Error('No contour features found');
  }
  const ids = new Set();
  const depths = new Set();
  for (const feature of data.features) {
    const { id, depth_ft: depth, estimated } = feature.properties || {};
    const coordinates = feature.geometry?.coordinates;
    if (feature.type !== 'Feature' || feature.geometry?.type !== 'LineString' ||
        typeof id !== 'string' || ids.has(id) || !DEPTHS.includes(depth) || estimated !== isEstimatedDepth(depth) ||
        !Array.isArray(coordinates) || coordinates.length < 2 ||
        !coordinates.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
          p[0] > -90.54 && p[0] < -90.51 && p[1] > 31.17 && p[1] < 31.20)) {
      throw new Error('Invalid Lake Tangipahoa contour geometry');
    }
    ids.add(id);
    depths.add(depth);
  }
  if (DEPTHS.some(depth => !depths.has(depth))) throw new Error('Missing a contour level');
}

export async function addDepthContours({ map, pauseFollow, bottomPadding }) {
  const toggle = document.querySelector('#depth-toggle');
  const mode = document.querySelector('#depth-mode');
  const status = document.querySelector('#depth-status');
  const key = document.querySelector('#depth-key');
  try {
    const response = await fetch('./percy-quin/data/depth-contours.geojson');
    if (!response.ok) throw new Error(`Depth data returned HTTP ${response.status}`);
    const data = await response.json();
    validateContours(data);
    map.createPane('depthCasing').style.zIndex = '410';
    map.getPane('depthCasing').style.pointerEvents = 'none';
    map.createPane('depthLines').style.zIndex = '420';
    map.createPane('depthLabels').style.zIndex = '590';
    const renderer = L.canvas({ pane: 'depthLines', tolerance: 8 });
    const casingRenderer = L.canvas({ pane: 'depthCasing' });
    const layers = new Map();
    const labelLayers = L.layerGroup().addTo(map);
    const candidates = new Map(DEPTHS.map(depth => [depth, []]));

    function depthPopup(depth) {
      const content = document.createElement('div');
      content.className = 'attractor-popup';
      const heading = document.createElement('h3');
      heading.textContent = `${depth} ft ${isEstimatedDepth(depth) ? 'estimated ' : ''}depth contour`;
      const note = document.createElement('p');
      note.textContent = (isEstimatedDepth(depth)
        ? `Estimated between the ${depth - 2} and ${depth + 2} ft published boundaries; not a surveyed depth.`
        : 'Smoothed published depth-band boundary.') +
        ' Based on MDWFP, October 2016. Current depth depends on water level and changes to the lake bottom.';
      const source = document.createElement('a');
      source.href = './percy-quin/sources/lake-tangipahoa-2016.pdf';
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = 'View original depth map ↗';
      content.append(heading, note, source);
      return content;
    }

    function topPadding() {
      const legendBottom = document.querySelector('.map-legend').getBoundingClientRect().bottom -
        map.getContainer().getBoundingClientRect().top;
      return Math.max(112, legendBottom + 16);
    }

    function inspect(depth, latlng) {
      pauseFollow();
      L.popup({ maxWidth: 250, autoPanPaddingTopLeft: [20, topPadding()], autoPanPaddingBottomRight: [20, bottomPadding()] })
        .setLatLng(latlng).setContent(depthPopup(depth)).openOn(map);
    }

    function addLabelCandidates(feature) {
      const points = feature.geometry.coordinates.map(([lng, lat]) => L.latLng(lat, lng));
      const cumulative = [0];
      for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + map.distance(points[i - 1], points[i]));
      const total = cumulative.at(-1);
      if (total < 80) return;
      const count = Math.max(1, Math.floor(total / 200));
      let segment = 1;
      for (let n = 0; n < count; n++) {
        const distance = (n + 0.5) * total / count;
        while (segment < cumulative.length - 1 && cumulative[segment] < distance) segment++;
        const fraction = (distance - cumulative[segment - 1]) / (cumulative[segment] - cumulative[segment - 1]);
        const a = points[segment - 1], b = points[segment];
        candidates.get(feature.properties.depth_ft).push(L.latLng(a.lat + fraction * (b.lat - a.lat), a.lng + fraction * (b.lng - a.lng)));
      }
    }

    for (const depth of DEPTHS) {
      const subset = { type: 'FeatureCollection', features: data.features.filter(f => f.properties.depth_ft === depth) };
      const estimated = isEstimatedDepth(depth);
      const weight = estimated ? 1.6 : depth <= 8 ? 2.6 : 2;
      const lineStyle = { smoothFactor: 0.15, lineCap: 'round', lineJoin: 'round', dashArray: estimated ? '6 4' : null };
      const casing = L.geoJSON(subset, { renderer: casingRenderer, pane: 'depthCasing', interactive: false,
        style: { ...lineStyle, color: '#132429', weight: weight + 2, opacity: 0.75 } });
      const lines = L.geoJSON(subset, {
        renderer, pane: 'depthLines',
        attribution: 'Depths: <a href="https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf">MDWFP</a> (Oct. 2016)',
        style: { ...lineStyle, color: DEPTH_COLORS[depth], weight, opacity: 1 },
        onEachFeature(feature, layer) {
          layer.on('click', event => inspect(depth, event.latlng));
          addLabelCandidates(feature);
        },
      });
      layers.set(depth, L.layerGroup([casing, lines]));
    }

    function updateLabels() {
      labelLayers.clearLayers();
      if (!toggle.checked || map.getZoom() < 15) return;
      const size = map.getSize();
      const labelTop = topPadding();
      const placed = [];
      const maxCandidates = Math.max(...Array.from(candidates.values(), values => values.length));
      // Round-robin through depths so long shallow lines don't crowd out deep labels.
      for (let i = 0; i < maxCandidates; i++) {
        for (const depth of DEPTHS) {
          if (!depthVisible(depth, mode.value)) continue;
          const latlng = candidates.get(depth)[i];
          if (!latlng) continue;
          const p = map.latLngToContainerPoint(latlng);
          if (p.x < 28 || p.x > size.x - 35 || p.y < labelTop || p.y > size.y - bottomPadding()) continue;
          if (placed.some(other => p.distanceTo(other) < 65)) continue;
          const marker = L.marker(latlng, {
            pane: 'depthLabels', title: `${depth} ft ${isEstimatedDepth(depth) ? 'estimated ' : ''}contour`, alt: `${depth} ft ${isEstimatedDepth(depth) ? 'estimated ' : ''}contour`,
            icon: L.divIcon({ className: `depth-label depth-${depth}${isEstimatedDepth(depth) ? ' depth-estimated' : ''}`, html: `${depth}′`, iconSize: [30, 24], iconAnchor: [15, 12] }),
          });
          marker.on('click', () => inspect(depth, latlng));
          labelLayers.addLayer(marker);
          placed.push(p);
          if (placed.length >= 28) return;
        }
      }
    }

    function update() {
      map.closePopup();
      for (const [depth, layer] of layers) {
        const visible = toggle.checked && depthVisible(depth, mode.value);
        if (visible && !map.hasLayer(layer)) layer.addTo(map);
        else if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
      }
      key.hidden = !toggle.checked;
      for (const entry of document.querySelectorAll('[data-depth-key]')) {
        entry.hidden = !depthVisible(Number(entry.dataset.depthKey), mode.value);
      }
      status.textContent = !toggle.checked ? 'Depth contours hidden.' : mode.value === 'bank'
        ? '4–8 ft · 2 ft intervals · dashed 6 ft line estimated.'
        : '4–16 ft · 2 ft intervals · dashed lines estimated.';
      updateLabels();
    }
    toggle.disabled = false;
    mode.disabled = false;
    toggle.addEventListener('change', update);
    mode.addEventListener('change', update);
    map.on('moveend zoomend resize overlayadd overlayremove', updateLabels);
    update();
  } catch (error) {
    key.hidden = true;
    status.textContent = 'Depth contours could not load. Reload to retry or open the original depth map below.';
    status.classList.add('error');
    console.error('Unable to load depth contours:', error);
  }
}
