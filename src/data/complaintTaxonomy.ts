export interface ComplaintTaxonomyType {
  category: string;
  name: string;
  description: string;
}

export const COMPLAINT_TAXONOMY: ComplaintTaxonomyType[] = [
  { category: 'Neighborhood & Infrastructure', name: 'Roads and Sidewalks', description: 'Potholes, broken pavements, blocked sidewalks, and missing street signs.' },
  { category: 'Neighborhood & Infrastructure', name: 'Street Lighting', description: 'Broken streetlights, dark alleys, or lights that keep blinking.' },
  { category: 'Neighborhood & Infrastructure', name: 'Utility Disruptions', description: 'Water leaks, power outages, poor drainage, and clogged storm sewers.' },
  { category: 'Environmental & Public Nuisance', name: 'Noise Complaints', description: 'Loud music, late-night parties, construction noise outside legal hours, and persistent barking dogs.' },
  { category: 'Environmental & Public Nuisance', name: 'Waste and Sanitation', description: 'Missed trash collections, illegal dumping, overflowing public bins, and litter.' },
  { category: 'Environmental & Public Nuisance', name: 'Pest Control', description: 'Rodents, stray animals, or mosquito breeding grounds in stagnant water.' },
  { category: 'Property & Zoning Violations', name: 'Blight and Maintenance', description: 'Overgrown lawns, abandoned vehicles, unmaintained properties, and peeling paint or structural damage.' },
  { category: 'Property & Zoning Violations', name: 'Zoning and Land Use', description: 'Unauthorized businesses in residential homes or unapproved building extensions.' },
  { category: 'Property & Zoning Violations', name: 'Short-Term Rentals', description: 'Unregistered short-term rentals causing disruptions or safety concerns.' },
  { category: 'Traffic & Parking', name: 'Illegal Parking', description: 'Vehicles blocking driveways, parking on sidewalks, or occupying fire lanes.' },
  { category: 'Traffic & Parking', name: 'Abandoned Vehicles', description: 'Vehicles left unmoved on public streets for weeks or months.' },
  { category: 'Traffic & Parking', name: 'Traffic Safety', description: 'Speeding in residential areas or requests for speed bumps and crosswalks.' },
  { category: 'Social & Safety Concerns', name: 'Anti-Social Behavior (ASB)', description: 'Loitering, vandalism, graffiti, public intoxication, or neighbor disputes.' },
  { category: 'Social & Safety Concerns', name: 'Safety Hazards', description: 'Dimly lit parks, broken playground equipment, or unsecured construction sites.' },
  { category: 'Social & Safety Concerns', name: 'Anti-Criminality', description: 'Suspicious activity, attempted theft, trespassing, threats, or suspected criminal behavior requiring barangay attention or referral to law enforcement.' },
  { category: 'Others', name: 'Others', description: 'General complaints that do not fit another category.' },
];

export const COMPLAINT_CATEGORIES = [...new Set(COMPLAINT_TAXONOMY.map((item) => item.category))];
