import React from 'react';
import L from 'leaflet';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import 'leaflet/dist/leaflet.css';
import { Activity, Check, ChevronDown, CircleHelp, Edit3, MapPinned, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { safeJson } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

type BoundaryType = { id: number; name: string; color: string };
type BoundaryRecord = {
  id: number;
  name: string;
  code: string | null;
  type_id: number;
  type_name: string;
  type_color: string;
  parent_id: number | null;
  parent_name: string | null;
  geometry: GeoJSON.Geometry;
  color: string;
  fill_color: string;
  fill_opacity: number;
  border_width: number;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

type EditorForm = {
  name: string;
  code: string;
  type_id: string;
  parent_id: string;
  color: string;
  fill_color: string;
  fill_opacity: string;
  border_width: string;
  description: string;
};

const emptyForm: EditorForm = {
  name: '', code: '', type_id: '', parent_id: '', color: '#2563eb', fill_color: '#2563eb',
  fill_opacity: '0.15', border_width: '2', description: '',
};

function toGeometry(layers: L.GeoJSON): GeoJSON.Geometry {
  const features = (layers.toGeoJSON() as GeoJSON.FeatureCollection).features;
  const geometries = features.map((feature) => feature.geometry).filter(Boolean);
  if (geometries.length === 1) return geometries[0];
  const polygons = geometries.flatMap((geometry) => geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : []);
  return { type: 'MultiPolygon', coordinates: polygons };
}

async function saveWithOverlapConfirmation(url: string, init: RequestInit, payload: Record<string, unknown>) {
  const send = (allowOverlap: boolean) => fetch(url, {
    ...init,
    body: JSON.stringify({ ...payload, ...(allowOverlap ? { allow_overlap: true } : {}) }),
  });
  let response = await send(false);
  let data = await safeJson(response);
  if (response.status === 409 && Array.isArray(data.overlaps)) {
    const names = data.overlaps.map((item: { name: string }) => item.name).join(', ');
    if (!window.confirm(`${data.error}\n\nOverlapping boundaries: ${names}\n\nSave anyway?`)) {
      throw new Error('Boundary save cancelled.');
    }
    response = await send(true);
    data = await safeJson(response);
  }
  return { response, data };
}

function BoundaryLayers({
  boundaries,
  selectedId,
  drawKey,
  onSelect,
  onDrawn,
  onReady,
}: {
  boundaries: BoundaryRecord[];
  selectedId: number | null;
  drawKey: number;
  onSelect: (id: number) => void;
  onDrawn: (geometry: GeoJSON.Geometry) => void;
  onReady: (map: L.Map, layers: Map<number, L.GeoJSON>) => void;
}) {
  const map = useMap();
  const layersRef = React.useRef(new Map<number, L.GeoJSON>());
  const lastDrawKey = React.useRef(drawKey);

  React.useEffect(() => {
    map.pm.addControls({
      position: 'topleft', drawMarker: false, drawCircle: false, drawCircleMarker: false,
      drawPolyline: false, drawRectangle: false, drawText: false, drawPolygon: false,
      editMode: false, dragMode: false, removalMode: false, cutPolygon: false, rotateMode: false,
    });
    const handleCreated = (event: any) => {
      const geometry = event.layer.toGeoJSON().geometry as GeoJSON.Geometry;
      map.removeLayer(event.layer);
      onDrawn(geometry);
    };
    map.on('pm:create', handleCreated);
    map.whenReady(() => map.invalidateSize());
    onReady(map, layersRef.current);
    return () => {
      map.off('pm:create', handleCreated);
      map.pm.removeControls();
    };
  }, [map, onDrawn, onReady]);

  React.useEffect(() => {
    if (drawKey !== lastDrawKey.current) {
      lastDrawKey.current = drawKey;
      if (drawKey > 0) map.pm.enableDraw('Polygon', { allowSelfIntersection: false, snappable: true });
      else map.pm.disableDraw();
    }
  }, [drawKey, map]);

  React.useEffect(() => {
    for (const layer of layersRef.current.values()) map.removeLayer(layer);
    layersRef.current.clear();

    boundaries.forEach((boundary) => {
      const group = L.geoJSON({ type: 'Feature', properties: {}, geometry: boundary.geometry } as GeoJSON.Feature, {
        style: {
          color: boundary.color,
          weight: Number(boundary.border_width),
          opacity: boundary.status === 'active' ? 1 : 0.55,
          fillColor: boundary.fill_color,
          fillOpacity: boundary.status === 'active' ? Number(boundary.fill_opacity) : 0.04,
          dashArray: boundary.status === 'inactive' ? '5 5' : undefined,
        },
      }).addTo(map);
      group.eachLayer((layer) => {
        layer.bindTooltip(boundary.name, {
          permanent: true, direction: 'center', className: 'boundary-map-label',
        });
        layer.on('click', () => onSelect(boundary.id));
      });
      layersRef.current.set(boundary.id, group);
    });
    onReady(map, layersRef.current);

    return () => {
      for (const layer of layersRef.current.values()) map.removeLayer(layer);
      layersRef.current.clear();
    };
  }, [boundaries, map, onReady, onSelect]);

  React.useEffect(() => {
    const selected = selectedId ? layersRef.current.get(selectedId) : null;
    if (selected) {
      const bounds = selected.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 18 });
    }
  }, [map, selectedId, boundaries]);

  return null;
}

export default function BoundaryManagement() {
  const { token, user } = useAuth();
  const [boundaries, setBoundaries] = React.useState<BoundaryRecord[]>([]);
  const [types, setTypes] = React.useState<BoundaryType[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [geometryDraft, setGeometryDraft] = React.useState<GeoJSON.Geometry | null>(null);
  const [form, setForm] = React.useState<EditorForm>(emptyForm);
  const [drawKey, setDrawKey] = React.useState(0);
  const [drawing, setDrawing] = React.useState(false);
  const [shapeEditing, setShapeEditing] = React.useState(false);
  const [shapeMoveMode, setShapeMoveMode] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [newTypeName, setNewTypeName] = React.useState('');
  const [newTypeColor, setNewTypeColor] = React.useState('#2563eb');
  const mapContext = React.useRef<{ map: L.Map; layers: Map<number, L.GeoJSON> } | null>(null);

  const load = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [boundaryResponse, typeResponse] = await Promise.all([
        fetch('/api/admin/boundaries', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/boundaries/types'),
      ]);
      const [boundaryData, typeData] = await Promise.all([safeJson(boundaryResponse), safeJson(typeResponse)]);
      if (typeResponse.ok) setTypes(Array.isArray(typeData) ? typeData : []);
      if (!boundaryResponse.ok) throw new Error(boundaryData.error || 'Unable to load boundaries.');
      if (!typeResponse.ok) throw new Error(typeData.error || 'Unable to load boundary types.');
      setBoundaries(Array.isArray(boundaryData) ? boundaryData : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load boundaries.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    if (!types.length || form.type_id || (!drawing && !geometryDraft)) return;
    const firstType = types[0];
    setForm((current) => ({ ...current, type_id: String(firstType.id), color: firstType.color, fill_color: firstType.color }));
  }, [types, form.type_id, drawing, geometryDraft]);

  const selectedBoundary = boundaries.find((boundary) => boundary.id === selectedId) || null;
  const filteredBoundaries = React.useMemo(() => boundaries.filter((boundary) =>
    (statusFilter === 'all' || boundary.status === statusFilter) &&
    (typeFilter === 'all' || String(boundary.type_id) === typeFilter) &&
    `${boundary.name} ${boundary.code || ''} ${boundary.type_name}`.toLowerCase().includes(search.toLowerCase())
  ), [boundaries, search, statusFilter, typeFilter]);

  const handleMapReady = React.useCallback((map: L.Map, layers: Map<number, L.GeoJSON>) => {
    mapContext.current = { map, layers };
  }, []);
  const handleSelect = React.useCallback((id: number) => setSelectedId(id), []);
  const handleDrawn = React.useCallback((geometry: GeoJSON.Geometry) => {
    const firstType = types[0];
    setGeometryDraft(geometry);
    setEditingId(null);
    setShapeEditing(false);
    setForm({
      ...emptyForm,
      type_id: firstType ? String(firstType.id) : '',
      color: firstType?.color || emptyForm.color,
      fill_color: firstType?.color || emptyForm.fill_color,
    });
    setDrawing(false);
    setSelectedId(null);
  }, [types]);

  const startDrawing = () => {
    if (!user || user.role !== 'admin') return;
    if (loading || types.length === 0) {
      toast.error('Boundary types are still loading or unavailable. Try again shortly.');
      return;
    }
    setEditingId(null);
    setGeometryDraft(null);
    setForm({ ...emptyForm, type_id: String(types[0].id), color: types[0].color, fill_color: types[0].color });
    setDrawing(true);
    setDrawKey((current) => current + 1);
  };

  const startEdit = (boundary: BoundaryRecord) => {
    setSelectedId(boundary.id);
    setEditingId(boundary.id);
    setGeometryDraft(boundary.geometry);
    setForm({
      name: boundary.name,
      code: boundary.code || '',
      type_id: String(boundary.type_id),
      parent_id: boundary.parent_id ? String(boundary.parent_id) : '',
      color: boundary.color,
      fill_color: boundary.fill_color,
      fill_opacity: String(boundary.fill_opacity),
      border_width: String(boundary.border_width),
      description: boundary.description || '',
    });
  };

  const cancelEdits = () => {
    const restoreSavedShape = shapeEditing;
    setEditingId(null);
    setGeometryDraft(null);
    setShapeEditing(false);
    setShapeMoveMode(false);
    setDrawing(false);
    setDrawKey(0);
    setForm(emptyForm);
    if (mapContext.current) {
      mapContext.current.map.pm.disableDraw();
      if (selectedId) mapContext.current.layers.get(selectedId)?.eachLayer((layer: any) => {
        layer.pm?.disable();
        layer.pm?.disableLayerDrag();
      });
    }
    if (restoreSavedShape) void load();
  };

  const saveBoundary = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !geometryDraft || !form.name.trim() || !form.type_id) {
      toast.error('Draw a polygon and enter its name and type before saving.');
      return;
    }
    setSaving(true);
    try {
      const { response, data } = await saveWithOverlapConfirmation(editingId ? `/api/boundaries/${editingId}` : '/api/boundaries', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }, { ...form, type_id: Number(form.type_id), parent_id: form.parent_id || null, geometry: geometryDraft });
      if (!response.ok) throw new Error(data.error || 'Unable to save this boundary.');
      toast.success(editingId ? 'Boundary details saved.' : 'Boundary created.');
      setSelectedId(data.id || editingId);
      cancelEdits();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save this boundary.');
    } finally {
      setSaving(false);
    }
  };

  const editShape = () => {
    if (!selectedId || !mapContext.current) return;
    const group = mapContext.current.layers.get(selectedId);
    if (!group) return;
    group.eachLayer((layer: any) => layer.pm?.enable({ allowSelfIntersection: false }));
    setShapeEditing(true);
  };

  const saveShape = async () => {
    if (!selectedId || !token || !mapContext.current) return;
    const group = mapContext.current.layers.get(selectedId);
    if (!group) return;
    setSaving(true);
    try {
      const geometry = toGeometry(group);
      const { response, data } = await saveWithOverlapConfirmation(`/api/boundaries/${selectedId}/geometry`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }, { geometry });
      if (!response.ok) throw new Error(data.error || 'Unable to save the edited shape.');
      group.eachLayer((layer: any) => {
        layer.pm?.disable();
        layer.pm?.disableLayerDrag();
      });
      setShapeEditing(false);
      setShapeMoveMode(false);
      toast.success('Boundary shape saved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the edited shape.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (boundary: BoundaryRecord, status: 'active' | 'inactive') => {
    if (!token) return;
    if (!window.confirm(`${status === 'active' ? 'Activate' : 'Deactivate'} ${boundary.name}?`)) return;
    try {
      const response = await fetch(`/api/boundaries/${boundary.id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.children?.length
        ? `${data.error} Children: ${data.children.map((child: { name: string }) => child.name).join(', ')}`
        : data.error || 'Unable to update this boundary.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update this boundary.');
    }
  };

  const archiveBoundary = async (boundary: BoundaryRecord) => {
    if (!token || !window.confirm(`Archive "${boundary.name}"? This may affect locations assigned to it. Child boundaries must be deactivated first.`)) return;
    try {
      const response = await fetch(`/api/boundaries/${boundary.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.children?.length
        ? `${data.error} Children: ${data.children.map((child: { name: string }) => child.name).join(', ')}`
        : data.error || 'Unable to archive this boundary.');
      toast.success(data.message || 'Boundary archived.');
      setSelectedId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to archive this boundary.');
    }
  };

  const saveType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !newTypeName.trim()) return;
    try {
      const response = await fetch('/api/boundaries/types', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newTypeName.trim(), color: newTypeColor }),
      });
      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to add this boundary type.');
      setNewTypeName('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add this boundary type.');
    }
  };

  if (user?.role !== 'admin') return <div className="p-8 text-sm text-muted-foreground">Administrator access is required.</div>;

  return (
    <div className="space-y-5 p-4 md:p-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">Geographic data</p>
          <h1 className="mt-1 text-2xl font-semibold">Boundary management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Draw and maintain geographic areas used for location classification.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {drawing && <span className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm text-amber-900"><Activity size={15} /> Drawing boundary</span>}
          <Button type="button" onClick={startDrawing} disabled={saving || drawing || loading || types.length === 0} className="gap-2"><Plus size={16} /> Draw polygon</Button>
          {(drawing || geometryDraft || shapeEditing) && <Button type="button" variant="outline" onClick={cancelEdits} className="gap-2"><X size={16} /> Cancel</Button>}
          {shapeEditing && <Button type="button" onClick={() => void saveShape()} disabled={saving} className="gap-2"><Check size={16} /> Save shape</Button>}
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><MapPinned size={17} className="text-emerald-700" /> Boundary map</div>
            <p className="text-xs text-muted-foreground">{drawing ? 'Click map points to draw; finish the polygon by closing its ring.' : 'Select a shape to inspect or edit it.'}</p>
          </div>
          <div className="relative h-[min(68vh,680px)] min-h-[390px]">
            <MapContainer center={[14.568, 121.108]} zoom={14} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              <BoundaryLayers boundaries={filteredBoundaries} selectedId={selectedId} drawKey={drawKey} onSelect={handleSelect} onDrawn={handleDrawn} onReady={handleMapReady} />
              {geometryDraft && !editingId && <GeoJSON data={{ type: 'Feature', properties: {}, geometry: geometryDraft } as GeoJSON.Feature} style={{ color: form.color, weight: 3, fillColor: form.fill_color, fillOpacity: Number(form.fill_opacity) }} />}
            </MapContainer>
            {filteredBoundaries.length === 0 && !loading && <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center"><p className="rounded-md bg-card/95 px-4 py-2 text-sm text-muted-foreground shadow">No boundaries match the current filters.</p></div>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3">
            <span className="text-xs font-semibold">Legend</span>
            {types.map((type) => <span key={type.id} className="flex items-center gap-1.5 text-xs text-muted-foreground"><i className="h-3 w-3 rounded-sm border" style={{ background: `${type.color}40`, borderColor: type.color }} />{type.name}</span>)}
          </div>
        </section>

        <aside className="space-y-4">
          {(geometryDraft || editingId) && !shapeEditing && <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{editingId ? 'Edit boundary' : 'New boundary'}</h2><button type="button" onClick={cancelEdits} aria-label="Close boundary editor" className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button></div>
            <form onSubmit={saveBoundary} className="space-y-3">
              <label className="block text-xs font-medium">Name<Input className="mt-1" maxLength={150} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Block 4" /></label>
              <label className="block text-xs font-medium">Type<select required value={form.type_id} onChange={(event) => { const type = types.find((item) => String(item.id) === event.target.value); setForm({ ...form, type_id: event.target.value, color: type?.color || form.color, fill_color: type?.color || form.fill_color }); }} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">{types.length ? 'Select boundary type' : 'No types available'}</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
              <label className="block text-xs font-medium">Boundary code <Input className="mt-1" maxLength={64} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Optional" /></label>
              <label className="block text-xs font-medium">Parent boundary<select value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">No parent</option>{boundaries.filter((item) => item.id !== editingId && item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name} ({item.type_name})</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium">Border color<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="mt-1 h-10 w-full cursor-pointer rounded-md border border-input bg-background p-1" /></label>
                <label className="block text-xs font-medium">Fill color<input type="color" value={form.fill_color} onChange={(event) => setForm({ ...form, fill_color: event.target.value })} className="mt-1 h-10 w-full cursor-pointer rounded-md border border-input bg-background p-1" /></label>
                <label className="block text-xs font-medium">Fill opacity<input type="range" min="0" max="0.7" step="0.01" value={form.fill_opacity} onChange={(event) => setForm({ ...form, fill_opacity: event.target.value })} className="mt-2 block w-full accent-emerald-700" /><span className="text-muted-foreground">{Math.round(Number(form.fill_opacity) * 100)}%</span></label>
                <label className="block text-xs font-medium">Border width<input type="number" min="0.5" max="8" step="0.5" value={form.border_width} onChange={(event) => setForm({ ...form, border_width: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" /></label>
              </div>
              <label className="block text-xs font-medium">Description<textarea maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
              <Button type="submit" disabled={saving} className="w-full gap-2"><Check size={16} />{saving ? 'Saving…' : 'Save boundary'}</Button>
            </form>
          </section>}

          {shapeEditing && <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-semibold">Shape editing</h2><p className="mt-1">Move vertices, add or remove points, or move the whole shape. Changes are not stored until saved.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant={shapeMoveMode ? 'default' : 'outline'} onClick={() => { if (!mapContext.current || !selectedId) return; const group = mapContext.current.layers.get(selectedId); if (!group) return; group.eachLayer((layer: any) => { if (shapeMoveMode) { layer.pm?.disableLayerDrag(); layer.pm?.enable({ allowSelfIntersection: false }); } else { layer.pm?.disable(); layer.pm?.enableLayerDrag(); } }); setShapeMoveMode(!shapeMoveMode); }}>Move shape</Button><Button type="button" size="sm" onClick={() => void saveShape()} disabled={saving} className="gap-2"><Check size={15} /> Save shape</Button><Button type="button" size="sm" variant="outline" onClick={cancelEdits} className="gap-2"><RotateCcw size={15} /> Cancel shape</Button></div></section>}

          {!geometryDraft && !editingId && selectedBoundary && <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase text-muted-foreground">{selectedBoundary.type_name}</p><h2 className="mt-1 text-lg font-semibold">{selectedBoundary.name}</h2></div><span className="rounded px-2 py-1 text-xs" style={{ color: selectedBoundary.color, backgroundColor: `${selectedBoundary.color}18` }}>{selectedBoundary.status}</span></div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><dt className="text-muted-foreground">Code</dt><dd>{selectedBoundary.code || '—'}</dd><dt className="text-muted-foreground">Parent</dt><dd>{selectedBoundary.parent_name || '—'}</dd><dt className="text-muted-foreground">Created</dt><dd>{new Date(selectedBoundary.created_at).toLocaleDateString()}</dd><dt className="text-muted-foreground">Updated</dt><dd>{new Date(selectedBoundary.updated_at).toLocaleDateString()}</dd></dl>
            {selectedBoundary.description && <p className="mt-3 text-sm text-muted-foreground">{selectedBoundary.description}</p>}
            <div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => startEdit(selectedBoundary)} className="gap-1.5"><Edit3 size={14} /> Edit details</Button><Button type="button" size="sm" variant="outline" onClick={editShape} className="gap-1.5"><MapPinned size={14} /> Edit shape</Button><Button type="button" size="sm" variant="outline" onClick={() => void setStatus(selectedBoundary, selectedBoundary.status === 'active' ? 'inactive' : 'active')}>{selectedBoundary.status === 'active' ? 'Deactivate' : 'Activate'}</Button><Button type="button" size="icon" variant="outline" onClick={() => void archiveBoundary(selectedBoundary)} aria-label={`Archive ${selectedBoundary.name}`} title="Archive boundary"><Trash2 size={14} /></Button></div>
          </section>}

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">Boundary list</h2>
            <div className="mt-3 space-y-2">
              <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search boundaries" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search boundary…" className="pl-9" /></div>
              <div className="grid grid-cols-2 gap-2"><select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs"><option value="all">All types</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs"><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="mt-3 max-h-64 divide-y divide-border overflow-y-auto">
              {loading ? <p className="py-5 text-center text-xs text-muted-foreground">Loading boundaries…</p> : filteredBoundaries.map((boundary) => <button key={boundary.id} type="button" onClick={() => setSelectedId(boundary.id)} className={`flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-muted/50 ${selectedId === boundary.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}><i className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: boundary.color }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{boundary.name}</span><span className="block text-xs text-muted-foreground">{boundary.type_name}{boundary.code ? ` · ${boundary.code}` : ''}</span></span><span className="text-[10px] text-muted-foreground">{boundary.status}</span></button>)}
              {!loading && filteredBoundaries.length === 0 && <p className="py-5 text-center text-xs text-muted-foreground">No matches.</p>}
            </div>
          </section>

          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Configure boundary types<ChevronDown size={15} /></summary>
            <div className="mt-3 space-y-2">{types.map((type) => <div key={type.id} className="flex items-center justify-between text-xs"><span>{type.name}</span><input aria-label={`${type.name} default color`} type="color" value={type.color} onChange={async (event) => { if (!token) return; const response = await fetch(`/api/boundaries/types/${type.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ color: event.target.value }) }); if (response.ok) await load(); else toast.error('Unable to update the type color.'); }} className="h-7 w-9 cursor-pointer rounded border border-input p-0.5" /></div>)}
              <form onSubmit={saveType} className="flex gap-2 border-t border-border pt-3"><Input aria-label="New boundary type" value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} maxLength={64} placeholder="Add type" /><input aria-label="New type color" type="color" value={newTypeColor} onChange={(event) => setNewTypeColor(event.target.value)} className="h-10 w-10 shrink-0 cursor-pointer rounded border border-input p-1" /><Button type="submit" size="icon" aria-label="Add boundary type"><Plus size={16} /></Button></form>
            </div>
          </details>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><CircleHelp size={14} className="mt-0.5 shrink-0" /> Archived boundaries are retained with their geometry and audit history.</p>
        </aside>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Boundary records</h2></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr>{['Name', 'Type', 'Code', 'Parent', 'Color', 'Status', 'Created', 'Updated', 'Actions'].map((label) => <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{filteredBoundaries.map((boundary) => <tr key={boundary.id} className="hover:bg-muted/30"><td className="px-3 py-2 font-medium">{boundary.name}</td><td className="px-3 py-2">{boundary.type_name}</td><td className="px-3 py-2">{boundary.code || '—'}</td><td className="px-3 py-2">{boundary.parent_name || '—'}</td><td className="px-3 py-2"><i className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: boundary.color }} /></td><td className="px-3 py-2">{boundary.status}</td><td className="whitespace-nowrap px-3 py-2">{new Date(boundary.created_at).toLocaleDateString()}</td><td className="whitespace-nowrap px-3 py-2">{new Date(boundary.updated_at).toLocaleDateString()}</td><td className="px-3 py-2"><div className="flex gap-1"><Button type="button" size="icon" variant="ghost" aria-label={`View ${boundary.name}`} title="View on map" onClick={() => setSelectedId(boundary.id)}><MapPinned size={14} /></Button><Button type="button" size="icon" variant="ghost" aria-label={`Edit ${boundary.name}`} title="Edit details" onClick={() => startEdit(boundary)}><Edit3 size={14} /></Button></div></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}