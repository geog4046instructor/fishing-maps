import test from 'node:test';
import assert from 'node:assert/strict';
import { mercatorTileBounds, naipTileUrl } from '../assets/basemaps.js';

test('imagery tile projection covers the expected lake location and has seamless adjacent edges', () => {
  // Independently calculate the XYZ tile containing 31.18 N, 90.525 W.
  const z = 17;
  const x = Math.floor((-90.525 + 180) / 360 * 2 ** z);
  const lat = 31.18 * Math.PI / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * 2 ** z);
  const [west, south, east, north] = mercatorTileBounds({ x, y, z });
  const lonFromMeters = meters => meters / 6378137 * 180 / Math.PI;
  const latFromMeters = meters => Math.atan(Math.sinh(meters / 6378137)) * 180 / Math.PI;
  assert(lonFromMeters(west) <= -90.525 && lonFromMeters(east) >= -90.525);
  assert(latFromMeters(south) <= 31.18 && latFromMeters(north) >= 31.18);
  assert.equal(east, mercatorTileBounds({ x: x + 1, y, z })[0]);
  assert.equal(south, mercatorTileBounds({ x, y: y + 1, z })[3]);
  assert(Math.abs((east - west) - (north - south)) < 1e-8);
});

test('MARIS image export explicitly reprojects to the Leaflet tile grid', () => {
  const coords = { x: 32577, y: 53577, z: 17 };
  const url = new URL(naipTileUrl(coords));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.searchParams.get('bboxSR'), '3857');
  assert.equal(url.searchParams.get('imageSR'), '3857');
  assert.equal(url.searchParams.get('size'), '256,256');
  assert.equal(url.searchParams.get('f'), 'image');
  assert.deepEqual(url.searchParams.get('bbox').split(',').map(Number), mercatorTileBounds(coords));
});
