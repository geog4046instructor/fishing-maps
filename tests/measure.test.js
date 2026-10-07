import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeasurement } from '../assets/measure.js';

// Coordinates in this fixture represent meters to isolate state and unit conversion.
function setup() {
  const changes = [];
  const measurement = createMeasurement({
    distance: (a, b) => Math.hypot(b.lat - a.lat, b.lng - a.lng),
    onChange: state => changes.push(state),
  });
  return { measurement, changes };
}

test('two taps create one segment in feet; subsequent taps cannot add or replace it', () => {
  const { measurement: m, changes } = setup();
  m.place({ lat: 0, lng: 0 });
  assert.equal(changes.length, 0);
  m.start();
  m.place({ lat: 0, lng: 0 });
  assert.equal(m.getState().feet, null);
  m.place({ lat: 0, lng: 30.48 });
  assert.equal(m.getState().feet, 100);
  m.place({ lat: 100, lng: 100 });
  assert.deepEqual(m.getState().points, [{ lat: 0, lng: 0 }, { lat: 0, lng: 30.48 }]);
  assert.equal(changes.length, 3);
});

test('both endpoints can move, including before the second point is placed', () => {
  const { measurement: m } = setup();
  m.start();
  m.place({ lat: 5, lng: 5 });
  m.move(0, { lat: 0, lng: 0 });
  m.move(1, { lat: 1, lng: 1 });
  assert.equal(m.getState().points.length, 1);
  m.place({ lat: 3, lng: 4 });
  assert.equal(m.getState().feet, 16);
  m.move(1, { lat: 0, lng: 30.48 });
  assert.equal(m.getState().feet, 100);
  m.move(0, { lat: 0, lng: 15.24 });
  assert.equal(m.getState().feet, 50);
  m.move(1, { lat: 0, lng: 15.24 });
  assert.equal(m.getState().feet, 0);
});

test('clear keeps measuring; stop removes the segment and ignores late drag events', () => {
  const { measurement: m } = setup();
  m.start();
  m.place({ lat: 0, lng: 0 });
  m.place({ lat: 1, lng: 1 });
  m.clear();
  assert.deepEqual(m.getState(), { active: true, points: [], feet: null });
  m.place({ lat: 2, lng: 2 });
  m.stop();
  m.move(0, { lat: 9, lng: 9 });
  m.place({ lat: 9, lng: 9 });
  m.clear();
  assert.deepEqual(m.getState(), { active: false, points: [], feet: null });
  m.start();
  assert.deepEqual(m.getState(), { active: true, points: [], feet: null });
});

test('state snapshots cannot mutate endpoints or later measurement sessions', () => {
  const { measurement: m, changes } = setup();
  m.start();
  const point = { lat: 1, lng: 2 };
  m.place(point);
  point.lat = 99;
  const snapshot = m.getState();
  snapshot.points[0].lat = 88;
  assert.equal(m.getState().points[0].lat, 1);
  m.move(0, { lat: 3, lng: 4 });
  assert.equal(changes[1].points[0].lat, 1);
  m.start();
  assert.deepEqual(m.getState().points, []);
});
