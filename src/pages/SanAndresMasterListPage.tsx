import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Pencil, Plus, Trash2, MapPinned, Save, X, Map as MapIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { safeJson } from '../lib/utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import SavedBoundaryOverlay from '../components/SavedBoundaryOverlay';

type ZoneRow = {
  id: number;
  name: string;
  description: string;
  lat: number;
  lng: number;
  color: string;
  is_active: number;
  complaint_count: number;
};

const defaultForm = {
  name: '',
  description: '',
  lat: '',
  lng: '',
};

function ZoneMarker({ zone, selected, onSelect }: { zone: ZoneRow; selected: boolean; onSelect: () => void }) {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      map.flyTo([zone.lat, zone.lng], 16, { duration: 0.8 });
    }
  }, [selected, zone.lat, zone.lng, map]);

  const markerIcon = L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:${selected ? '#0f172a' : '#14b8a6'};border:3px solid white;box-shadow:0 4px 12px rgba(15,23,42,0.25);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  return (
    <Marker position={[zone.lat, zone.lng]} icon={markerIcon} eventHandlers={{ click: onSelect }}>
      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
        <div className="text-xs font-semibold text-slate-900">{zone.name}</div>
      </Tooltip>
      <Popup>
        <div className="space-y-2 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">{zone.name}</div>
          <div>{zone.description || 'Barangay zone'}</div>
          <div>{zone.complaint_count ?? 0} complaints</div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function SanAndresMasterListPage() {
  const { token, user } = useAuth();
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedId) ?? zones[0] ?? null,
    [zones, selectedId]
  );

  const fetchZones = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/complaint-zones', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeJson(res);
      const normalized = Array.isArray(data) ? data.filter((zone) => zone.is_active !== 0) : [];
      setZones(normalized);
      if (!selectedId && normalized[0]) setSelectedId(normalized[0].id);
    } catch (error) {
      console.error('Unable to load zones:', error);
      toast.error('Unable to load barangay zones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchZones();
  }, [token]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.name.trim() || !form.lat || !form.lng) {
      toast.error('Enter a zone name and valid coordinates.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      is_active: 1,
    };

    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/admin/complaint-zones/${editingId}` : '/api/admin/complaint-zones', {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || 'Unable to save zone.');

      toast.success(editingId ? 'Zone updated.' : 'Zone added.');
      resetForm();
      await fetchZones();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save zone.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (zone: ZoneRow) => {
    setEditingId(zone.id);
    setSelectedId(zone.id);
    setForm({
      name: zone.name,
      description: zone.description || '',
      lat: String(zone.lat),
      lng: String(zone.lng),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (zone: ZoneRow) => {
    if (!token) return;
    if (!window.confirm(`Archive ${zone.name}?`)) return;

    try {
      const res = await fetch(`/api/admin/complaint-zones/${zone.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || 'Unable to archive zone.');
      toast.success('Zone archived.');
      setSelectedId((prev) => (prev === zone.id ? null : prev));
      await fetchZones();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to archive zone.');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Barangay Administration</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Barangay Zone</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{zones.length} zones</Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPinned className="h-4 w-4 text-primary" />
              {editingId ? 'Edit barangay zone' : 'Add barangay zone'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zone name</label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Example: Bermai" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Optional description" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latitude</label>
                  <Input type="number" step="0.0001" value={form.lat} onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))} placeholder="14.57" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Longitude</label>
                  <Input type="number" step="0.0001" value={form.lng} onChange={(e) => setForm((prev) => ({ ...prev, lng: e.target.value }))} placeholder="121.10" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" className="gap-2" disabled={saving || !user || user.role !== 'admin'}>
                  {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {saving ? 'Saving...' : editingId ? 'Update zone' : 'Add zone'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" className="gap-2" onClick={resetForm}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapIcon className="h-4 w-4 text-emerald-600" />
              Zone map view
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[480px] w-full overflow-hidden rounded-b-2xl border-t border-border/60">
              <MapContainer center={[14.568, 121.108]} zoom={14} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer
                  attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                />
                <SavedBoundaryOverlay />
                {zones.map((zone) => (
                  <ZoneMarker
                    key={zone.id}
                    zone={zone}
                    selected={selectedZone?.id === zone.id}
                    onSelect={() => setSelectedId(zone.id)}
                  />
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Barangay zone list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Coordinates</th>
                  <th className="px-4 py-3 font-semibold">Complaints</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading zones...</td>
                  </tr>
                ) : zones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No barangay zones yet.</td>
                  </tr>
                ) : (
                  zones.map((zone) => (
                    <tr
                      key={zone.id}
                      className={cn(
                        'border-t border-border/60 transition-colors',
                        selectedZone?.id === zone.id && 'bg-primary/5'
                      )}
                    >
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setSelectedId(zone.id)} className="font-semibold text-foreground hover:text-primary">
                          {zone.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{zone.description || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {Number(zone.lat).toFixed(4)}, {Number(zone.lng).toFixed(4)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={Number(zone.complaint_count) > 0 ? 'default' : 'secondary'}>{zone.complaint_count ?? 0}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="icon" onClick={() => setSelectedId(zone.id)} aria-label={`View ${zone.name}`} title="View on map">
                            <MapPinned className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" onClick={() => handleEdit(zone)} aria-label={`Edit ${zone.name}`} title="Edit zone">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="destructive" size="icon" onClick={() => handleDelete(zone)} aria-label={`Archive ${zone.name}`} title="Archive zone">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
