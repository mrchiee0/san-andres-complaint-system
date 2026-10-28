import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { GeoJSON, MapContainer, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchSanAndresBoundary,
  validateBoundaryFeature,
} from '../services/barangayBoundaryService';
import type { BoundaryFeature } from '../types/geographic';
import { ShieldCheck, MapPin, Compass, Maximize2, Minimize2, RotateCcw, AlertTriangle } from 'lucide-react';
import SavedBoundaryOverlay from './SavedBoundaryOverlay';

// Controller to fit bounds and configure pan/zoom constraints
function MapController({ feature, onMapReady }: { feature: BoundaryFeature; onMapReady?: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!feature || !map) return;
    onMapReady?.(map);

    try {
      const geoJsonLayer = L.geoJSON(feature as any);
      const bounds = geoJsonLayer.getBounds();

      if (bounds.isValid()) {
        // Fit view tightly to San Andres
        map.fitBounds(bounds, {
          padding: [24, 24],
          maxZoom: 16,
          animate: true,
        });

        // Restrict user navigation to San Andres plus a small padding
        const paddedBounds = bounds.pad(0.35);
        map.setMaxBounds(paddedBounds);
        map.setMinZoom(13);
        map.options.maxBoundsViscosity = 0.9;
      }
    } catch (e) {
      console.error('Error fitting bounds:', e);
    }

    // Invalidate size after initial render
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(map.getContainer());

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [feature, map, onMapReady]);

  // Handle window/container resize
  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map]);

  return null;
}

export default function SanAndresMap({ showOfficialBoundary = true }: { showOfficialBoundary?: boolean }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [feature, setFeature] = useState<BoundaryFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleMapReady = useCallback((instance: L.Map) => {
    mapInstanceRef.current = instance;
    (window as any).sanAndresMapInstance = instance;
    window.setTimeout(() => instance.invalidateSize(), 150);
  }, []);

  const loadBoundary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchSanAndresBoundary();
      if (!validateBoundaryFeature(result.feature)) {
        throw new Error('Boundary verification failed. Dataset does not match Barangay San Andres, Cainta, Rizal (PSGC: 0405805014).');
      }
      setFeature(result.feature);
    } catch (loadError) {
      const message = loadError instanceof Error && loadError.message
        ? loadError.message
        : 'Barangay San Andres boundary could not be retrieved.';
      setError(message);
      setFeature(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoundary();
  }, [loadBoundary]);

  const handleResetView = () => {
    if (!feature || !mapInstanceRef.current) return;
    try {
      const bounds = L.geoJSON(feature as any).getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [24, 24],
          maxZoom: 16,
          animate: true,
        });
      }
    } catch (e) {
      console.error('Reset view error:', e);
    }
  };

  const handleFullscreenToggle = () => {
    const element = mapContainerRef.current;
    if (!element) return;

    if (!document.fullscreenElement) {
      void element.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const renderMapShell = (overlayContent?: React.ReactNode) => (
    <div className="space-y-4">
      {/* Geographic Metadata Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Barangay', value: 'San Andres', detail: 'Poblacion' },
          { label: 'Municipality', value: 'Cainta', detail: '1st Class' },
          { label: 'Province', value: 'Rizal', detail: 'CALABARZON' },
          { label: 'PSGC Code', value: '0405805014', detail: 'Official PSA Code' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</span>
              <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full dark:bg-emerald-950/50 dark:text-emerald-400">
                {item.detail}
              </span>
            </div>
            <div className="mt-1 text-base font-serif italic font-bold text-foreground">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Map Container Viewport */}
      <div
        ref={mapContainerRef}
        className="relative h-[560px] w-full overflow-hidden rounded-[1.75rem] border border-border/60 bg-slate-950 shadow-xl"
      >
        <MapContainer
          center={[14.568, 121.108]}
          zoom={14}
          scrollWheelZoom
          className="h-full w-full z-0"
        >
          {feature && <MapController feature={feature} onMapReady={handleMapReady} />}
          <TileLayer
            attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />

          {/* Official San Andres Boundary Layer: High-visibility boundary stroke & subtle inside fill */}
          {showOfficialBoundary && feature && (
            <GeoJSON
              key={`boundary-${feature.properties.psgc}`}
              data={feature as any}
              style={{
                color: '#059669', // Emerald-600
                weight: 3.5,
                opacity: 1,
                fillColor: '#10b981', // Emerald-500
                fillOpacity: 0.08,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              onEachFeature={(_, layer) => {
                layer.bindTooltip(
                  `<div style="font-weight: 700; font-size: 13px;">Barangay San Andres</div>
                   <div style="font-size: 11px; color: #64748b;">Cainta, Rizal (PSGC: 0405805014)</div>`,
                  { sticky: true, className: 'san-andres-tooltip' }
                );
              }}
            />
          )}

          <SavedBoundaryOverlay hideSanAndresBoundary={!showOfficialBoundary} />

          {/* Controller to constrain pan/zoom and auto-fit boundary */}
          <ScaleControl position="bottomleft" imperial={false} />
        </MapContainer>

        {/* Status / Loading / Error Overlay */}
        {overlayContent && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
            <div className="pointer-events-auto max-w-md rounded-2xl border border-white/30 bg-card/95 p-6 text-center shadow-2xl backdrop-blur-md">
              {overlayContent}
            </div>
          </div>
        )}

        {/* Floating Top-Left GIS Verification Pill */}
        <div className="pointer-events-none absolute left-4 top-4 z-[400] flex items-center space-x-2 rounded-full border border-border/80 bg-card/90 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>San Andres Geographic Scope</span>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            PSGC 0405805014
          </span>
        </div>

        {/* Floating Top-Right Action Controls */}
        <div className="absolute right-4 top-4 z-[400] flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetView}
            className="flex items-center space-x-1.5 rounded-xl border border-border/80 bg-card/90 px-3 py-2 text-xs font-semibold text-foreground shadow-md backdrop-blur-md transition hover:bg-card hover:scale-105 active:scale-95"
            title="Fit view to Barangay San Andres"
          >
            <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Focus San Andres</span>
          </button>
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="flex items-center space-x-1.5 rounded-xl border border-border/80 bg-card/90 px-3 py-2 text-xs font-semibold text-foreground shadow-md backdrop-blur-md transition hover:bg-card hover:scale-105 active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>

        {/* Floating Bottom-Right Legend */}
        <div className="pointer-events-none absolute bottom-5 right-4 z-[400] rounded-xl border border-border/80 bg-card/90 p-2.5 text-[11px] shadow-lg backdrop-blur-md">
          <div className="flex items-center space-x-2 font-semibold text-foreground">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-emerald-600 bg-emerald-500/30" />
            <span>Barangay Territory (Inside)</span>
          </div>
          <div className="mt-1 flex items-center space-x-2 text-muted-foreground">
            <span className="inline-block h-3 w-3 rounded-full bg-slate-800" />
            <span>Outside Cainta / Nearby Area (Masked)</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return renderMapShell(
      <div className="space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">GIS Verification</p>
        <h3 className="text-lg font-serif italic text-foreground">Loading Barangay San Andres administrative boundary...</h3>
        <p className="text-xs text-muted-foreground">Filtering dataset for PSGC 0405805014 (Cainta, Rizal)</p>
      </div>
    );
  }

  if (error) {
    return renderMapShell(
      <div className="space-y-3">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Boundary Error</p>
        <h3 className="text-lg font-serif italic text-foreground">Unable to load Barangay San Andres boundary</h3>
        <p className="text-xs text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void loadBoundary()}
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
        >
          Retry Verification
        </button>
      </div>
    );
  }

  return renderMapShell();
}

