import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, ScaleControl, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import {
  fetchSanAndresBoundary,
  validateBoundaryFeature,
  buildInverseMask
} from '../services/barangayBoundaryService';
import type { BoundaryFeature } from '../types/geographic';
import { severityForType, SEVERITY_INFO, type ComplaintSeverity } from '../data/complaintSeverity';
import { ChevronDown, ChevronUp, MapPin, Filter, X, ExternalLink, Calendar, Compass } from 'lucide-react';
import { formatComplaintStatus } from '../constants';

export interface IncidentDot {
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

function IncidentMapController({ feature, focusPlace }: { feature: BoundaryFeature; focusPlace?: { name: string; lat: number; lng: number } }) {
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
      console.error('Error fitting incident pin map bounds:', e);
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

function MapClickHandler({ onDeselect }: { onDeselect: () => void }) {
  useMapEvents({
    click: () => onDeselect(),
  });
  return null;
}

export default function BarangayIncidentPinMap({
  complaints = [],
  focusPlace,
  loading = false,
}: {
  complaints?: IncidentDot[];
  focusPlace?: { name: string; lat: number; lng: number };
  loading?: boolean;
}) {
  const [feature, setFeature] = useState<BoundaryFeature | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | ComplaintSeverity>('all');
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<IncidentDot | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchSanAndresBoundary()
      .then((res) => {
        if (isMounted && validateBoundaryFeature(res.feature)) {
          setFeature(res.feature);
        }
      })
      .catch((err) => {
        console.error('Incident pin map boundary error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const maskFeature = useMemo(() => (feature ? buildInverseMask(feature) : null), [feature]);

  // Filter only complaints with valid numerical coordinates
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

  const filteredComplaints = useMemo(() => {
    if (severityFilter === 'all') return validComplaints;
    return validComplaints.filter((c) => severityForType(c.uri_ng_reklamo, c.category) === severityFilter);
  }, [validComplaints, severityFilter]);

  const urgentCount = useMemo(() => validComplaints.filter((c) => severityForType(c.uri_ng_reklamo, c.category) === 'red').length, [validComplaints]);
  const highCount = useMemo(() => validComplaints.filter((c) => severityForType(c.uri_ng_reklamo, c.category) === 'orange').length, [validComplaints]);
  const standardCount = useMemo(() => validComplaints.filter((c) => severityForType(c.uri_ng_reklamo, c.category) === 'yellow').length, [validComplaints]);

  // Compute selected incident severity styling
  const selectedSeverity = selectedIncident ? severityForType(selectedIncident.uri_ng_reklamo, selectedIncident.category) : 'yellow';
  const selectedSeverityInfo = SEVERITY_INFO[selectedSeverity] || SEVERITY_INFO.yellow;

  return (
    <div
      className="relative h-[580px] w-full overflow-hidden rounded-[1.75rem] border border-border/70 bg-slate-950 shadow-2xl isolate"
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

        {/* 1. Outside Area Mask: De-emphasizes territory outside Barangay San Andres */}
        {maskFeature && (
          <GeoJSON
            key={`pin-mask-${feature?.properties.psgc || 'san-andres'}`}
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
            key={`pin-mother-boundary-${feature.properties?.psgc || 'san-andres'}`}
            data={feature as any}
            style={{
              color: '#059669', // Emerald-600 outline
              weight: 3.5,
              opacity: 1,
              fillColor: '#10b981',
              fillOpacity: 0.03,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            onEachFeature={(_, layer) => {
              layer.bindTooltip('Barangay San Andres, Cainta (Official Administrative Perimeter)', {
                sticky: true,
                direction: 'top',
                className: 'boundary-map-label font-bold text-xs',
              });
            }}
          />
        )}

        {/* 3. Pinned Incident Location Dots */}
        {filteredComplaints.map((c) => {
          const severity = severityForType(c.uri_ng_reklamo, c.category);
          const info = SEVERITY_INFO[severity] || SEVERITY_INFO.yellow;
          const lat = Number(c.latitude);
          const lng = Number(c.longitude);
          const isSelected = selectedIncident?.id === c.id;

          return (
            <React.Fragment key={c.id}>
              {/* Outer Radiant Glow Halo */}
              <CircleMarker
                center={[lat, lng]}
                radius={isSelected ? 18 : 13}
                pathOptions={{
                  color: isSelected ? '#ffffff' : info.color,
                  weight: isSelected ? 2 : 1,
                  fillColor: info.color,
                  fillOpacity: isSelected ? 0.35 : 0.22,
                }}
                interactive={false}
              />
              {/* Vibrant Crisp Pinpoint Dot */}
              <CircleMarker
                center={[lat, lng]}
                radius={isSelected ? 9 : 7}
                pathOptions={{
                  color: '#ffffff',
                  weight: isSelected ? 2.5 : 2,
                  fillColor: info.color,
                  fillOpacity: 1,
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e as any);
                    setSelectedIncident(c);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.96}>
                  <div className="text-[11px] font-sans">
                    <strong style={{ color: info.color }}>● {info.priority} Severity</strong> · {c.blotter_number || `#${c.id}`}
                    <div className="font-semibold text-foreground">{c.uri_ng_reklamo}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Status: {formatComplaintStatus(c.status)} · Click to view info on right
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {feature && <IncidentMapController feature={feature} focusPlace={focusPlace} />}
        <MapClickHandler onDeselect={() => setSelectedIncident(null)} />
        <ScaleControl position="bottomright" imperial={false} />
      </MapContainer>

      {/* Floating Top Control: Severity Filter Bar */}
      <div className="pointer-events-auto absolute top-4 left-4 z-[30] flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-lg backdrop-blur-md">
        <span className="flex items-center gap-1 px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3 w-3" /> Filter:
        </span>
        <button
          type="button"
          onClick={() => setSeverityFilter('all')}
          className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
            severityFilter === 'all'
              ? 'bg-foreground text-background shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({validComplaints.length})
        </button>
        <button
          type="button"
          onClick={() => setSeverityFilter('red')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
            severityFilter === 'red'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-red-500 border border-white" />
          Urgent ({urgentCount})
        </button>
        <button
          type="button"
          onClick={() => setSeverityFilter('orange')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
            severityFilter === 'orange'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-orange-500 border border-white" />
          High ({highCount})
        </button>
        <button
          type="button"
          onClick={() => setSeverityFilter('yellow')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
            severityFilter === 'yellow'
              ? 'bg-yellow-600 text-white shadow-xs'
              : 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-yellow-500 border border-white" />
          Standard ({standardCount})
        </button>
      </div>

      {/* Floating Info Panel on the Right Side (User-friendly, non-clipping side panel) */}
      {selectedIncident && (
        <aside
          className="pointer-events-auto absolute top-4 right-4 z-[35] w-80 sm:w-96 max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-border/80 bg-card/95 p-4 md:p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-200"
          role="region"
          aria-label="Selected incident details"
        >
          {/* Panel Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shadow-xs"
                  style={{ backgroundColor: selectedSeverityInfo.color }}
                />
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Official Incident Pin
                </span>
                <span className="font-mono text-[11px] font-bold text-foreground">
                  {selectedIncident.blotter_number || `#${selectedIncident.id}`}
                </span>
              </div>
              <h4 className="mt-1 text-base font-serif italic font-bold text-foreground leading-snug">
                {selectedIncident.uri_ng_reklamo}
              </h4>
              {selectedIncident.category && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{selectedIncident.category}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedIncident(null)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close incident info"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Badges: Priority & Official English Tracking Status */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs"
              style={{ backgroundColor: selectedSeverityInfo.color }}
            >
              ● {selectedSeverityInfo.priority} Severity
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">
              Status: {formatComplaintStatus(selectedIncident.status)}
            </span>
          </div>

          {/* Verified Complainant Incident Location Box */}
          <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-foreground font-medium">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="break-words leading-tight">{selectedIncident.street_name || 'San Andres, Cainta'}</span>
            </div>
            {selectedIncident.address_details && (
              <p className="pl-6 text-[11px] text-muted-foreground italic leading-relaxed">
                "{selectedIncident.address_details}"
              </p>
            )}
            {selectedIncident.zone && (
              <div className="pl-6 text-[11px] text-muted-foreground">
                Zone / Sector: <strong className="text-foreground">{selectedIncident.zone}</strong>
              </div>
            )}
            <div className="pl-6 font-mono text-[10px] text-muted-foreground/80 flex items-center gap-1">
              <Compass className="h-3 w-3 shrink-0" />
              <span>
                {Number(selectedIncident.latitude).toFixed(6)}, {Number(selectedIncident.longitude).toFixed(6)}
              </span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Date Filed:
            </span>
            <span className="font-medium text-foreground">
              {new Date(selectedIncident.created_at).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>

          {/* Action Link to Full Details */}
          <div className="mt-4 pt-3 border-t border-border/60">
            <Link
              to={`/complaints/${selectedIncident.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
            >
              <span>View Complaint Details</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      )}

      {/* Empty State Banner if 0 complaints */}
      {!loading && validComplaints.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 top-16 z-[30] flex justify-center">
          <div className="rounded-xl border border-border/80 bg-card/95 px-4 py-2.5 text-center text-xs text-muted-foreground shadow-lg backdrop-blur-md">
            <span className="font-semibold text-foreground">No active incident dots yet.</span> Complaints filed with verified official incident addresses will be pinned here.
          </div>
        </div>
      )}

      {/* Floating Legend (Positioned Bottom-Left to avoid colliding with Notification & Messages Panels) */}
      <div className="pointer-events-auto absolute bottom-4 left-4 z-[30] max-w-[270px] rounded-2xl border border-border/80 bg-card/95 p-3 text-[11px] shadow-xl backdrop-blur-md transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/85">
            Incident Severity Dots
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
            <div className="flex items-center space-x-2 text-foreground/90">
              <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: '#dc2626' }} />
              <span className="font-semibold text-red-600 dark:text-red-400">Red (Urgent)</span>
              <span className="text-[10px] text-muted-foreground">— Safety, ASB, Crime</span>
            </div>
            <div className="flex items-center space-x-2 text-foreground/90">
              <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: '#ea580c' }} />
              <span className="font-semibold text-orange-600 dark:text-orange-400">Orange (High)</span>
              <span className="text-[10px] text-muted-foreground">— Waste, Hazards, Utilities</span>
            </div>
            <div className="flex items-center space-x-2 text-foreground/90">
              <span className="inline-block h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: '#ca8a04' }} />
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">Yellow (Standard)</span>
              <span className="text-[10px] text-muted-foreground">— Noise, Blight, Nuisance</span>
            </div>
            {filteredComplaints.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                Displaying <strong>{filteredComplaints.length}</strong> pinned incident location{filteredComplaints.length === 1 ? '' : 's'}. Click any pin to open full info on the right side.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
