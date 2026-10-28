export type Role = 'mamamayan' | 'admin' | 'official';

export type ComplaintStatus = 'bago' | 'sinusuri' | 'naka-assign' | 'iniimbestigahan' | 'naka-iskedyul' | 'sa-mediation' | 'natapos' | 'archived';

export interface User {
  id: number;
  pangalan: string;
  email: string;
  role: Role;
  is_resident: 'Resident' | 'Non Resident';
  account_type?: 'Resident' | 'Non Resident' | 'Administrator';
  profile_completed?: boolean;
}

export interface ComplaintType {
  id: number;
  category: string;
  name: string;
  description: string;
  is_active: number;
  created_at: string;
}

export interface Mediation {
  id: number;
  complaint_id: number;
  petsa: string;
  lokasyon: string;
  detalye: string;
  status: 'naka-iskedyul' | 'tapos' | 'kanselado';
  outcome?: 'settled' | 'referred' | 'dismissed';
  document_path?: string;
  paraan_ng_pagpapadala?: string;
  paraan_detalye?: string;
  minutes?: string;
  attendees?: string;
  assigned_personnel?: string;
  staff_user_id?: number;
  created_at: string;
}

export interface Evidence {
  id: number;
  complaint_id: number;
  file_path: string;
  file_type: string;
  original_name: string;
  created_at: string;
}

export interface Complaint {
  id: number;
  blotter_number?: string;
  user_id: number;
  uri_ng_reklamo: string;
  detalye: string;
  status: ComplaintStatus;
  is_read?: number | boolean;
  assigned_to?: number;
  reporter?: string;
  nireklamo_pangalan?: string;
  nireklamo_email?: string;
  nireklamo_user_id?: number;
  is_resident: 'Resident' | 'Non Resident';
  zone?: string;
  street_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  detected_boundary_ids?: number[] | string | null;
  complainant_name?: string;
  complainant_email?: string;
  is_anonymous?: number | boolean;
  address_details?: string | null;
  truthfulness_acknowledged_at?: string | null;
  edit_count?: number;
  category?: string;
  mediation_eligible?: number | boolean;
  mediation_eligibility_notes?: string | null;
  mediation_eligibility_verified_by?: number | null;
  mediation_eligibility_verified_by_name?: string | null;
  mediation_eligibility_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  evidence?: Evidence[];
  mediation?: Mediation[];
  history?: ComplaintHistoryEntry[];
  audit?: ComplaintAuditEntry[];
  mediationAudit?: MediationAuditEntry[];
  dispositions?: CaseDisposition[];
  witnesses?: Array<{ id: number; pangalan: string; telepono?: string; detalye?: string }>;
  lupon?: Array<{ id: number; pangalan: string; posisyon: string }>;
}

export interface ComplaintAuditEntry {
  id: number;
  complaint_id: number;
  previous_status: ComplaintStatus | null;
  new_status: ComplaintStatus | null;
  action_type: string;
  remarks: string;
  actor: string;
  created_at: string;
}

export interface MediationAuditEntry {
  id: number;
  complaint_id: number;
  schedule_id?: number | null;
  action_type: string;
  details: Record<string, unknown> | string;
  actor: string;
  created_at: string;
}

export interface CaseDisposition {
  id: number;
  complaint_id: number;
  action_type: 'resolved' | 'archived';
  complaint_date: string;
  disposition_date: string;
  staff_name: string;
  resolution_details: string;
  evidence_path?: string | null;
}

export interface ComplaintHistoryEntry {
  id: number;
  complaint_id: number;
  actor_user_id: number;
  actor: string;
  action_type: 'filed' | 'edited';
  snapshot: Record<string, unknown>;
  created_at: string;
}

export interface ComplaintZone {
  id: number;
  name: string;
  source?: 'zone' | 'boundary';
  description: string;
  lat: number;
  lng: number;
  color: string;
  is_active: number;
  complaint_count?: number;
  resolved_count?: number;
  active_count?: number;
}

export interface Action {
  id: number;
  complaint_id: number;
  user_id: number;
  paglalarawan: string;
  actor: string;
  petsa: string;
}

export interface Message {
  id: number;
  complaint_id: number;
  user_id: number;
  mensahe: string;
  sender: string;
  petsa: string;
  nabasa: number;
}
