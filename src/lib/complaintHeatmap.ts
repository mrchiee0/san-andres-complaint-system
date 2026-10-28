export const COMPLAINT_HEATMAP_LEVELS = [
  { label: 'Stable', color: '#16a34a', description: '0 active complaints', min: 0, max: 0 },
  { label: 'Warning', color: '#eab308', description: '1–4 active complaints', min: 1, max: 4 },
  { label: 'High', color: '#f59e0b', description: '5–9 active complaints', min: 5, max: 9 },
  { label: 'Critical', color: '#dc2626', description: '10+ active complaints', min: 10, max: Infinity },
] as const;

export function getComplaintHeatColor(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return COMPLAINT_HEATMAP_LEVELS[0].color;
  return COMPLAINT_HEATMAP_LEVELS.find(({ min, max }) => count >= min && count <= max)?.color
    ?? COMPLAINT_HEATMAP_LEVELS[COMPLAINT_HEATMAP_LEVELS.length - 1].color;
}
