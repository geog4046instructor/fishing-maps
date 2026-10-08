/* Leaflet is pinned to 1.9.4 in index.html. Relative data URLs support hosting in a subdirectory. */
import { createLocationTracker } from './location.js';
import { addDepthContours } from './depth.js';
import { addCreekChannel } from './channel.js';
import { createNaipLayer, BASEMAP_DETAILS } from './basemaps.js';
import { addMeasurementTool } from './measure.js';

(() => {
  'use strict';

  const status = document.querySelector('#data-status');
  const error = document.querySelector('#map-error');
  const tileStatus = document.querySelector('#tile-status');
  const toggle = document.querySelector('#attractors-toggle');
  const select = document.querySelector('#attractor-select');
  const reset = document.querySelector('#reset-view');
  const basemapSelect = document.querySelector('#basemap-select');
  const mapBasemapSelect = document.querySelector('#map-basemap-select');
  const locate = document.querySelector('#locate-me');
  const stopLocation = document.querySelector('#stop-location');
  const locationStatus = document.querySelector('#location-status');
  const locationPanel = document.querySelector('.location-panel');
  const panel = document.querySelector('#map-panel');
  const panelToggle = document.querySelector('#panel-toggle');
  const mobile = window.matchMedia('(max-width: 720px), (max-width: 900px) and (max-height: 500px)');
  let map;

  function syncPanel() {
    panelToggle.setAttribute('aria-expanded', String(panel.open));
    panelToggle.setAttribute('aria-label', panel.open ? 'Close sidebar' : 'Open sidebar');
    document.querySelector('.layout').classList.toggle('sidebar-closed', !panel.open);
    map?.invalidateSize({ animate: false });
  }
  function configurePanel() {
    panel.close();
    if (!mobile.matches) panel.show();
    syncPanel();
  }
  configurePanel();
  mobile.addEventListener('change', configurePanel);
  panelToggle.addEventListener('click', () => {
    if (panel.open) panel.close();
    else if (mobile.matches) panel.showModal();
    else panel.show();
    syncPanel();
  });
  document.querySelector('#close-panel').addEventListener('click', () => {
    panel.close();
    panelToggle.focus({ preventScroll: true });
  });
  panel.addEventListener('close', syncPanel);
  const sourceUrl = 'https://www.mdwfp.com/fishing-boating/lakes/lake-tangipahoa-percy-quin-state-park';
  // A viewing envelope only; this is not a surveyed lake boundary.
  const lakeView = [[31.1725, -90.5345], [31.2010, -90.5125]];

  if (!window.L) {
    error.textContent = 'The map library could not load. Check your connection and reload this page.';
    error.hidden = false;
    status.textContent = 'Interactive map unavailable.';
    status.classList.add('error');
    return;
  }

  map = L.map('map', { zoomControl: false, zoomSnap: 0.25 });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ position: 'bottomright', imperial: true, metric: false }).addTo(map);
  const bottomPadding = () => locationPanel.hidden || locationPanel.dataset.measuring === 'true' ? 130 : 205;
  const showLake = () => map.fitBounds(lakeView, { paddingTopLeft: [24, 80], paddingBottomRight: [24, bottomPadding()], animate: false });
  showLake();
  reset.disabled = false;
  reset.addEventListener('click', () => {
    tracker.pauseFollow();
    map.closePopup();
    select.value = '';
    showLake();
  });

  const basemaps = {
    naip2025: createNaipLayer(),
    satellite: L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: 'Imagery &copy; <a href="https://goto.arcgisonline.com/maps/World_Imagery">Esri</a>, Vantor, Earthstar Geographics, GIS User Community',
    }),
    streets: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
  };
  let basemap = basemaps.naip2025;
  function updateBasemapDetails() {
    const details = BASEMAP_DETAILS[basemapSelect.value];
    document.querySelector('#basemap-description').textContent = details.description;
    const source = document.querySelector('#basemap-source');
    source.href = details.url;
    source.textContent = details.linkText;
    document.querySelector('#basemap-badge').textContent = details.badge;
  }
  for (const [name, layer] of Object.entries(basemaps)) {
    let failed = false;
    layer.on('loading', () => { failed = false; });
    layer.on('tileerror', () => {
      failed = true;
      if (layer !== basemap) return;
      tileStatus.textContent = `Some ${BASEMAP_DETAILS[name].label} tiles could not load. Check your connection or use the basemap selector at the top left.`;
      tileStatus.hidden = false;
    });
    layer.on('load', () => { if (layer === basemap && !failed) tileStatus.hidden = true; });
  }
  basemap.addTo(map);
  updateBasemapDetails();
  function switchBasemap(value) {
    if (!Object.hasOwn(basemaps, value) || basemap === basemaps[value]) return;
    map.removeLayer(basemap);
    basemap = basemaps[value];
    basemapSelect.value = mapBasemapSelect.value = value;
    tileStatus.hidden = true;
    basemap.addTo(map);
    updateBasemapDetails();
  }
  for (const control of [basemapSelect, mapBasemapSelect]) {
    control.disabled = false;
    control.addEventListener('change', () => switchBasemap(control.value));
  }

  // The location never leaves this controller except to draw the current marker.
  // Panning the map naturally requests basemap tiles for the viewed area.
  map.createPane('locationPane').style.zIndex = '625';
  map.getPane('locationPane').style.pointerEvents = 'none';
  let locationDot;
  let accuracyCircle;
  const tracker = createLocationTracker({
    geolocation: navigator.geolocation,
    secureContext: window.isSecureContext,
    onPosition(fix, { following, firstFix }) {
      const latlng = [fix.lat, fix.lng];
      if (!locationDot) {
        accuracyCircle = L.circle(latlng, { radius: fix.accuracy, color: '#2686ff', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
        locationDot = L.circleMarker(latlng, { pane: 'locationPane', radius: 9, color: '#fff', weight: 3, fillColor: '#1976ed', fillOpacity: 1, interactive: false }).addTo(map);
      } else {
        accuracyCircle.setLatLng(latlng).setRadius(fix.accuracy);
        locationDot.setLatLng(latlng);
      }
      if (following) {
        const zoom = firstFix ? (fix.accuracy > 1000 ? 14 : fix.accuracy > 100 ? 16 : 17) : map.getZoom();
        map.setView(latlng, zoom, { animate: false });
      }
    },
    onChange(state) {
      locate.setAttribute('aria-label', !state.active ? 'Locate me' : state.following ? (state.fix ? 'Pause location following' : 'Finding your location') : 'Recenter me');
      locate.setAttribute('aria-pressed', String(state.following));
      stopLocation.hidden = !state.active;
      locationPanel.hidden = state.status === 'idle';
      locationStatus.dataset.state = state.status;
      if (state.status === 'tracking') {
        const feet = Math.max(1, Math.round(state.fix.accuracy * 3.28084));
        locationStatus.textContent = `${state.following ? 'Following you' : 'Location on'} · ±${feet.toLocaleString()} ft${state.fix.accuracy > 100 ? ' · Low accuracy' : ''}`;
      } else locationStatus.textContent = state.message;
      if (!state.fix && locationDot) {
        map.removeLayer(locationDot);
        map.removeLayer(accuracyCircle);
        locationDot = undefined;
        accuracyCircle = undefined;
      }
      if (locationDot) {
        const fresh = state.status === 'tracking';
        locationDot.setStyle({ fillColor: fresh ? '#1976ed' : '#69757e' });
        accuracyCircle.setStyle({ color: fresh ? '#2686ff' : '#69757e', dashArray: fresh ? null : '5 5' });
      }
    },
  });
  locate.disabled = false;
  const measurement = addMeasurementTool({ map, pauseFollow: () => tracker.pauseFollow() });
  locate.addEventListener('click', () => {
    measurement.stop();
    if (tracker.getState().following) tracker.pauseFollow();
    else tracker.follow();
  });
  stopLocation.addEventListener('click', () => tracker.stop());
  map.on('dragstart', () => tracker.pauseFollow());
  document.addEventListener('visibilitychange', () => tracker.checkFreshness());
  window.addEventListener('pagehide', () => tracker.stop());

  const markerById = new Map();
  let attractors;
  map.on('resize', () => {
    for (const marker of markerById.values()) {
      marker.getPopup().options.autoPanPaddingBottomRight = [20, bottomPadding()];
    }
  });

  function popupFor(feature) {
    const { id } = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    const content = document.createElement('div');
    content.className = 'attractor-popup';
    const title = document.createElement('h3');
    title.textContent = `Fish attractor ${id}`;
    const date = document.createElement('p');
    date.textContent = 'MDWFP · Installed January 2016';
    const coordinates = document.createElement('p');
    coordinates.className = 'coordinates';
    coordinates.textContent = `${lat.toFixed(6)}° N, ${Math.abs(lng).toFixed(6)}° W`;
    const note = document.createElement('p');
    note.textContent = 'Published location; present condition unverified.';
    const source = document.createElement('a');
    source.href = sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'View original source ↗';
    content.append(title, date, coordinates, note, source);
    return content;
  }

  async function loadAttractors() {
    try {
      const response = await fetch('./percy-quin/data/fish-attractors.geojson');
      if (!response.ok) throw new Error(`Attractor data returned HTTP ${response.status}`);
      const data = await response.json();
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
        throw new Error('Attractor data is not a nonempty FeatureCollection');
      }
      const ids = new Set();
      for (const feature of data.features) {
        const coordinates = feature.geometry?.coordinates;
        const id = feature.properties?.id;
        if (feature.type !== 'Feature' || feature.geometry?.type !== 'Point' ||
            !Array.isArray(coordinates) || coordinates.length !== 2 ||
            !coordinates.every(Number.isFinite) ||
            Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90 ||
            !Number.isInteger(id) || ids.has(id)) {
          throw new Error('Invalid or duplicate attractor feature');
        }
        ids.add(id);
      }

      attractors = L.geoJSON(data, {
        attribution: 'Attractors: <a href="' + sourceUrl + '">MDWFP</a> (2016)',
        pointToLayer(feature, latlng) {
          const id = feature.properties.id;
          return L.marker(latlng, {
            title: `Fish attractor ${id}`,
            alt: `Fish attractor ${id}`,
            icon: L.divIcon({ className: 'attractor-icon', html: `<span>${id}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
          });
        },
        onEachFeature(feature, layer) {
          layer.bindPopup(popupFor(feature), { maxWidth: 255, autoPanPaddingTopLeft: [20, 80], autoPanPaddingBottomRight: [20, bottomPadding()] });
          layer.on('click', () => tracker.pauseFollow());
          markerById.set(String(feature.properties.id), layer);
          layer.on('popupopen', () => { select.value = String(feature.properties.id); });
        },
      }).addTo(map);

      for (const feature of data.features) {
        const option = document.createElement('option');
        option.value = String(feature.properties.id);
        option.textContent = `Attractor ${String(feature.properties.id).padStart(2, '0')}`;
        select.append(option);
      }
      toggle.disabled = false;
      select.disabled = false;
      status.textContent = `${data.features.length} published locations · Select a marker for coordinates.`;
      toggle.addEventListener('change', () => {
        if (toggle.checked) attractors.addTo(map);
        else {
          map.removeLayer(attractors);
          select.value = '';
        }
      });
      select.addEventListener('change', () => {
        const marker = markerById.get(select.value);
        if (!marker) return;
        measurement.stop();
        tracker.pauseFollow();
        if (mobile.matches) panel.close();
        if (!map.hasLayer(attractors)) {
          attractors.addTo(map);
          toggle.checked = true;
        }
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 17), { animate: false });
        marker.openPopup();
      });
    } catch (failure) {
      status.textContent = 'Fish-attractor locations could not load. Reload to try again; the original source and download link are below.';
      status.classList.add('error');
      console.error('Unable to load fish attractors:', failure);
    }
  }

  loadAttractors();
  addDepthContours({ map, pauseFollow: () => tracker.pauseFollow(), bottomPadding });
  addCreekChannel({ map, pauseFollow: () => tracker.pauseFollow(), bottomPadding });
})();
