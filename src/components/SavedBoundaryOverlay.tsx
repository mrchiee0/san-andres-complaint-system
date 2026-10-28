import React from 'react';
import L from 'leaflet';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Feature, Geometry } from 'geojson';
import { getComplaintHeatColor } from '../lib/complaintHeatmap';

type SavedBoundary = {
  id: number;
  name: string;
  code?: string | null;
  type_name: string;
  geometry: Geometry;
  color: string;
  fill_color: string;
  fill_opacity: number;
  border_width: number;
};

export default function SavedBoundaryOverlay({ zones = [], heatmap = false, hideSanAndresBoundary = false }: { zones?: Array<{ name: string; complaint_count?: number }>; heatmap?: boolean; hideSanAndresBoundary?: boolean }) {
  const map = useMap();
  const [boundaries, setBoundaries] = React.useState<SavedBoundary[]>([]);

  React.useEffect(() => {
    let active = true;
    fetch('/api/boundaries')
      .then((response) => response.ok ? response.json() : [])
      .then((data) => { if (active && Array.isArray(data)) setBoundaries(data); })
      .catch((error) => console.error('Unable to load mapped boundaries:', error));
    return () => {
      active = false;
    };
  }, [map]);

  return <>
    {boundaries.filter((boundary) => !(hideSanAndresBoundary && boundary.type_name.toLowerCase() === 'barangay' && boundary.name.toLowerCase() === 'barangay san andres')).map((boundary) => {
      const complaintCount = Number(
        zones.find((zone) => zone.name?.trim().toLowerCase() === boundary.name?.trim().toLowerCase())?.complaint_count || 0
      );
      const heatColor = getComplaintHeatColor(complaintCount);
      const baseStyle = {
        color: heatmap ? heatColor : boundary.color,
        weight: heatmap ? Math.max(2, Number(boundary.border_width)) : Number(boundary.border_width),
        opacity: 0.95,
        fillColor: heatmap ? heatColor : boundary.fill_color,
        fillOpacity: heatmap ? 0.3 : Number(boundary.fill_opacity),
      };
      const feature = { type: 'Feature', properties: {}, geometry: boundary.geometry } as Feature<Geometry>;
      return <GeoJSON
        key={`${boundary.id}-${complaintCount}`}
        data={feature}
        style={baseStyle}
        onEachFeature={(_, layer) => {
          layer.bindTooltip(`${escapeHtml(boundary.name)}${complaintCount ? ` · ${complaintCount} complaints` : ''}`, { sticky: true, direction: 'top', className: 'boundary-map-label' });
          layer.bindPopup(`<strong>${escapeHtml(boundary.name)}</strong><br>${escapeHtml(boundary.type_name)}${boundary.code ? `<br>${escapeHtml(boundary.code)}` : ''}${complaintCount ? `<br>${complaintCount} complaints` : ''}`);
          layer.on('mouseover', () => {
            if (layer instanceof L.Path) {
              layer.bringToFront();
              layer.setStyle({ ...baseStyle, weight: baseStyle.weight + 1.5, fillOpacity: heatmap ? 0.45 : baseStyle.fillOpacity });
              layer.getElement()?.classList.add('boundary-polygon-hover');
            }
          });
          layer.on('mouseout', () => {
            if (layer instanceof L.Path) {
              layer.setStyle(baseStyle);
              layer.getElement()?.classList.remove('boundary-polygon-hover');
            }
          });
        }}
      />;
    })}
  </>;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}