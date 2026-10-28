import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Complaint, ComplaintAuditEntry, MediationAuditEntry, Action, CaseDisposition, ComplaintHistoryEntry, ComplaintStatus } from '../types';
import { Printer, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { LABELS } from '../constants';

interface CaseHistoryProps {
  complaint: Complaint;
  actions: Action[];
  audit: ComplaintAuditEntry[];
  mediationAudit: MediationAuditEntry[];
  dispositions: CaseDisposition[];
  history: ComplaintHistoryEntry[];
}

const actionLabels: Record<string, string> = {
  status_updated: 'Status updated',
  case_resolved: 'Case resolution',
  case_archived: 'Case archived',
  complaint_deleted: 'Complaint moved to recycle bin',
  complaint_restored: 'Complaint restored',
  mediation_eligibility_verified: 'Mediation eligibility verified',
  mediation_eligibility_declined: 'Mediation eligibility declined',
  mediation_scheduled: 'Mediation scheduled',
  mediation_outcome_recorded: 'Mediation proceedings recorded',
  filed: 'Complaint filed',
  edited: 'Complaint details edited',
  administrative_action: 'Administrative action',
  resolved: 'Case resolution',
  archived: 'Case archived',
  certificate_to_file_action_prepared: 'Certificate to File Action prepared',
};

const snapshotLabels: Record<string, string> = {
  uri_ng_reklamo: 'Complaint type',
  category: 'Category',
  complainant_name: 'Complainant',
  complainant_email: 'Complainant email',
  nireklamo_pangalan: 'Person involved',
  nireklamo_email: 'Person involved email',
  detalye: 'Incident details',
  zone: 'Area',
  street_name: 'Address or nearby landmark',
  latitude: 'Latitude',
  longitude: 'Longitude',
  evidence_added: 'Evidence added',
};

const humanizeField = (key: string) => snapshotLabels[key]
  || key.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const formatSnapshot = (rawSnapshot: ComplaintHistoryEntry['snapshot']) => {
  let snapshot: unknown = rawSnapshot;
  if (typeof rawSnapshot === 'string') {
    try {
      snapshot = JSON.parse(rawSnapshot);
    } catch {
      return rawSnapshot;
    }
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return String(snapshot ?? '');

  return Object.entries(snapshot)
    .filter(([key, value]) => !['detected_boundary_ids', 'truthfulness_acknowledged'].includes(key) && value !== null && value !== '')
    .map(([key, value]) => {
      const formattedValue = Array.isArray(value)
        ? value.length ? value.join(', ') : 'None'
        : typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${humanizeField(key)}: ${formattedValue}`;
    })
    .join('\n');
};

const formatMediationDetails = (rawDetails: MediationAuditEntry['details']) => {
  let details: unknown = rawDetails;
  if (typeof rawDetails === 'string') {
    try {
      details = JSON.parse(rawDetails);
    } catch {
      return rawDetails;
    }
  }
  if (!details || typeof details !== 'object' || Array.isArray(details)) return String(details ?? '');
  return Object.entries(details)
    .filter(([key, value]) => key !== 'remarks' && value !== null && value !== '')
    .map(([key, value]) => `${humanizeField(key)}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join('; ');
};

export default function CaseHistory({ complaint, actions, audit, mediationAudit, dispositions, history }: CaseHistoryProps) {
  const { token } = useAuth();
  const [isEmailing, setIsEmailing] = React.useState(false);
  const auditedRemarks = new Set(audit.flatMap((event) => [
    event.remarks,
    `${event.previous_status} → ${event.new_status}: ${event.remarks}`,
  ]));
  const matchedMediationAuditIds = new Set<number>();
  const auditEvents = audit.map((event) => {
    const matchingMediationEvent = mediationAudit.find((mediationEvent) =>
      !matchedMediationAuditIds.has(mediationEvent.id)
      && mediationEvent.action_type === event.action_type
      && Math.abs(new Date(mediationEvent.created_at).getTime() - new Date(event.created_at).getTime()) < 2000
    );
    if (!matchingMediationEvent) return { ...event, id: `audit-${event.id}` };
    matchedMediationAuditIds.add(matchingMediationEvent.id);
    const detailText = formatMediationDetails(matchingMediationEvent.details);
    return {
      ...event,
      id: `audit-${event.id}`,
      remarks: detailText ? `${event.remarks}; ${detailText}` : event.remarks,
    };
  });
  const events = [
    ...(!history.some((event) => event.action_type === 'filed') ? [{
      id: `filed-${complaint.id}`,
      created_at: complaint.created_at,
      action_type: 'filed',
      previous_status: null,
      new_status: 'bago',
      actor: complaint.reporter || 'Resident',
      remarks: 'Complaint filed',
    }] : []),
    ...history.map((event) => ({
      id: `snapshot-${event.id}`,
      created_at: event.created_at,
      action_type: event.action_type,
      previous_status: null,
      new_status: null,
      actor: event.actor,
      remarks: formatSnapshot(event.snapshot),
    })),
    ...auditEvents,
    ...mediationAudit.filter((event) => !matchedMediationAuditIds.has(event.id)).map((event) => ({
      id: `mediation-${event.id}`,
      created_at: event.created_at,
      action_type: event.action_type,
      previous_status: null,
      new_status: null,
      actor: event.actor,
      remarks: formatMediationDetails(event.details),
    })),
    ...dispositions.map((document) => ({
      id: `disposition-${document.id}`,
      created_at: document.disposition_date,
      action_type: document.action_type === 'resolved' ? 'case_resolved' : 'case_archived',
      previous_status: null,
      new_status: null,
      actor: document.staff_name,
      remarks: document.resolution_details,
    })),
    ...actions
      .filter((event) => !auditedRemarks.has(event.paglalarawan))
      .map((event) => ({
        id: `action-${event.id}`,
        created_at: event.petsa,
        action_type: 'administrative_action',
        previous_status: null,
        new_status: null,
        actor: event.actor,
        remarks: event.paglalarawan,
      })),
  ].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

  const emailHistory = async () => {
    if (isEmailing) return;
    setIsEmailing(true);
    try {
      const response = await fetch(`/api/complaints/${complaint.id}/history/email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to email case history.');
      toast.success(result.message || 'Case history emailed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to email case history.');
    } finally {
      setIsEmailing(false);
    }
  };

  const printHistory = () => {
    const cleanup = () => document.body.classList.remove('print-case-history');
    document.body.classList.add('print-case-history');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  return (
    <Card className="case-history-card border-border/50 shadow-xl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/50">
        <div>
          <CardTitle className="text-lg">Official case history</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {complaint.blotter_number || `Case ${complaint.id}`} · Filed {new Date(complaint.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={printHistory}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={emailHistory} disabled={isEmailing}>
            <Mail className="mr-2 h-4 w-4" /> {isEmailing ? 'Sending...' : 'Email statement'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="border-b px-4 py-3">Date and time</th>
              <th className="border-b px-4 py-3">Status change</th>
              <th className="border-b px-4 py-3">Action</th>
              <th className="border-b px-4 py-3">Recorded by</th>
              <th className="border-b px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="align-top">
                <td className="whitespace-nowrap border-b px-4 py-3">{new Date(event.created_at).toLocaleString()}</td>
                <td className="whitespace-nowrap border-b px-4 py-3">
                  {event.previous_status ? LABELS.STATUS[event.previous_status as ComplaintStatus] || event.previous_status : '—'}
                  {event.new_status ? ` → ${LABELS.STATUS[event.new_status as ComplaintStatus] || event.new_status}` : ''}
                </td>
                <td className="border-b px-4 py-3">{actionLabels[event.action_type] || event.action_type.replaceAll('_', ' ')}</td>
                <td className="border-b px-4 py-3">{event.actor}</td>
                <td className="break-words whitespace-pre-wrap border-b px-4 py-3">{event.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {dispositions.length > 0 && (
          <div className="space-y-3 border-t p-4">
            <h3 className="font-semibold">Resolution / archival documentation</h3>
            {dispositions.map((document) => (
              <article key={document.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {document.action_type === 'resolved' ? 'Resolution record' : 'Archival record'} · {new Date(document.disposition_date).toLocaleString()}
                </p>
                <p className="mt-1">Complaint date: {new Date(document.complaint_date).toLocaleString()}</p>
                <p>Responsible staff member: {document.staff_name}</p>
                <p className="mt-2 whitespace-pre-wrap">{document.resolution_details}</p>
                {document.evidence_path && <a className="mt-2 inline-block text-primary underline" href={document.evidence_path} target="_blank" rel="noreferrer">View attachment</a>}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
