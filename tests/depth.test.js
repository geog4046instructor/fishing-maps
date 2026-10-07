import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEPTHS, validateContours, depthVisible, isEstimatedDepth } from '../assets/depth.js';

const data = JSON.parse(readFileSync(new URL('../percy-quin/data/depth-contours.geojson', import.meta.url)));
const source = readFileSync(new URL('../percy-quin/sources/lake-tangipahoa-2016.pdf', import.meta.url));

test('depth dataset includes 2 ft intervals, distinguishes estimates, and retains its source fingerprint', () => {
  validateContours(data);
  assert.equal(data.metadata.source_sha256, createHash('sha256').update(source).digest('hex'));
  assert.deepEqual(data.metadata.contours_ft, [4, 6, 8, 10, 12, 14, 16]);
  assert.deepEqual(data.metadata.published_contours_ft, [4, 8, 12, 16]);
  assert.deepEqual(data.metadata.estimated_contours_ft, [6, 10, 14]);
  assert.deepEqual([...new Set(data.features.map(f => f.properties.depth_ft))], DEPTHS);
  for (const f of data.features) {
    assert.equal(f.properties.source_date, '2016-10');
    assert.equal(f.properties.estimated, isEstimatedDepth(f.properties.depth_ft));
    assert(f.properties.length_m > 0);
    assert(new Set(f.geometry.coordinates.map(p => p.join(','))).size >= 2);
  }
});

test('bank mode includes 6 ft; all mode starts at 4 ft and excludes unsupported deep levels', () => {
  const depths = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  assert.deepEqual(depths.filter(d => depthVisible(d, 'bank')), [4, 6, 8]);
  assert.deepEqual(depths.filter(d => depthVisible(d, 'all')), DEPTHS);
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
  for (const depth of DEPTHS) {
    const partial = { ...data, features: data.features.filter(f => f.properties.depth_ft !== depth) };
    assert.throws(() => validateContours(partial), /Missing/);
  }
});

test('reject interpolated lines presented as published depths', () => {
  const mislabeled = structuredClone(data);
  mislabeled.features.find(f => f.properties.depth_ft === 6).properties.estimated = false;
  assert.throws(() => validateContours(mislabeled), /Invalid/);
});
