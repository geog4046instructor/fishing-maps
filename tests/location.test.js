import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocationTracker } from '../assets/location.js';

function setup(overrides = {}) {
  let time = 1_000_000;
  const watches = [];
  const cleared = [];
  const timers = new Map();
  const changes = [];
  const positions = [];
  const geolocation = {
    watchPosition(success, failure, options) {
      watches.push({ success, failure, options });
      return watches.length - 1; // Watch ID zero must also be cleared.
    },
    clearWatch(id) { cleared.push(id); },
  };
  const tracker = createLocationTracker({
    geolocation,
    secureContext: true,
    now: () => time,
    repeat(fn) { timers.set(1, fn); return 1; },
    cancelRepeat(id) { timers.delete(id); },
    onChange(state) { changes.push(state); },
    onPosition(fix, mode) { positions.push({ fix, mode }); },
    ...overrides,
  });
  return {
    tracker, watches, cleared, timers, changes, positions,
    advance(ms) { time += ms; },
    fix(coords = {}, timestamp = time, index = watches.length - 1) {
      watches[index].success({ coords: { latitude: 31.18, longitude: -90.526, accuracy: 8, ...coords }, timestamp });
    },
  };
}

test('location starts only on request and asks for high accuracy', () => {
  const h = setup();
  assert.equal(h.watches.length, 0);
  h.tracker.start();
  assert.deepEqual(h.watches[0].options, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  h.fix();
  assert.equal(h.tracker.getState().status, 'tracking');
  assert.equal(h.positions[0].fix.accuracy, 8);
  assert.deepEqual(h.positions[0].mode, { following: true, firstFix: true });
});

test('panning pauses following while fixes keep updating; recenter reuses the watch', () => {
  const h = setup();
  h.tracker.start();
  h.fix();
  h.tracker.pauseFollow();
  h.advance(1000);
  h.fix({ latitude: 31.1801 });
  assert.equal(h.positions.at(-1).mode.following, false);
  h.tracker.follow();
  assert.equal(h.watches.length, 1);
  assert.deepEqual(h.positions.at(-1).mode, { following: true, firstFix: false });
  assert.equal(h.positions.at(-1).fix.lat, 31.1801);
});

test('stale fixes cannot recenter; a new fix restores tracking', () => {
  const h = setup();
  h.tracker.start();
  h.fix();
  h.advance(31_000);
  h.tracker.checkFreshness();
  assert.equal(h.tracker.getState().status, 'stale');
  h.tracker.follow();
  assert.equal(h.positions.length, 1);
  h.fix();
  assert.equal(h.tracker.getState().status, 'tracking');
  assert.equal(h.positions.length, 2);
});

test('permission denial clears resources and ignores a late callback', () => {
  const h = setup();
  h.tracker.start();
  h.watches[0].failure({ code: 1 });
  assert.deepEqual(h.cleared, [0]);
  assert.equal(h.timers.size, 0);
  assert.equal(h.tracker.getState().active, false);
  assert.match(h.tracker.getState().message, /Location blocked/);
  h.fix();
  assert.equal(h.positions.length, 0);
});

test('temporary timeout keeps watching and recovers on a new fix', () => {
  const h = setup();
  h.tracker.start();
  h.fix();
  h.watches[0].failure({ code: 3 });
  assert.equal(h.tracker.getState().active, true);
  assert.equal(h.tracker.getState().status, 'stale');
  assert.equal(h.cleared.length, 0);
  h.advance(2000);
  h.fix();
  assert.equal(h.tracker.getState().status, 'tracking');
  assert.equal(h.watches.length, 1);
});

test('stop clears the fix and an earlier session cannot affect a restarted watch', () => {
  const h = setup();
  h.tracker.start();
  h.fix();
  h.tracker.stop();
  assert.equal(h.tracker.getState().fix, null);
  assert.equal(h.tracker.getState().following, false);
  h.tracker.start();
  h.fix({}, 1_000_000, 0);
  assert.equal(h.tracker.getState().fix, null);
  h.fix();
  assert.equal(h.tracker.getState().status, 'tracking');
});

test('insecure and unsupported contexts produce actionable errors without watching', () => {
  for (const options of [{ secureContext: false }, { geolocation: undefined }]) {
    const h = setup(options);
    h.tracker.start();
    assert.equal(h.watches.length, 0);
    assert.equal(h.tracker.getState().status, 'error');
    assert.equal(h.tracker.getState().active, false);
  }
});

test('old, invalid, and out-of-order fixes never overwrite a fresh position', () => {
  const h = setup();
  h.tracker.start();
  h.fix({}, 900_000);
  assert.equal(h.positions.length, 0);
  h.fix({ latitude: NaN });
  h.fix({ longitude: 181 });
  h.fix({ accuracy: -1 });
  assert.equal(h.positions.length, 0);
  h.fix();
  h.fix({ latitude: 31.19 }, 999_999);
  assert.equal(h.positions.length, 1);
  assert.equal(h.tracker.getState().fix.lat, 31.18);
});

test('synchronous watch failure is contained and leaves no active timer', () => {
  const h = setup({ geolocation: { watchPosition() { throw new Error('Unavailable'); } } });
  h.tracker.start();
  assert.equal(h.tracker.getState().status, 'error');
  assert.equal(h.tracker.getState().active, false);
  assert.equal(h.timers.size, 0);
});
