export type SanAndresAreaType = 'street' | 'subdivision' | 'compound' | 'floodway' | 'facility';
export type SeverityColor = 'red' | 'orange' | 'yellow' | 'green';

export interface SanAndresArea {
  id: string;
  name: string;
  type: SanAndresAreaType;
  color: SeverityColor;
  lat: number;
  lng: number;
  description: string;
}

export const sanAndresAreas: SanAndresArea[] = [
  {
    id: 'midtown-subdivision',
    name: 'Midtown Subdivision',
    type: 'subdivision',
    color: 'red',
    lat: 14.5707,
    lng: 121.1118,
    description: 'High-density residential village within San Andres core area.'
  },
  {
    id: 'felix-subdivision',
    name: 'Felix Subdivision',
    type: 'subdivision',
    color: 'orange',
    lat: 14.5782,
    lng: 121.1154,
    description: 'Local residential cluster in the northwestern sector of San Andres.'
  },
  {
    id: 'greenwood-subdivision',
    name: 'Greenwood Subdivision',
    type: 'subdivision',
    color: 'yellow',
    lat: 14.5582,
    lng: 121.0994,
    description: 'Residential area with moderate complaint activity and regular barangay concerns.'
  },
  {
    id: 'madera-homes-ii',
    name: 'Madera Homes II',
    type: 'subdivision',
    color: 'red',
    lat: 14.5718,
    lng: 121.1061,
    description: 'Floodway-adjacent residential community within the central barangay zone.'
  },
  {
    id: 'mercedes-executive-village',
    name: 'Mercedes Executive Village',
    type: 'subdivision',
    color: 'green',
    lat: 14.5661,
    lng: 121.1048,
    description: 'Lower-activity subdivision cluster within the southern San Andres edge.'
  },
  {
    id: 'nha-floodway',
    name: 'NHA Floodway',
    type: 'floodway',
    color: 'red',
    lat: 14.5738,
    lng: 121.1131,
    description: 'Flood-prone corridor and major local concern area in San Andres.'
  },
  {
    id: 'east-bank-road',
    name: 'East Bank Road',
    type: 'floodway',
    color: 'orange',
    lat: 14.5774,
    lng: 121.1116,
    description: 'Road corridor adjoining floodway and residential sectors.'
  },
  {
    id: 'kabisig-floodway',
    name: 'Kabisig Floodway',
    type: 'floodway',
    color: 'red',
    lat: 14.5751,
    lng: 121.1142,
    description: 'Critical floodway and flood-risk area associated with barangay drainage issues.'
  },
  {
    id: 'a-bonifacio-ave',
    name: 'A. Bonifacio Avenue',
    type: 'street',
    color: 'yellow',
    lat: 14.5694,
    lng: 121.1089,
    description: 'Primary artery traversing the San Andres community.'
  },
  {
    id: 'jp-rizal-street',
    name: 'J.P. Rizal Street',
    type: 'street',
    color: 'orange',
    lat: 14.5671,
    lng: 121.1081,
    description: 'Commercial and residential street link within the barangay core.'
  },
  {
    id: 'ml-quezon-street',
    name: 'M.L. Quezon Street',
    type: 'street',
    color: 'yellow',
    lat: 14.5657,
    lng: 121.1053,
    description: 'Local access street in the central barangay grid.'
  },
  {
    id: 'parola-street',
    name: 'Parola Street',
    type: 'street',
    color: 'yellow',
    lat: 14.5758,
    lng: 121.1144,
    description: 'Street network and residential frontage near the floodway edge.'
  },
  {
    id: 'a-luna-street',
    name: 'A. Luna Street',
    type: 'street',
    color: 'green',
    lat: 14.5682,
    lng: 121.107,
    description: 'Residential and service street with lower complaint concentration.'
  },
  {
    id: 'a-mabini-street',
    name: 'A. Mabini Street',
    type: 'street',
    color: 'green',
    lat: 14.5666,
    lng: 121.1068,
    description: 'Neighborhood street with lower activity but within barangay service area.'
  },
  {
    id: 'a-rodriguez-avenue',
    name: 'A. Rodriguez Avenue',
    type: 'street',
    color: 'orange',
    lat: 14.573,
    lng: 121.1096,
    description: 'Major entry route and service corridor for San Andres communities.'
  },
  {
    id: 'san-andres-barangay-hall',
    name: 'Barangay Hall',
    type: 'facility',
    color: 'green',
    lat: 14.5734,
    lng: 121.1115,
    description: 'Barangay San Andres administrative center and service hub.'
  },
  {
    id: 'pfci-health-center',
    name: 'PFCI Health Center',
    type: 'facility',
    color: 'green',
    lat: 14.5741,
    lng: 121.1128,
    description: 'Primary health service facility serving nearby households.'
  },
  {
    id: 'ynares-covered-court',
    name: 'Ynares Covered Court',
    type: 'facility',
    color: 'yellow',
    lat: 14.5709,
    lng: 121.1097,
    description: 'Covered court and public gathering site in the barangay core.'
  },
  {
    id: 'a-prime-compound',
    name: 'A Prime Compound',
    type: 'compound',
    color: 'orange',
    lat: 14.5726,
    lng: 121.1133,
    description: 'Residential compound area with regular barangay coordination.'
  },
  {
    id: 'policarpio-compound',
    name: 'Policarpio Compound',
    type: 'compound',
    color: 'yellow',
    lat: 14.5752,
    lng: 121.1119,
    description: 'Local residential compound identified in San Andres records.'
  },
  {
    id: 'emerald-compound',
    name: 'Emerald Compound',
    type: 'compound',
    color: 'green',
    lat: 14.5689,
    lng: 121.1076,
    description: 'Smaller community cluster within the barangay network.'
  },
  {
    id: 'maxis-compound',
    name: 'Maxis Compound',
    type: 'compound',
    color: 'yellow',
    lat: 14.5723,
    lng: 121.1102,
    description: 'Community compound located in the central settlement area.'
  },
  {
    id: 'pag-ibig-housing',
    name: 'Pag-IBIG Housing',
    type: 'subdivision',
    color: 'orange',
    lat: 14.5625,
    lng: 121.098,
    description: 'Housing cluster in the southern portion of the barangay.'
  }
];
