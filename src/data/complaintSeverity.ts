import { COMPLAINT_TAXONOMY } from './complaintTaxonomy';

export type ComplaintSeverity = 'red' | 'orange' | 'yellow';

export const COMPLAINT_SEVERITY: Record<string, ComplaintSeverity> = {
  'Safety Hazards': 'red',
  'Traffic Safety': 'red',
  'Utility Disruptions': 'red',
  'Anti-Social Behavior (ASB)': 'red',
  'Anti-Criminality': 'red',
  'Roads and Sidewalks': 'orange',
  'Street Lighting': 'orange',
  'Waste and Sanitation': 'orange',
  'Pest Control': 'orange',
  'Illegal Parking': 'orange',
  'Noise Complaints': 'yellow',
  'Blight and Maintenance': 'yellow',
  'Zoning and Land Use': 'yellow',
  'Short-Term Rentals': 'yellow',
  'Abandoned Vehicles': 'yellow',
};

export const SEVERITY_INFO: Record<ComplaintSeverity, { label: string; priority: string; color: string; className: string }> = {
  red: { label: 'Red', priority: 'Urgent', color: '#dc2626', className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' },
  orange: { label: 'Orange', priority: 'High', color: '#ea580c', className: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200' },
  yellow: { label: 'Yellow', priority: 'Standard', color: '#ca8a04', className: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200' },
};

export const severityForType = (name: string, category?: string): ComplaintSeverity => {
  if (COMPLAINT_SEVERITY[name]) return COMPLAINT_SEVERITY[name];
  const lower = (name + ' ' + (category || '')).toLowerCase();
  if (
    lower.includes('safety') ||
    lower.includes('traffic safety') ||
    lower.includes('hazard') ||
    lower.includes('crime') ||
    lower.includes('criminality') ||
    lower.includes('asb') ||
    lower.includes('utility') ||
    lower.includes('emergency') ||
    lower.includes('away') ||
    lower.includes('gulo') ||
    lower.includes('disruption')
  ) {
    return 'red';
  }
  if (
    lower.includes('road') ||
    lower.includes('sidewalk') ||
    lower.includes('kalsada') ||
    lower.includes('light') ||
    lower.includes('ilaw') ||
    lower.includes('waste') ||
    lower.includes('basura') ||
    lower.includes('pest') ||
    lower.includes('parking') ||
    lower.includes('paradahan') ||
    lower.includes('traffic')
  ) {
    return 'orange';
  }
  return 'yellow';
};

export const categoryForType = (name: string) => COMPLAINT_TAXONOMY.find((item) => item.name === name)?.category || 'Other';
