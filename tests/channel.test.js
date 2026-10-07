import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateChannel } from '../assets/channel.js';

const data = JSON.parse(readFileSync(new URL('../percy-quin/data/creek-channel.geojson', import.meta.url)));
const source = readFileSync(new URL('../percy-quin/sources/lake-tangipahoa-2016.pdf', import.meta.url));

test('channel preserves source provenance and dam-to-inlet registration without large jumps', () => {
  validateChannel(data);
  assert.equal(data.metadata.source_sha256, createHash('sha256').update(source).digest('hex'));
  assert.equal(data.metadata.source_strokes, 77);
  assert.equal(data.metadata.joined_dash_gaps, 76);
  assert(data.metadata.max_joined_dash_gap_m < 23);
  const coordinates = data.features[0].geometry.coordinates;
  const [south, north] = [coordinates[0], coordinates.at(-1)];
  // Independently checked against the original PDF's dam and north inlet.
  assert(south[0] > -90.528 && south[0] < -90.527 && south[1] > 31.174 && south[1] < 31.175);
  assert(north[0] > -90.522 && north[0] < -90.520 && north[1] > 31.198 && north[1] < 31.199);
  let length = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [a, b] = [coordinates[i - 1], coordinates[i]];
    const distance = Math.hypot((a[0] - b[0]) * 111320 * Math.cos(31.18 * Math.PI / 180), (a[1] - b[1]) * 111320);
    assert(distance > 0 && distance < 23, 'Duplicate point or unexpected gap in the channel');
    length += distance;
  }
  assert(length > 3100 && length < 3250);
});

test('channel rejects missing geometry and reversed coordinate axes', () => {
  assert.throws(() => validateChannel({ type: 'FeatureCollection', features: [] }), /Invalid/);
  const swapped = structuredClone(data);
  swapped.features[0].geometry.coordinates[0].reverse();
  assert.throws(() => validateChannel(swapped), /Invalid/);
});
