import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, ScaleControl, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchSanAndresBoundary,
  validateBoundaryFeature,
  buildInverseMask
} from '../services/barangayBoundaryService';
import type { BoundaryFeature } from '../types/geographic';
import { severityForType, SEVERITY_INFO } from '../data/complaintSeverity';
import SavedBoundaryOverlay from './SavedBoundaryOverlay';
import { COMPLAINT_HEATMAP_LEVELS } from '../lib/complaintHeatmap';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatComplaintStatus } from '../constants';

export interface ZoneStats {
  id?: number;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  color: string;
  complaint_count?: number;
  active_count?: number;
  resolved_count?: number;
}

export interface ActiveComplaintDot {
  id: number;
  blotter_number?: string;
  uri_ng_reklamo: string;
  category?: string;
  status: string;
  street_name?: string;
  address_details?: string;
  zone?: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

function HotspotMapController({ feature, focusPlace }: { feature: BoundaryFeature; focusPlace?: { name: string; lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    if (!feature || !map) return;

    try {
      const geoJsonLayer = L.geoJSON(feature as any);
      const bounds = geoJsonLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [24, 24],
          maxZoom: 16,
          animate: true,
        });

        const paddedBounds = bounds.pad(0.35);
        map.setMaxBounds(paddedBounds);
        map.setMinZoom(13);
        map.options.maxBoundsViscosity = 0.9;
      }
      if (focusPlace && Number.isFinite(focusPlace.lat) && Number.isFinite(focusPlace.lng)) {
        map.flyTo([focusPlace.lat, focusPlace.lng], 17, { duration: 0.8 });
      }
    } catch (e) {
      console.error('Error fitting hotspot bounds:', e);
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(map.getContainer());

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [feature, focusPlace, map]);

  return null;
}

export default function BarangayHotspotMap({
  zones = [],
  complaints = [],
  focusPlace,
  zonesLoading = false,
}: {
  zones?: ZoneStats[];
  complaints?: ActiveComplaintDot[];
  focusPlace?: { name: string; lat: number; lng: number };
  zonesLoading?: boolean;
}) {
  const [feature, setFeature] = useState<BoundaryFeature | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchSanAndresBoundary()
      .then((res) => {
        if (isMounted && validateBoundaryFeature(res.feature)) {
          setFeature(res.feature);
        }
      })
      .catch((err) => {
        console.error('Hotspot map boundary error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const maskFeature = useMemo(() => (feature ? buildInverseMask(feature) : null), [feature]);
  const validComplaints = useMemo(
    () =>
      (complaints || []).filter(
        (c) =>
          Number.isFinite(Number(c.latitude)) &&
          Number.isFinite(Number(c.longitude)) &&
          c.latitude != null &&
          c.longitude != null &&
          Number(c.latitude) !== 0 &&
          Number(c.longitude) !== 0
      ),
    [complaints]
  );
  const hasActiveIncidents = validComplaints.length > 0;

  return (
    <div
      className="relative h-[540px] w-full overflow-hidden rounded-[1.75rem] border border-border/60 bg-slate-950 shadow-xl isolate"
      style={{ isolation: 'isolate' }}
    >
      <MapContainer
        center={[14.568, 121.108]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        {/* 1. Outside Area Mask: De-emphasizes surrounding territory outside San Andres */}
        {maskFeature && (
          <GeoJSON
            key={`hotspot-mask-${feature?.properties.psgc || 'san-andres'}`}
            data={maskFeature}
            interactive={false}
            style={{
              stroke: false,
              color: 'transparent',
              weight: 0,
              fillColor: '#090d16',
              fillOpacity: 0.65,
            }}
          />
        )}

        {/* 2. Official Mother Boundary: Barangay San Andres */}
        {feature && (
          <GeoJSON
            key={`mother-boundary-${feature.properties?.psgc || 'san-andres'}`}
            data={feature as any}
            style={{
              color: '#059669', // Emerald-600 outline
              weight: 3.5,
              opacity: 1,
              fillColor: '#10b981', // Subtle interior tint
              fillOpacity: 0.05,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            onEachFeature={(_, layer) => {
              layer.bindTooltip('Barangay San Andres, Cainta, Rizal (Official Boundary)', {
                sticky: true,
                direction: 'top',
                className: 'boundary-map-label font-bold text-xs',
              });
            }}
          />
        )}

        {/* 3. Child Boundaries of Zones in San Andres (Heatmap by complaint count) */}
        <SavedBoundaryOverlay zones={zones} heatmap hideSanAndresBoundary />

        {/* 4. Pinned Incident Location Small Dots with Severity Colors */}
        {validComplaints.map((c) => {
          const severity = severityForType(c.uri_ng_reklamo, c.category);
          const info = SEVERITY_INFO[severity] || SEVERITY_INFO.yellow;
          const lat = Number(c.latitude);
          const lng = Number(c.longitude);

          return (
            <React.Fragment key={c.id}>
              {/* Subtle outer severity halo */}
              <CircleMarker
                center={[lat, lng]}
                radius={11}
                pathOptions={{
                  color: info.color,
                  weight: 1,
                  fillColor: info.color,
                  fillOpacity: 0.22,
                }}
                interactive={false}
              />
              {/* Primary incident location pin dot */}
              <CircleMarker
                center={[lat, lng]}
                radius={6}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: info.color,
                  fillOpacity: 1,
                }}
              >
                <Popup autoPan={true} autoPanPadding={[60, 60]}>
                  <div className="min-w-[210px] p-1.5 space-y-2 text-xs font-sans">
                    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
                      <span className="font-mono font-bold text-[11px] text-foreground">
                        {c.blotter_number || `#${c.id}`}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs"
                        style={{ backgroundColor: info.color }}
                      >
                        {info.priority} Severity
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-sm text-foreground leading-snug">{c.uri_ng_reklamo}</p>
                      {c.category && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.category}</p>
                      )}
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2 space-y-1 text-[11px] border border-border/40">
                      <p className="font-medium text-foreground flex items-start gap-1">
                        <span className="shrink-0">📍</span>
                        <span className="break-words">{c.street_name || 'San Andres, Cainta'}</span>
                      </p>
                      {c.address_details && (
                        <p className="text-[10px] text-muted-foreground italic pl-4">
                          "{c.address_details}"
                        </p>
                      )}
                      {c.zone && (
                        <p className="text-[10px] text-muted-foreground pl-4">
                          Area: <span className="font-medium text-foreground">{c.zone}</span>
                        </p>
                      )}
                      <p className="font-mono text-[9px] text-muted-foreground/80 pl-4 pt-0.5">
                        Coords: {lat.toFixed(6)}, {lng.toFixed(6)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Status: {formatComplaintStatus(c.status)}</span>
                      <span>
                        {new Date(c.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <div className="text-[11px] font-sans">
                    <strong style={{ color: info.color }}>● {info.priority}</strong>: {c.uri_ng_reklamo}
                    <div className="text-[10px] opacity-80">{c.street_name || 'San Andres, Cainta'}</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {feature && <HotspotMapController feature={feature} focusPlace={focusPlace} />}
        <ScaleControl position="bottomright" imperial={false} />
      </MapContainer>

      {!zonesLoading && !hasActiveIncidents && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[30] flex justify-center">
          <div className="rounded-lg border border-border/70 bg-card/95 px-4 py-2 text-center text-xs text-muted-foreground shadow-sm backdrop-blur-md">
            No complaints mapped with coordinates yet. Incoming complaints with official addresses will be pinned here.
          </div>
        </div>
      )}

      {/* Floating Legend: Positioned bottom-left with isolation to prevent overlapping notification / message panels */}
      <div className="pointer-events-auto absolute bottom-4 left-4 z-[30] max-w-[260px] rounded-2xl border border-border/80 bg-card/95 p-3 text-[11px] shadow-xl backdrop-blur-md transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/85">
            Zone Heatmap
          </div>
          <button
            type="button"
            onClick={() => setIsLegendOpen((prev) => !prev)}
            className="rounded-lg p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isLegendOpen ? 'Collapse legend' : 'Expand legend'}
          >
            {isLegendOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>

        {isLegendOpen && (
          <div className="mt-2 space-y-1.5 pt-1.5 border-t border-border/50">
            {COMPLAINT_HEATMAP_LEVELS.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2.5 text-foreground/90">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-xs">{item.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{item.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
