import React from 'react';
import L from 'leaflet';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSanAndresBoundary, validateBoundaryFeature } from '../services/barangayBoundaryService';
import type { BoundaryFeature } from '../types/geographic';

function FitBoundary({ feature }: { feature: BoundaryFeature }) {
  const map = useMap();

  React.useEffect(() => {
    const bounds = L.geoJSON(feature as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    }
    map.invalidateSize();
  }, [feature, map]);

  return null;
}

export default function CommunityBoundaryMap() {
  const [feature, setFeature] = React.useState<BoundaryFeature | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    fetchSanAndresBoundary()
      .then((result) => {
        if (!validateBoundaryFeature(result.feature)) {
          throw new Error('The San Andres boundary could not be verified.');
        }
        if (active) setFeature(result.feature);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'The barangay boundary could not be loaded.');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-8 sm:mt-10" aria-labelledby="san-andres-map-title">
      <div className="mb-3 flex flex-col gap-1 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Explore the barangay</p>
          <h3 id="san-andres-map-title" className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">San Andres Map</h3>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">Barangay boundary · Cainta, Rizal</p>
      </div>
      <div
        className="relative h-[280px] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/30 shadow-sm sm:h-[360px] lg:h-[420px]"
        aria-label="Map showing the boundary of Barangay San Andres, Cainta, Rizal"
      >
        {error ? (
          <div role="status" className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : !feature ? (
          <div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading barangay boundary…
          </div>
        ) : (
          <MapContainer
            center={[14.568, 121.108]}
            zoom={14}
            scrollWheelZoom={false}
            className="z-0 h-full w-full"
          >
            <FitBoundary feature={feature} />
            <TileLayer
              attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <GeoJSON
              data={feature as GeoJSON.Feature}
              style={{
                color: '#8B0000',
                weight: 3,
                opacity: 1,
                fillColor: '#8B0000',
                fillOpacity: 0.08,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              onEachFeature={(_, layer) => {
                layer.bindTooltip('Barangay San Andres', { sticky: true });
              }}
            />
          </MapContainer>
        )}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-lg border border-border/60 bg-white/95 px-3 py-2 text-xs font-semibold text-foreground shadow-sm">
          San Andres, Cainta, Rizal
        </div>
      </div>
    </section>
  );
}
