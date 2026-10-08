// A single temporary segment; Leaflet supplies the geographic distance in meters.
export function createMeasurement({ distance, onChange }) {
  let active = false;
  let points = [];
  const getState = () => ({
    active,
    points: points.map(point => ({ ...point })),
    feet: points.length === 2 ? Math.round(distance(points[0], points[1]) / 0.3048) : null,
  });
  const emit = () => onChange(getState());
  return {
    getState,
    start() { active = true; points = []; emit(); },
    stop() { active = false; points = []; emit(); },
    clear() { if (active) { points = []; emit(); } },
    place({ lat, lng }) {
      if (!active || points.length === 2) return;
      points.push({ lat, lng });
      emit();
    },
    move(index, { lat, lng }) {
      if (!active || !points[index]) return;
      points[index] = { lat, lng };
      emit();
    },
  };
}

export function addMeasurementTool({ map, pauseFollow }) {
  const toggle = document.querySelector('#measure-toggle');
  const status = document.querySelector('#measure-status');
  const container = map.getContainer();
  const locationPanel = document.querySelector('.location-panel');
  const mapLabel = container.getAttribute('aria-label');
  map.createPane('measureLines').style.zIndex = '640';
  map.getPane('measureLines').style.pointerEvents = 'none';
  map.createPane('measureHandles').style.zIndex = '660';
  const layers = L.layerGroup().addTo(map);
  let markers = [];
  let line;
  let casing;
  let label;
  let restoreDoubleClick = false;
  let wasActive = false;

  const measurement = createMeasurement({
    distance: (a, b) => map.distance(a, b),
    onChange(state) {
      if (state.active !== wasActive) {
        if (state.active) {
          pauseFollow();
          map.closePopup();
          restoreDoubleClick = map.doubleClickZoom.enabled();
          map.doubleClickZoom.disable();
        } else if (restoreDoubleClick) map.doubleClickZoom.enable();
        wasActive = state.active;
      }
      container.classList.toggle('is-measuring', state.active);
      container.setAttribute('aria-label', state.active
        ? 'Measurement map. Tap two points, or pan with arrow keys and press Enter to place each point at the center. Escape exits.'
        : mapLabel);
      toggle.setAttribute('aria-pressed', String(state.active));
      toggle.setAttribute('aria-label', state.active ? 'Stop measuring and clear distance' : 'Measure distance');
      locationPanel.dataset.measuring = String(state.active);
      status.textContent = !state.active ? '' : state.points.length === 0 ? 'Tap your start point.'
        : state.points.length === 1 ? 'Tap your end point.' : `${state.feet.toLocaleString()} ft. Drag A or B to adjust.`;

      if (!state.points.length) {
        layers.clearLayers();
        markers = [];
        line = casing = label = undefined;
        return;
      }
      state.points.forEach((point, index) => {
        if (markers[index]) {
          markers[index].setLatLng(point);
          return;
        }
        const name = index === 0 ? 'A' : 'B';
        const marker = L.marker(point, {
          pane: 'measureHandles', draggable: true, autoPan: true,
          autoPanPadding: [55, 100], bubblingMouseEvents: false,
          title: `Endpoint ${name}: drag to adjust, or use arrow keys when focused`,
          icon: L.divIcon({
            className: 'measure-handle', html: `<span>${name}</span>`,
            iconSize: [48, 48], iconAnchor: [24, 24],
          }),
        }).addTo(layers);
        marker.on('drag', () => measurement.move(index, marker.getLatLng()));
        marker.on('dragend', () => measurement.move(index, marker.getLatLng()));
        marker.getElement().setAttribute('aria-label', `Measurement endpoint ${name}. Drag or use arrow keys to adjust.`);
        L.DomEvent.on(marker.getElement(), 'keydown', event => {
          const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (!delta) return;
          L.DomEvent.stop(event);
          const p = map.latLngToContainerPoint(marker.getLatLng());
          const step = event.shiftKey ? 20 : 5;
          measurement.move(index, map.containerPointToLatLng([p.x + delta[0] * step, p.y + delta[1] * step]));
        });
        markers[index] = marker;
      });
      if (state.points.length !== 2) return;
      if (!line) {
        casing = L.polyline(state.points, { pane: 'measureLines', interactive: false, color: '#132429', weight: 7, opacity: 0.95 }).addTo(layers);
        line = L.polyline(state.points, { pane: 'measureLines', interactive: false, color: '#fff', weight: 3, opacity: 1 }).addTo(layers);
        label = L.tooltip({ pane: 'measureHandles', permanent: true, direction: 'center', className: 'measure-distance', interactive: false });
      }
      casing.setLatLngs(state.points);
      line.setLatLngs(state.points);
      // Offset perpendicular to the segment so angled/vertical casts leave both handles clear.
      const a = map.project(state.points[0]), b = map.project(state.points[1]);
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const side = dx < 0 ? -1 : 1;
      label.options.offset = length ? L.point(side * dy / length * 40, -side * dx / length * 40) : L.point(0, -40);
      label.setLatLng(map.unproject(a.add(b).divideBy(2)))
        .setContent(`${state.feet.toLocaleString()} ft`);
      if (!layers.hasLayer(label)) label.addTo(layers);
    },
  });

  toggle.disabled = false;
  toggle.addEventListener('click', () => {
    if (measurement.getState().active) measurement.stop();
    else {
      measurement.start();
      container.focus({ preventScroll: true });
    }
  });
  map.on('click', event => measurement.place(event.latlng));
  // CSS passes pointer taps through feature layers; this also covers keyboard popups.
  map.on('popupopen', () => { if (measurement.getState().active) map.closePopup(); });
  container.addEventListener('keydown', event => {
    if (!measurement.getState().active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      measurement.stop();
      toggle.focus({ preventScroll: true });
    } else if (event.key === 'Enter' && event.target === container) {
      event.preventDefault();
      measurement.place(map.getCenter());
    }
  });
  return measurement;
}
