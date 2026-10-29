import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchSanAndresBoundary,
  validateBoundaryFeature,
  buildInverseMask,
} from '../services/barangayBoundaryService';
import type { BoundaryFeature } from '../types/geographic';
import { severityForType, SEVERITY_INFO } from '../data/complaintSeverity';
import SavedBoundaryOverlay from './SavedBoundaryOverlay';
import { Layers, AlertTriangle, ShieldCheck, HelpCircle, Eye, EyeOff, Filter } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export interface PredictiveHotspotData {
  zone: string;
  latitude: number;
  longitude: number;
  historicalCount: number;
  recentVelocity: number;
  predictedCount: number;
  riskScore: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical' | 'Insufficient Data';
  topCategory: string;
  contributingFactors: string[];
  rationale: string;
  suggestedAction: string;
  responsibleOffice: string;
}

export interface ActualComplaintPoint {
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

const RISK_CONFIG: Record<
  string,
  { label: string; color: string; fillColor: string; badgeClass: string; radius: number }
> = {
  Critical: {
    label: 'Critical Risk',
    color: '#dc2626',
    fillColor: '#ef4444',
    badgeClass: 'bg-red-500/20 text-red-500 border-red-500/30',
    radius: 36,
  },
  High: {
    label: 'High Risk',
    color: '#ea580c',
    fillColor: '#f97316',
    badgeClass: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    radius: 28,
  },
  Moderate: {
    label: 'Moderate Risk',
    color: '#eab308',
    fillColor: '#facc15',
    badgeClass: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    radius: 22,
  },
  Low: {
    label: 'Low Risk',
    color: '#10b981',
    fillColor: '#34d399',
    badgeClass: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
    radius: 16,
  },
  'Insufficient Data': {
    label: 'Insufficient Data',
    color: '#6b7280',
    fillColor: '#9ca3af',
    badgeClass: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    radius: 14,
  },
};

function MapFitter({ feature }: { feature: BoundaryFeature | null }) {
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
        map.setMaxBounds(bounds.pad(0.35));
        map.setMinZoom(13);
      }
    } catch (e) {
      console.error('Error fitting predictive bounds:', e);
    }

    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [feature, map]);

  return null;
}

export default function PredictiveRiskMap({
  hotspots = [],
  complaints = [],
  horizonLabel = 'Next 30 Days',
  onSelectHotspot,
}: {
  hotspots?: PredictiveHotspotData[];
  complaints?: ActualComplaintPoint[];
  horizonLabel?: string;
  onSelectHotspot?: (hotspot: PredictiveHotspotData) => void;
}) {
  const [feature, setFeature] = useState<BoundaryFeature | null>(null);
  const [showActuals, setShowActuals] = useState(true);
  const [showForecasts, setShowForecasts] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchSanAndresBoundary()
      .then((res) => {
        if (isMounted && validateBoundaryFeature(res.feature)) {
          setFeature(res.feature);
        }
      })
      .catch((err) => console.error('Predictive map boundary error:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const maskFeature = useMemo(() => (feature ? buildInverseMask(feature) : null), [feature]);

  // Filtered actual complaints
  const validComplaints = useMemo(
    () =>
      complaints.filter(
        (c) =>
          Number.isFinite(Number(c.latitude)) &&
          Number.isFinite(Number(c.longitude)) &&
          Number(c.latitude) !== 0 &&
          Number(c.longitude) !== 0
      ),
    [complaints]
  );

  // Filtered hotspots by risk
  const filteredHotspots = useMemo(() => {
    if (riskFilter === 'all') return hotspots;
    return hotspots.filter((h) => h.riskLevel.toLowerCase() === riskFilter.toLowerCase());
  }, [hotspots, riskFilter]);

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-2xl border border-border/80 bg-slate-950 shadow-2xl isolate">
      {/* Top Controls Overlay */}
      <div className="absolute top-4 left-4 z-[500] flex flex-wrap items-center gap-2 bg-background/90 backdrop-blur-md p-2 rounded-xl border border-border/60 shadow-lg text-xs">
        <span className="font-semibold text-muted-foreground px-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" /> Map Layers:
        </span>
        <Button
          variant={showForecasts ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowForecasts(!showForecasts)}
        >
          {showForecasts ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          Forecasted Hotspots
        </Button>
        <Button
          variant={showActuals ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowActuals(!showActuals)}
        >
          {showActuals ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          Actual Incident Pins ({validComplaints.length})
        </Button>
        <Button
          variant={showBoundaries ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowBoundaries(!showBoundaries)}
        >
          {showBoundaries ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          Zone Boundaries
        </Button>

        {/* Risk Level Filter */}
        <div className="flex items-center gap-1 ml-2 border-l border-border/60 pl-2">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="h-7 bg-muted/60 border border-border/60 rounded px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="moderate">Moderate Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Forecast Horizon Badge */}
      <div className="absolute top-4 right-4 z-[500] hidden sm:flex items-center gap-2 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/60 shadow-lg text-xs">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span className="text-muted-foreground">Projection Horizon:</span>
        <span className="font-bold text-foreground">{horizonLabel}</span>
      </div>

      <MapContainer
        center={[14.568, 121.108]}
        zoom={14}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        <MapFitter feature={feature} />

        {/* Outside Mask */}
        {maskFeature && (
          <GeoJSON
            key="predictive-mask"
            data={maskFeature}
            interactive={false}
            style={{
              stroke: false,
              color: 'transparent',
              weight: 0,
              fillColor: '#090d16',
              fillOpacity: 0.68,
            }}
          />
        )}

        {/* San Andres Mother Boundary */}
        {feature && (
          <GeoJSON
            key="predictive-mother-boundary"
            data={feature as any}
            style={{
              color: '#059669',
              weight: 3.5,
              opacity: 1,
              fillColor: '#10b981',
              fillOpacity: 0.04,
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

        {/* Child Boundaries */}
        {showBoundaries && (
          <SavedBoundaryOverlay
            zones={hotspots.map((h) => ({ name: h.zone, complaint_count: h.historicalCount }))}
            heatmap={false}
            hideSanAndresBoundary
          />
        )}

        {/* 1. ACTUAL INCIDENT LOCATION PINS */}
        {showActuals &&
          validComplaints.map((c) => {
            const severity = severityForType(c.uri_ng_reklamo, c.category);
            const info = SEVERITY_INFO[severity] || SEVERITY_INFO.yellow;
            const lat = Number(c.latitude);
            const lng = Number(c.longitude);

            return (
              <React.Fragment key={`actual-${c.id}`}>
                <CircleMarker
                  center={[lat, lng]}
                  radius={4.5}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 1.5,
                    fillColor: info.color,
                    fillOpacity: 0.9,
                  }}
                >
                  <Popup autoPan={true} autoPanPadding={[60, 60]}>
                    <div className="min-w-[210px] p-1.5 space-y-1.5 text-xs font-sans">
                      <div className="flex items-center justify-between border-b border-border/50 pb-1">
                        <span className="font-mono font-bold text-[11px] text-foreground">
                          {c.blotter_number || `#${c.id}`}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">
                          ● Actual Incident
                        </span>
                      </div>
                      <p className="font-bold text-foreground text-sm leading-snug">{c.uri_ng_reklamo}</p>
                      {c.category && <p className="text-[10px] text-muted-foreground">{c.category}</p>}
                      <div className="rounded bg-muted/40 p-2 space-y-1 text-[11px]">
                        <p className="text-muted-foreground">
                          <strong className="text-foreground">Zone:</strong> {c.zone || 'San Andres'}
                        </p>
                        <p className="text-muted-foreground">
                          <strong className="text-foreground">Location:</strong> {c.street_name || 'San Andres, Cainta'}
                        </p>
                        <p className="text-muted-foreground">
                          <strong className="text-foreground">Filed:</strong>{' '}
                          {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}

        {/* 2. FORECASTED PREDICTIVE HOTSPOTS */}
        {showForecasts &&
          filteredHotspots.map((hotspot) => {
            const config = RISK_CONFIG[hotspot.riskLevel] || RISK_CONFIG.Moderate;
            const lat = Number(hotspot.latitude);
            const lng = Number(hotspot.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            return (
              <React.Fragment key={`hotspot-${hotspot.zone}`}>
                {/* Outer Pulsing Risk Halo */}
                <CircleMarker
                  center={[lat, lng]}
                  radius={config.radius}
                  pathOptions={{
                    color: config.color,
                    weight: 2,
                    dashArray: '4, 4',
                    fillColor: config.fillColor,
                    fillOpacity: 0.18,
                  }}
                  interactive={false}
                />

                {/* Inner Risk Core Circle */}
                <CircleMarker
                  center={[lat, lng]}
                  radius={Math.max(10, Math.round(config.radius * 0.45))}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2.5,
                    fillColor: config.color,
                    fillOpacity: 0.9,
                  }}
                  eventHandlers={{
                    click: () => onSelectHotspot && onSelectHotspot(hotspot),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div className="text-xs font-sans">
                      <span className="font-bold">{hotspot.zone}</span> &bull;{' '}
                      <span style={{ color: config.color }}>{hotspot.riskLevel}</span>
                      <div className="text-[10px] text-muted-foreground">
                        Predicted: ~{hotspot.predictedCount} complaints
                      </div>
                    </div>
                  </Tooltip>

                  <Popup autoPan={true} autoPanPadding={[60, 60]}>
                    <div className="min-w-[260px] max-w-[300px] p-2 space-y-2.5 text-xs font-sans">
                      <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                        <span className="font-bold text-sm text-foreground">{hotspot.zone}</span>
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold ${config.badgeClass}`}>
                          {config.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/40 p-2 rounded-lg border border-border/40">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Historical Records</span>
                          <span className="font-bold text-foreground text-xs">{hotspot.historicalCount} cases</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Forecasted ({horizonLabel})</span>
                          <span className="font-bold text-primary text-xs">~{hotspot.predictedCount} cases</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Recent Velocity</span>
                          <span className="font-bold text-foreground text-xs">{hotspot.recentVelocity}x rate</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Risk Score</span>
                          <span className="font-bold text-xs" style={{ color: config.color }}>
                            {hotspot.riskScore} / 100
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-foreground text-[11px] block mb-1">
                          Key Contributing Factors:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] text-muted-foreground">
                          {hotspot.contributingFactors.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded bg-primary/10 border border-primary/20 p-2 space-y-1">
                        <span className="font-bold text-primary text-[10px] uppercase block tracking-wider">
                          Recommended Preventive Action:
                        </span>
                        <p className="text-[11px] text-foreground leading-snug">{hotspot.suggestedAction}</p>
                        <span className="text-[10px] text-muted-foreground block mt-1">
                          Lead: {hotspot.responsibleOffice}
                        </span>
                      </div>

                      <p className="text-[9px] text-muted-foreground italic border-t border-border/40 pt-1">
                        *Note: Forecasted hotspots indicate analytical resource prioritization and do not establish wrongdoing.
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
      </MapContainer>

      {/* Floating Collapsible Legend */}
      <div className="absolute bottom-4 left-4 z-[500] max-w-[280px] bg-background/95 backdrop-blur-md rounded-xl border border-border/70 p-3 shadow-xl text-xs">
        <div
          className="flex items-center justify-between cursor-pointer font-bold text-foreground mb-1.5"
          onClick={() => setIsLegendOpen(!isLegendOpen)}
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-primary" /> Map Legend
          </span>
          <span className="text-[10px] text-muted-foreground">{isLegendOpen ? 'Hide' : 'Show'}</span>
        </div>

        {isLegendOpen && (
          <div className="space-y-2 pt-1 border-t border-border/40 text-[11px]">
            <div>
              <span className="font-semibold text-muted-foreground text-[10px] block uppercase tracking-wider mb-1">
                Forecast Hotspots ({horizonLabel})
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
                  <span>Critical Risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
                  <span>High Risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shrink-0" />
                  <span>Moderate Risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Low Risk</span>
                </div>
              </div>
            </div>

            <div className="pt-1.5 border-t border-border/40">
              <span className="font-semibold text-muted-foreground text-[10px] block uppercase tracking-wider mb-1">
                Incident Locations
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="h-2 w-2 rounded-full border border-white bg-blue-500 shrink-0" />
                <span>Verified Historical Complaints</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
