import type { BoundaryFeature, BoundaryGeometry, BoundaryResult } from '../types/geographic';

const TARGET_PSGC_10 = '0405805014';
const TARGET_PSGC_9 = '045805014';
const TARGET_PCODE = 'PH045805014';

const TARGET = {
  brgy_name: 'San Andres',
  city_name: 'Cainta',
  prov_name: 'Rizal',
  psgc_10d: TARGET_PSGC_10,
};

const OFFICIAL_QUERY_URLS = [
  `https://georisk.gis.gov.ph/arcgis/rest/services/Barangay/MapServer/0/query?where=brgy_name%3D%27San%20Andres%27%20AND%20city_name%3D%27Cainta%27%20AND%20prov_name%3D%27Rizal%27%20AND%20psgc_10d%3D%270405805014%27&outFields=brgy_name,city_name,prov_name,brgy_code,psgc_10d&returnGeometry=true&f=json`,
  `https://georisk.gis.gov.ph/arcgis/rest/services/PSA/MapServer/0/query?where=brgy_name%3D%27San%20Andres%27%20AND%20city_name%3D%27Cainta%27%20AND%20prov_name%3D%27Rizal%27%20AND%20psgc_10d%3D%270405805014%27&outFields=brgy_name,city_name,prov_name,brgy_code,psgc_10d&returnGeometry=true&f=json`,
  `https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2019/geojson/barangays/hires/barangays-municity-ph045805000.0.1.json`
];

const LOCAL_BOUNDARY_PATH = '/data/san-andres-cainta.geojson';

function normalize(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesPsgc(value?: string | null): boolean {
  const norm = normalize(value).replace(/[^a-z0-9]/g, '');
  return (
    norm === TARGET_PSGC_10 ||
    norm === TARGET_PSGC_9 ||
    norm === TARGET_PCODE.toLowerCase() ||
    norm === '0405805014' ||
    norm === '045805014'
  );
}

function matchesBarangayName(name?: string | null): boolean {
  const norm = normalize(name);
  return norm.includes('san andres');
}

function toPolygonCoordinates(value: unknown): number[][][] | number[][][][] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return null;

  if (Array.isArray(value[0]) && Array.isArray(value[0][0])) {
    const first = value[0][0] as unknown;
    if (Array.isArray(first) && Array.isArray(first[0])) {
      return value as number[][][][];
    }
    return value as number[][][];
  }

  return null;
}

function convertArcGisGeometry(geometry: any): BoundaryGeometry | null {
  if (!geometry || typeof geometry !== 'object') return null;

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const coords = toPolygonCoordinates(geometry.coordinates);
    if (!coords) return null;
    return { type: 'Polygon', coordinates: coords as number[][][] };
  }

  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    const coords = toPolygonCoordinates(geometry.coordinates);
    if (!coords) return null;
    return { type: 'MultiPolygon', coordinates: coords as number[][][][] };
  }

  if (Array.isArray(geometry.rings)) {
    const coordinates = geometry.rings.map((ring: unknown) => {
      if (!Array.isArray(ring)) return [];
      return ring.map((point: unknown) => {
        if (!Array.isArray(point) || point.length < 2) return [0, 0];
        return [Number(point[0]), Number(point[1])];
      });
    });

    if (!coordinates.length) return null;
    return { type: 'Polygon', coordinates };
  }

  return null;
}

export function buildFeatureFromGeoJson(rawFeature: any): BoundaryFeature | null {
  if (!rawFeature || typeof rawFeature !== 'object') return null;

  const properties = rawFeature.properties ?? {};
  const geometry = rawFeature.geometry ?? null;

  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return null;

  const brgy = properties.name ?? properties.barangay ?? properties.brgy_name ?? properties.ADM4_EN ?? '';
  const city = properties.municipality ?? properties.city_name ?? properties.ADM3_EN ?? '';
  const prov = properties.province ?? properties.prov_name ?? properties.ADM2_EN ?? '';
  const psgc = properties.psgc ?? properties.psgc_10d ?? properties.ADM4_PCODE ?? '';

  const isSanAndres = matchesBarangayName(brgy);
  const isCainta = normalize(city).includes('cainta');
  const isRizal = normalize(prov).includes('rizal');
  const isPsgcValid = matchesPsgc(psgc);

  if (!isSanAndres || (!isCainta && !isPsgcValid)) {
    return null;
  }

  return {
    type: 'Feature',
    properties: {
      name: 'Barangay San Andres',
      barangay: 'San Andres',
      municipality: 'Cainta',
      province: 'Rizal',
      region: 'CALABARZON (Region IV-A)',
      country: 'Philippines',
      psgc: TARGET_PSGC_10,
      adm4_pcode: TARGET_PCODE,
      source: properties.source ?? 'Philippine Statistics Authority (PSA) / NAMRIA Subnational Administrative Boundaries',
      sourceDate: properties.sourceDate ?? '2024',
      crs: 'EPSG:4326',
    },
    geometry: {
      type: geometry.type,
      coordinates: geometry.coordinates,
    },
  };
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function tryLocalBoundary(): Promise<BoundaryResult | null> {
  try {
    const response = await fetchJson(LOCAL_BOUNDARY_PATH);

    if (!response || !Array.isArray(response.features) || response.features.length === 0) {
      return null;
    }

    const feature = response.features.find((item: any) => buildFeatureFromGeoJson(item) !== null);
    if (!feature) return null;

    const normalizedFeature = buildFeatureFromGeoJson(feature);
    if (!normalizedFeature) return null;

    return { feature: normalizedFeature, source: 'local' };
  } catch {
    return null;
  }
}

async function tryOfficialBoundary(): Promise<BoundaryResult | null> {
  for (const url of OFFICIAL_QUERY_URLS) {
    try {
      const payload = await fetchJson(url);
      const records = Array.isArray(payload?.features) ? payload.features : [];
      const chosen = records.find((record: any) => buildFeatureFromGeoJson(record) !== null);

      if (chosen) {
        const feature = buildFeatureFromGeoJson(chosen);
        if (feature) {
          return { feature, source: 'official' };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function fetchSanAndresBoundary(): Promise<BoundaryResult> {
  // 1. Prioritize authoritative packaged local boundary
  const local = await tryLocalBoundary();
  if (local && validateBoundaryFeature(local.feature)) return local;

  // 2. Fallback to official remote datasets
  const official = await tryOfficialBoundary();
  if (official && validateBoundaryFeature(official.feature)) return official;

  throw new Error('Unable to verify the Barangay San Andres boundary.');
}

export function validateBoundaryFeature(feature: any): feature is BoundaryFeature {
  if (!feature || typeof feature !== 'object') return false;
  if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return false;
  if (!feature.geometry.coordinates || !feature.geometry.coordinates.length) return false;

  const properties = feature.properties ?? {};
  const isSanAndres = matchesBarangayName(properties.name) || matchesBarangayName(properties.barangay) || matchesBarangayName(properties.brgy_name);
  const isCainta = normalize(properties.municipality).includes('cainta') || normalize(properties.city_name).includes('cainta');
  const isRizal = normalize(properties.province).includes('rizal') || normalize(properties.prov_name).includes('rizal');
  const isPsgc = matchesPsgc(properties.psgc) || matchesPsgc(properties.psgc_10d) || matchesPsgc(properties.adm4_pcode);

  return isSanAndres && isCainta && isRizal && isPsgc;
}

/**
 * Builds an inverse world mask polygon with the San Andres polygon as an inner cutout/hole.
 * Leaflet renders this by filling everything outside San Andres, creating a spotlight on San Andres.
 */
export function buildInverseMask(feature: BoundaryFeature): any {
  const worldOuterRing = [
    [-180, -90],
    [180, -90],
    [180, 90],
    [-180, 90],
    [-180, -90],
  ];

  const geometry = feature.geometry;

  if (geometry.type === 'Polygon') {
    // A Polygon with outer ring and hole: coordinates = [worldOuterRing, sanAndresPolygonRing]
    const rings = geometry.coordinates as number[][][];
    return {
      type: 'Feature',
      properties: {
        name: 'San Andres Territory Spotlight Mask',
        description: 'Masks out all regions outside Barangay San Andres, Cainta',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [worldOuterRing, ...rings],
      },
    };
  }

  if (geometry.type === 'MultiPolygon') {
    // MultiPolygon: flatten all exterior rings into holes
    const allRings = (geometry.coordinates as number[][][][]).map((poly) => poly[0]).filter(Boolean);
    return {
      type: 'Feature',
      properties: {
        name: 'San Andres Territory Spotlight Mask',
        description: 'Masks out all regions outside Barangay San Andres, Cainta',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [worldOuterRing, ...allRings],
      },
    };
  }

  return null;
}

/**
 * Robust Point-in-Polygon (Ray-Casting) Algorithm.
 * Tests if latitude and longitude coordinates fall strictly inside Barangay San Andres boundary polygon.
 */
export function isPointInSanAndres(lat: number, lng: number, feature: BoundaryFeature): boolean {
  if (!feature || !feature.geometry || typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return false;
  }

  const point = [lng, lat]; // [x, y]
  const geometry = feature.geometry;

  function pointInLinearRing(pt: number[], vs: number[][]): boolean {
    const x = pt[0];
    const y = pt[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0];
      const yi = vs[i][1];
      const xj = vs[j][0];
      const yj = vs[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][];
    if (!rings.length || !rings[0].length) return false;
    // Inside exterior ring
    const inExterior = pointInLinearRing(point, rings[0]);
    if (!inExterior) return false;
    // Outside any interior holes
    for (let i = 1; i < rings.length; i++) {
      if (pointInLinearRing(point, rings[i])) {
        return false;
      }
    }
    return true;
  }

  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][];
    for (const poly of polygons) {
      if (!poly.length || !poly[0].length) continue;
      if (pointInLinearRing(point, poly[0])) {
        let inHole = false;
        for (let i = 1; i < poly.length; i++) {
          if (pointInLinearRing(point, poly[i])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
    return false;
  }

  return false;
}

