// Browser-independent watch lifecycle, including stale fixes and late callbacks.
export function createLocationTracker({
  geolocation,
  secureContext,
  onChange,
  onPosition,
  now = Date.now,
  repeat = setInterval,
  cancelRepeat = clearInterval,
}) {
  const staleAfter = 30_000;
  const state = { active: false, following: false, status: 'idle', fix: null, message: 'Tap Locate me to show your position.' };
  let watchId = null;
  let timerId = null;
  let generation = 0;
  const snapshot = () => ({ ...state, fix: state.fix ? { ...state.fix } : null });
  const emit = () => onChange(snapshot());

  function clearWatch() {
    generation += 1;
    if (watchId !== null) geolocation.clearWatch(watchId);
    if (timerId !== null) cancelRepeat(timerId);
    watchId = null;
    timerId = null;
  }

  function stop(message = 'Location off. Tap Locate me to restart.', status = 'idle') {
    clearWatch();
    Object.assign(state, { active: false, following: false, status, fix: null, message });
    emit();
  }

  function checkFreshness() {
    if (state.active && state.fix && now() - state.fix.timestamp > staleAfter && state.status !== 'stale') {
      state.status = 'stale';
      state.message = 'Last location is stale. Waiting for a new fix…';
      emit();
    }
  }

  function pauseFollow() {
    if (!state.following) return;
    state.following = false;
    emit();
  }

  function follow() {
    if (!state.active) return start();
    checkFreshness();
    state.following = true;
    emit();
    if (state.status === 'tracking' && state.fix) onPosition({ ...state.fix }, { following: true, firstFix: false });
  }

  function start() {
    if (state.active) return follow();
    if (!secureContext) {
      stop('Location needs HTTPS. Open the HTTPS site on your phone.', 'error');
      return;
    }
    if (!geolocation) {
      stop('Location is unavailable in this browser.', 'error');
      return;
    }
    Object.assign(state, { active: true, following: true, status: 'waiting', message: 'Finding your location… Allow location access when asked.' });
    emit();
    const session = ++generation;

    const success = (position) => {
      if (session !== generation || !state.active) return;
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      const timestamp = position.timestamp;
      if (![lat, lng, accuracy, timestamp].every(Number.isFinite) ||
          Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0 ||
          timestamp > now() + 5000 || (state.fix && timestamp < state.fix.timestamp)) return;
      if (now() - timestamp > staleAfter) {
        state.status = 'stale';
        state.message = 'Waiting for a fresh location fix…';
        emit();
        return;
      }
      const firstFix = !state.fix;
      state.fix = { lat, lng, accuracy, timestamp };
      state.status = 'tracking';
      state.message = '';
      onPosition({ ...state.fix }, { following: state.following, firstFix });
      emit();
    };
    const failure = (error) => {
      if (session !== generation || !state.active) return;
      if (error.code === 1) {
        stop('Location blocked. Allow location for this site in Chrome, then tap Locate me.', 'error');
        return;
      }
      state.status = state.fix ? 'stale' : 'waiting';
      state.message = error.code === 3
        ? 'Location timed out. Still trying; check your phone’s Location setting.'
        : 'Location unavailable. Still trying; check your phone’s Location setting.';
      emit();
    };
    try {
      const id = geolocation.watchPosition(success, failure, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15_000 });
      // Also handles test adapters or browsers that report a failure immediately.
      if (session !== generation || !state.active) {
        geolocation.clearWatch(id);
        return;
      }
      watchId = id;
      timerId = repeat(checkFreshness, 5000);
    } catch {
      stop('Unable to start location. Check the site’s location permission and try again.', 'error');
    }
  }

  emit();
  return { start, follow, pauseFollow, stop, checkFreshness, getState: snapshot };
}
