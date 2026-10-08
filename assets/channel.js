export function validateChannel(data) {
  const feature = data?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (data?.type !== 'FeatureCollection' || data.features?.length !== 1 ||
      feature?.type !== 'Feature' || feature.geometry?.type !== 'LineString' ||
      feature.properties?.source_date !== '2016-10' ||
      !Array.isArray(coordinates) || coordinates.length < 2 ||
      !coordinates.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
        p[0] > -90.54 && p[0] < -90.51 && p[1] > 31.17 && p[1] < 31.20)) {
    throw new Error('Invalid Lake Tangipahoa channel geometry');
  }
}

export async function addCreekChannel({ map, pauseFollow, bottomPadding }) {
  const toggle = document.querySelector('#channel-toggle');
  const status = document.querySelector('#channel-status');
  try {
    const response = await fetch('./percy-quin/data/creek-channel.geojson');
    if (!response.ok) throw new Error(`Channel data returned HTTP ${response.status}`);
    const data = await response.json();
    validateChannel(data);
    map.createPane('channelCasing').style.zIndex = '430';
    map.getPane('channelCasing').style.pointerEvents = 'none';
    map.createPane('channelLines').style.zIndex = '440';
    const casing = L.geoJSON(data, {
      pane: 'channelCasing', interactive: false, renderer: L.canvas({ pane: 'channelCasing' }),
      style: { color: '#142329', weight: 6.5, opacity: 0.85, smoothFactor: 0.3 },
    });
    const lines = L.geoJSON(data, {
      pane: 'channelLines', renderer: L.canvas({ pane: 'channelLines', tolerance: 10 }),
      attribution: 'Channel: <a href="https://www.mdwfp.com/sites/default/files/2024-05/lake-tangipahoa-2016.pdf">MDWFP</a> (Oct. 2016)',
      style: { color: '#fff', weight: 3.5, opacity: 1, dashArray: '10 8', lineCap: 'butt', smoothFactor: 0.3 },
      onEachFeature(feature, layer) {
        layer.on('click', event => {
          pauseFollow();
          const content = document.createElement('div');
          content.className = 'attractor-popup';
          const heading = document.createElement('h3');
          heading.textContent = 'Creek channel';
          const date = document.createElement('p');
          date.textContent = 'MDWFP · October 2016';
          const note = document.createElement('p');
          note.textContent = 'Historical mapped channel. Approximate route extracted from the published map; present location and bottom conditions are unverified. Use the depth contours alongside it.';
          const source = document.createElement('a');
          source.href = './percy-quin/sources/lake-tangipahoa-2016.pdf';
          source.target = '_blank';
          source.rel = 'noopener noreferrer';
          source.textContent = 'View original depth map ↗';
          content.append(heading, date, note, source);
          L.popup({ maxWidth: 250, autoPanPaddingTopLeft: [20, 80], autoPanPaddingBottomRight: [20, bottomPadding()] })
            .setLatLng(event.latlng).setContent(content).openOn(map);
        });
      },
    });
    const channel = L.layerGroup([casing, lines]);
    function update() {
      map.closePopup();
      if (toggle.checked) channel.addTo(map);
      else map.removeLayer(channel);
      status.textContent = toggle.checked ? 'Historical mapped channel · October 2016.' : 'Creek channel hidden.';
      map.fire(toggle.checked ? 'overlayadd' : 'overlayremove', { layer: channel, name: 'Creek channel' });
    }
    toggle.disabled = false;
    toggle.addEventListener('change', update);
    update();
  } catch (error) {
    status.textContent = 'Creek channel could not load. Reload to retry or open the original depth map below.';
    status.classList.add('error');
    console.error('Unable to load creek channel:', error);
  }
}
