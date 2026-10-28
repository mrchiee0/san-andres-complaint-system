import React from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { BoundaryMatch } from '../services/boundaryGeometry';
import { LocateFixed } from 'lucide-react';

export type LocationSelection = {
  latitude: number;
  longitude: number;
  matches: BoundaryMatch[];
  boundaries: Record<string, BoundaryMatch>;
};

function ClickToSelect({ onPick, value }: {
  onPick: (latitude: number, longitude: number) => void;
  value?: Pick<LocationSelection, 'latitude' | 'longitude'> | null;
}) {
  const map = useMap();
  React.useEffect(() => {
    if (value) map.setView([value.latitude, value.longitude], Math.max(map.getZoom(), 15));
  }, [map, value?.latitude, value?.longitude]);

  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

export default function MapLocationPicker({
  value,
  onChange,
  heightClass = 'h-64',
}: {
  value?: Pick<LocationSelection, 'latitude' | 'longitude'> | null;
  onChange: (selection: LocationSelection) => void;
  heightClass?: string;
}) {
  const [locationError, setLocationError] = React.useState('');
  const initializedLocation = React.useRef(false);
  const initialCenter = React.useRef<L.LatLngExpression>(value ? [value.latitude, value.longitude] : [14.568, 121.108]).current;
  const markerIcon = React.useMemo(() => L.divIcon({
    className: '',
    html: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" aria-hidden="true"><path fill="#b91c1c" stroke="white" stroke-width="2" d="M16 1C7.7 1 1 7.7 1 16c0 11 15 23 15 23s15-12 15-23C31 7.7 24.3 1 16 1z"/><circle cx="16" cy="16" r="5" fill="white"/></svg>',
    iconSize: [32, 40],
    iconAnchor: [16, 39],
  }), []);

  const pick = (latitude: number, longitude: number) => {
    initializedLocation.current = true;
    setLocationError('');
    onChange({ latitude, longitude, matches: [], boundaries: {} });
  };

  React.useEffect(() => {
    if (value && !initializedLocation.current) void pick(value.latitude, value.longitude);
  }, [value?.latitude, value?.longitude]);

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Device location is not available in this browser.');
      return;
    }
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => pick(coords.latitude, coords.longitude),
      (error) => setLocationError(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can still pin the map or enter the address.'
          : 'Unable to get your device location. You can still pin the map or enter the address.'
      ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return <div className="overflow-hidden rounded-md border border-border">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">Tap the map to place a pin, or drag the pin to the incident location.</p>
      <button type="button" onClick={useDeviceLocation} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted">
        <LocateFixed className="h-4 w-4" /> Use my device location
      </button>
    </div>
    <div className="relative">
      <MapContainer center={initialCenter} zoom={15} scrollWheelZoom className={`${heightClass} w-full`}>
        <TileLayer
          attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <ClickToSelect onPick={pick} value={value} />
        {value && <Marker
          position={[value.latitude, value.longitude]}
          icon={markerIcon}
          draggable
          eventHandlers={{ dragend: (event) => {
            const position = event.target.getLatLng();
            pick(position.lat, position.lng);
          } }}
        />}
      </MapContainer>
    </div>
    <div className="space-y-1 border-t border-border bg-card px-3 py-2 text-xs">
      <p className="text-muted-foreground">Pinning is optional. You can also enter the exact address above.</p>
      {locationError && <p role="status" className="text-destructive">{locationError}</p>}
      {value && <p className="text-muted-foreground">Pinned coordinates: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</p>}
    </div>
  </div>;
}