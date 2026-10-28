import { booleanContains } from '@turf/boolean-contains';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { booleanIntersects } from '@turf/boolean-intersects';
import { feature, point } from '@turf/helpers';
import { kinks } from '@turf/kinks';
import type { MultiPolygon, Polygon } from 'geojson';

export type BoundaryGeometry = Polygon | MultiPolygon;

export type BoundaryMatch = {
  id: number;
  name: string;
  code: string | null;
  type: string;
  parent_id: number | null;
  depth: number;
};

export function parseBoundaryGeometry(value: unknown): BoundaryGeometry {
  let geometry = value;
  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      throw new Error('Boundary geometry must be valid GeoJSON.');
    }
  }

  if (!geometry || typeof geometry !== 'object') {
    throw new Error('A polygon geometry is required.');
  }

  const candidate = geometry as Record<string, unknown>;
  if (!['Polygon', 'MultiPolygon'].includes(String(candidate.type)) || !Array.isArray(candidate.coordinates)) {
    throw new Error('Boundary geometry must be a Polygon or MultiPolygon.');
  }

  const polygons = candidate.type === 'Polygon'
    ? [candidate.coordinates]
    : candidate.coordinates;
  let vertexCount = 0;

  for (const polygon of polygons as unknown[]) {
    if (!Array.isArray(polygon) || polygon.length === 0) throw new Error('Each polygon needs an outer ring.');
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw new Error('Polygon rings need at least four positions.');
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!Array.isArray(first) || !Array.isArray(last) || first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error('Polygon rings must be closed.');
      }
      for (const position of ring) {
        if (!Array.isArray(position) || position.length < 2) throw new Error('Each position needs longitude and latitude.');
        const [longitude, latitude] = position;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          throw new Error('Polygon coordinates must be valid longitude/latitude values.');
        }
        vertexCount += 1;
      }
    }
  }

  if (vertexCount > 20000) throw new Error('Boundary geometry may not exceed 20,000 positions.');

  const validGeometry = candidate as unknown as BoundaryGeometry;
  try {
    if (kinks({ type: 'Feature', properties: {}, geometry: validGeometry }).features.length > 0) {
      throw new Error('Polygon rings may not self-intersect.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('self-intersect')) throw error;
    throw new Error('Boundary geometry could not be validated.');
  }

  return validGeometry;
}

export function detectBoundaryMatches(
  latitude: number,
  longitude: number,
  boundaries: Array<Record<string, any>>
): BoundaryMatch[] {
  const feature = point([longitude, latitude]);
  const activeById = new Map(boundaries.map((boundary) => [Number(boundary.id), boundary]));

  return boundaries
    .filter((boundary) => {
      try {
        return booleanPointInPolygon(feature, {
          type: 'Feature',
          properties: {},
          geometry: parseBoundaryGeometry(boundary.geometry),
        });
      } catch {
        return false;
      }
    })
    .map((boundary) => {
      let depth = 0;
      let parentId = boundary.parent_id ? Number(boundary.parent_id) : null;
      const visited = new Set<number>();
      while (parentId && activeById.has(parentId) && !visited.has(parentId)) {
        visited.add(parentId);
        depth += 1;
        parentId = activeById.get(parentId).parent_id ? Number(activeById.get(parentId).parent_id) : null;
      }
      return {
        id: Number(boundary.id),
        name: String(boundary.name),
        code: boundary.code || null,
        type: String(boundary.type_name),
        parent_id: boundary.parent_id ? Number(boundary.parent_id) : null,
        depth,
      };
    })
    .sort((left, right) => left.depth - right.depth || left.id - right.id);
}

export function buildBoundaryClassification(matches: BoundaryMatch[]) {
  return matches.reduce<Record<string, BoundaryMatch>>((result, boundary) => {
    const key = boundary.type.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const current = result[key];
    if (!current || boundary.depth >= current.depth) result[key] = boundary;
    return result;
  }, {});
}

export function boundaryContains(container: BoundaryGeometry, candidate: BoundaryGeometry) {
  return booleanContains(feature(container), feature(candidate));
}

export function boundaryIntersects(left: BoundaryGeometry, right: BoundaryGeometry) {
  return booleanIntersects(feature(left), feature(right));
}