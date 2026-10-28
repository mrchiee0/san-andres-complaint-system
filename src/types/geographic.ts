export type GeometryType = 'Polygon' | 'MultiPolygon';

export interface BoundaryGeometry {
  type: GeometryType;
  coordinates: number[][][] | number[][][][];
}

export interface BoundaryFeatureProperties {
  name: string;
  barangay?: string;
  municipality: string;
  province: string;
  region?: string;
  country?: string;
  psgc: string;
  adm4_pcode?: string;
  source?: string;
  sourceDate?: string;
  crs?: string;
}

export interface BoundaryFeature {
  type: 'Feature';
  properties: BoundaryFeatureProperties;
  geometry: BoundaryGeometry;
}

export interface BoundaryFeatureCollection {
  type: 'FeatureCollection';
  properties?: Partial<BoundaryFeatureProperties>;
  features: BoundaryFeature[];
}

export interface BoundaryResult {
  feature: BoundaryFeature;
  source: 'official' | 'local';
}

