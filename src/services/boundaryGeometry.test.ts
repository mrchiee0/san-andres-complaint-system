import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boundaryContains,
  boundaryIntersects,
  buildBoundaryClassification,
  detectBoundaryMatches,
  parseBoundaryGeometry,
} from './boundaryGeometry';

function square(minX: number, minY: number, maxX: number, maxY: number) {
  return parseBoundaryGeometry({
    type: 'Polygon',
    coordinates: [[
      [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY],
    ]],
  });
}

test('rejects open and self-intersecting polygon rings', () => {
  assert.throws(() => parseBoundaryGeometry({
    type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
  }), /closed/);
  assert.throws(() => parseBoundaryGeometry({
    type: 'Polygon', coordinates: [[[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]]],
  }), /self-intersect/);
});

test('checks polygon containment and intersections', () => {
  const parent = square(0, 0, 10, 10);
  const child = square(1, 1, 2, 2);
  const crossing = square(9, 9, 11, 11);
  assert.equal(boundaryContains(parent, child), true);
  assert.equal(boundaryContains(parent, crossing), false);
  assert.equal(boundaryIntersects(parent, crossing), true);
});

test('returns only containing boundaries and classifies their hierarchy', () => {
  const boundaries = [
    { id: 1, name: 'San Andres', code: 'BRGY-01', type_name: 'Barangay', parent_id: null, geometry: square(0, 0, 10, 10) },
    { id: 2, name: 'Subdivision A', code: 'SUB-01', type_name: 'Subdivision', parent_id: 1, geometry: square(1, 1, 5, 5) },
    { id: 3, name: 'Block 4', code: 'BLK-04', type_name: 'Block', parent_id: 2, geometry: square(2, 2, 3, 3) },
  ];
  const matches = detectBoundaryMatches(2.5, 2.5, boundaries);
  assert.deepEqual(matches.map((boundary) => boundary.name), ['San Andres', 'Subdivision A', 'Block 4']);
  assert.equal(buildBoundaryClassification(matches).block?.id, 3);
  assert.deepEqual(detectBoundaryMatches(20, 20, boundaries), []);
});