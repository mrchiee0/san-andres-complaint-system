import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SanAndresMap from '../components/SanAndresMap';
import BarangayHotspotMap, { ZoneStats } from '../components/BarangayHotspotMap';
import BarangayIncidentPinMap, { IncidentDot } from '../components/BarangayIncidentPinMap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { MapPinned, Map, Layers, ShieldCheck, Database, Info, MapPin } from 'lucide-react';
import { safeJson } from '../lib/utils';
import { sanAndresAreas } from '../data/sanAndresPlaces';
import { COMPLAINT_HEATMAP_LEVELS } from '../lib/complaintHeatmap';
import { useAuth } from '../hooks/useAuth';

export default function SanAndresMapPage() {
  const { token } = useAuth();
  const [zones, setZones] = useState<ZoneStats[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [incidentDots, setIncidentDots] = useState<IncidentDot[]>([]);
  const [dotsLoading, setDotsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const placeId = searchParams.get('place');
  const zoneName = searchParams.get('zone');
  const focusPlace = zones.find((zone) => zone.name === zoneName) || sanAndresAreas.find((area) => area.id === placeId);

  useEffect(() => {
    fetch('/api/complaint-zones?include_empty=1')
      .then(safeJson)
      .then((data) => {
        if (Array.isArray(data)) {
          setZones(data);
        }
      })
      .catch((err) => console.error('Error fetching complaint zones for map:', err))
      .finally(() => setZonesLoading(false));

    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const loadIncidentDots = async () => {
      try {
        let dots: IncidentDot[] = [];
        // Try /api/incident-dots first
        const res = await fetch('/api/incident-dots', { headers });
        const data = await safeJson(res);
        if (Array.isArray(data) && data.length > 0) {
          dots = data;
        } else {
          // Fallback to /api/complaint-dots
          const res2 = await fetch('/api/complaint-dots', { headers });
          const data2 = await safeJson(res2);
          if (Array.isArray(data2) && data2.length > 0) {
            dots = data2;
          } else {
            // Fallback to /api/stats
            const res3 = await fetch('/api/stats', { headers });
            const data3 = await safeJson(res3);
            if (Array.isArray(data3?.activeComplaintDots)) {
              dots = data3.activeComplaintDots;
            }
          }
        }
        setIncidentDots(dots);
      } catch (err) {
        console.error('Error fetching incident dots:', err);
      } finally {
        setDotsLoading(false);
      }
    };

    void loadIncidentDots();
  }, [token]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Official GIS Map
            </span>
            <span className="text-xs font-semibold text-muted-foreground">PSGC: 0405805014</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif italic font-bold text-foreground">
            San Andres Heatmap
          </h1>
          <p className="text-sm text-muted-foreground">
            Administrative territory & complaint clustering for Barangay San Andres, Cainta, Rizal
          </p>
        </div>
      </div>

      {/* Tabs for Boundary Map vs Incident Clusters */}
      <Tabs defaultValue="hotspots" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/60 p-1 rounded-2xl">
          <TabsTrigger value="boundary" className="flex items-center space-x-2 rounded-xl py-2.5 font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Map className="h-4 w-4 text-emerald-600" />
            <span>Territory & Boundary</span>
          </TabsTrigger>
          <TabsTrigger value="hotspots" className="flex items-center space-x-2 rounded-xl py-2.5 font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <MapPinned className="h-4 w-4 text-amber-600" />
            <span>Heatmap</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Official Administrative Boundary & Inverse Spotlight */}
        <TabsContent value="boundary" className="space-y-6">
          <div className="rounded-[2rem] border border-border/60 bg-card p-4 md:p-6 shadow-xl">
            <SanAndresMap />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 mr-2" />
                  Official Boundary Source
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p><strong>Authority:</strong> Philippine Statistics Authority (PSA) / NAMRIA</p>
                <p><strong>Dataset:</strong> Subnational Administrative Boundaries (COD-AB)</p>
                <p><strong>Coordinate Reference:</strong> WGS84 (EPSG:4326)</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center text-foreground">
                  <Layers className="h-4 w-4 text-blue-600 mr-2" />
                  Territory Spotlight Mask
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p><strong>Technique:</strong> Inverse Polygon Cutout Mask</p>
                <p><strong>Focus:</strong> 100% focused on San Andres perimeter</p>
                <p><strong>Surrounding:</strong> Masked and visually subdued</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center text-foreground">
                  <Database className="h-4 w-4 text-purple-600 mr-2" />
                  Geographic Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p><strong>PSGC 10-Digit:</strong> 0405805014</p>
                <p><strong>P-Code:</strong> PH045805014</p>
                <p><strong>Municipality:</strong> Cainta, Rizal (Region IV-A)</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Incident Hotspots and Sector Clusters */}
        <TabsContent value="hotspots" className="space-y-8">
          {/* Map 1: San Andres Sector Complaint Clustering (Zone Heatmap with child boundaries) */}
          <div className="rounded-[2rem] border border-border/60 bg-card p-4 md:p-6 shadow-xl space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Zone Heatmap
                </span>
                <span className="text-xs text-muted-foreground">Child Boundaries Shaded by Frequency</span>
              </div>
              <h3 className="mt-1 text-lg font-serif italic font-bold text-foreground">
                San Andres Sector Complaint Clustering
              </h3>
              <p className="text-xs text-muted-foreground">
                Displays child zone boundaries within San Andres; each zone changes color dynamically depending on complaints received.
              </p>
            </div>
            <BarangayHotspotMap zones={zones} complaints={incidentDots} focusPlace={focusPlace} zonesLoading={zonesLoading} />
          </div>

          {/* Map 2: New Separate Map - Official Barangay Incident Location Pinpoint Map */}
          <div className="rounded-[2rem] border border-border/60 bg-card p-4 md:p-6 shadow-xl space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Exact Locations
                </span>
                <span className="text-xs text-muted-foreground">Pinned Coordinates From Complainants</span>
              </div>
              <h3 className="mt-1 text-lg font-serif italic font-bold text-foreground">
                Official Barangay Incident Location Pinpoint Map
              </h3>
              <p className="text-xs text-muted-foreground">
                Official mother boundary of Barangay San Andres with exact incident address coordinates plotted as clean, pinned dots colored by severity.
              </p>
            </div>
            <BarangayIncidentPinMap complaints={incidentDots} focusPlace={focusPlace} loading={dotsLoading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center text-foreground">
                  <MapPinned className="h-4 w-4 text-amber-600 mr-2" />
                  Complaint Hotspot Legend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                {COMPLAINT_HEATMAP_LEVELS.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-foreground">{item.label}</span>
                    </div>
                    <span>{item.description}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center text-foreground">
                  <Info className="h-4 w-4 text-blue-600 mr-2" />
                  Top Complaint Zones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                {(zones || []).filter((zone) => Number(zone.complaint_count || 0) > 0).slice(0, 5).map((zone) => (
                  <div key={zone.name} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                    <span className="font-semibold text-foreground">{zone.name}</span>
                    <span>{zone.complaint_count ?? 0} cases</span>
                  </div>
                ))}
                {!zonesLoading && zones.filter((zone) => Number(zone.complaint_count || 0) > 0).length === 0 && <p className="rounded-lg border border-dashed border-border p-4">No complaints have been filed in zones yet.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
