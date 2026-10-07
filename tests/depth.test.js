import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateContours, depthVisible } from '../assets/depth.js';

const data = JSON.parse(readFileSync(new URL('../percy-quin/data/depth-contours.geojson', import.meta.url)));
const source = readFileSync(new URL('../percy-quin/sources/lake-tangipahoa-2016.pdf', import.meta.url));

test('depth dataset retains all four source boundaries and its source fingerprint', () => {
  validateContours(data);
  assert.equal(data.metadata.source_sha256, createHash('sha256').update(source).digest('hex'));
  assert.equal(data.features.length, 123);
  const counts = Object.fromEntries([4, 8, 12, 16].map(d => [d, data.features.filter(f => f.properties.depth_ft === d).length]));
  assert.deepEqual(counts, { 4: 60, 8: 37, 12: 20, 16: 6 });
  for (const f of data.features) {
    assert.equal(f.properties.source_date, '2016-10');
    assert(f.properties.length_m > 0);
    assert(new Set(f.geometry.coordinates.map(p => p.join(','))).size >= 2);
  }
});

test('bank mode excludes deeper contours; all mode exposes every source level', () => {
  assert.deepEqual([4, 8, 12, 16, 20].filter(d => depthVisible(d, 'bank')), [4, 8]);
  assert.deepEqual([4, 8, 12, 16, 20].filter(d => depthVisible(d, 'all')), [4, 8, 12, 16]);
});

test('reject swapped coordinate axes and unsupported depth values', () => {
  const swapped = structuredClone(data);
  swapped.features[0].geometry.coordinates[0].reverse();
  assert.throws(() => validateContours(swapped), /Invalid/);
  const invented = structuredClone(data);
  invented.features[0].properties.depth_ft = 20;
  assert.throws(() => validateContours(invented), /Invalid/);
});

test('reject a partially missing depth layer', () => {
  const partial = { ...data, features: data.features.filter(f => f.properties.depth_ft !== 8) };
  assert.throws(() => validateContours(partial), /Missing/);
});
