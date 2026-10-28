import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
} from 'docx';

export interface CaseReportData {
  complaint: {
    id: number;
    blotter_number?: string;
    uri_ng_reklamo: string;
    category?: string;
    detalye: string;
    status: string;
    is_resident?: string;
    zone?: string;
    street_name?: string;
    latitude?: number | null;
    longitude?: number | null;
    complainant_name?: string;
    reporter?: string;
    complainant_email?: string;
    is_anonymous?: number | boolean;
    created_at: string;
    updated_at: string;
    assigned_to?: number;
    assigned_name?: string;
    nireklamo_pangalan?: string;
  };
  actions?: Array<{
    id: number;
    paglalarawan: string;
    petsa: string;
    actor?: string;
  }>;
  messages?: Array<{
    id: number;
    mensahe: string;
    petsa: string;
    sender?: string;
  }>;
  evidence?: Array<{
    id: number;
    file_path: string;
    file_type?: string;
    original_name?: string;
    created_at?: string;
  }>;
  mediation?: Array<{
    id: number;
    petsa: string;
    lokasyon: string;
    status: string;
    assigned_personnel?: string;
    attendees?: string;
    detalye?: string;
  }>;
  history?: Array<{
    id: number;
    action_type: string;
    snapshot: any;
    actor: string;
    created_at: string;
  }>;
  audit?: Array<{
    id: number;
    previous_status?: string | null;
    new_status?: string | null;
    action_type: string;
    remarks: string;
    actor: string;
    created_at: string;
  }>;
  dispositions?: Array<{
    id: number;
    action_type: string;
    complaint_date: string;
    disposition_date: string;
    staff_name: string;
    resolution_details: string;
    evidence_path?: string | null;
  }>;
  luponMembers?: Array<{
    id: number;
    pangalan: string;
    posisyon: string;
  }>;
  officials?: {
    captainName: string;
    captainTitle: string;
    secretaryName: string;
    secretaryTitle: string;
  };
}

const statusDisplay = (status: string) => {
  const map: Record<string, string> = {
    bago: 'New',
    sinusuri: 'Under Review',
    'naka-assign': 'Assigned',
    iniimbestigahan: 'Under Investigation',
    'naka-iskedyul': 'Scheduled',
    'sa-mediation': 'In Mediation',
    natapos: 'Resolved',
    archived: 'Archived / Closed',
  };
  return map[status] || status;
};

const formatDate = (val?: string | Date | null) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return String(val);
  }
};

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
};

function createKeyValueRow(key: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 3000, type: WidthType.DXA },
        shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
        borders: cellBorders,
        children: [
          new Paragraph({
            children: [new TextRun({ text: key, bold: true, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 6500, type: WidthType.DXA },
        borders: cellBorders,
        children: [
          new Paragraph({
            children: [new TextRun({ text: value || '—', size: 20 })],
          }),
        ],
      }),
    ],
  });
}

function createTableHeader(col1: string, col2: string, col3: string, col4?: string): TableRow {
  const cols = [
    { text: col1, size: col4 ? 2200 : 2500 },
    { text: col2, size: col4 ? 2200 : 2500 },
    { text: col3, size: col4 ? 2500 : 4500 },
  ];
  if (col4) cols.push({ text: col4, size: 2600 });

  return new TableRow({
    tableHeader: true,
    children: cols.map(
      (c) =>
        new TableCell({
          width: { size: c.size, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: c.text, bold: true, color: 'FFFFFF', size: 19 })],
            }),
          ],
        })
    ),
  });
}

export async function generateCaseClosureReportDocx(data: CaseReportData): Promise<Buffer> {
  const { complaint, actions = [], messages = [], evidence = [], mediation = [], history = [], audit = [], dispositions = [], luponMembers = [], officials } = data;

  const blotterNumber = complaint.blotter_number || `CASE-${complaint.id}`;
  const reportRef = `CCR-${new Date().getFullYear()}-${complaint.id}`;
  const isAnonymous = Boolean(complaint.is_anonymous || complaint.complainant_name === 'Anonymous');
  const complainantDisplayName = isAnonymous ? 'Anonymous' : (complaint.complainant_name || complaint.reporter || 'Resident');
  const incidentAddress = [complaint.street_name, complaint.zone, 'Barangay San Andres, Cainta, Rizal'].filter(Boolean).join(', ');

  // Chronological history events
  type ChronoEvent = { date: string; type: string; actor: string; details: string };
  const chronological: ChronoEvent[] = [];

  chronological.push({
    date: complaint.created_at,
    type: 'Complaint Filed',
    actor: isAnonymous ? 'Anonymous' : complainantDisplayName,
    details: `Filed complaint for "${complaint.uri_ng_reklamo}" in category "${complaint.category || 'General'}".`,
  });

  for (const h of history) {
    if (h.action_type !== 'filed') {
      chronological.push({
        date: h.created_at,
        type: `History: ${h.action_type.replace(/_/g, ' ')}`,
        actor: isAnonymous && h.actor === complaint.reporter ? 'Anonymous' : (h.actor || 'System'),
        details: typeof h.snapshot === 'object' ? JSON.stringify(h.snapshot) : String(h.snapshot || ''),
      });
    }
  }

  for (const a of audit) {
    chronological.push({
      date: a.created_at,
      type: `Status Update: ${a.previous_status ? statusDisplay(a.previous_status) + ' → ' : ''}${a.new_status ? statusDisplay(a.new_status) : a.action_type.replace(/_/g, ' ')}`,
      actor: a.actor || 'Staff',
      details: a.remarks || 'Status modified.',
    });
  }

  for (const act of actions) {
    chronological.push({
      date: act.petsa,
      type: 'Administrative Action',
      actor: act.actor || 'Staff',
      details: act.paglalarawan,
    });
  }

  for (const m of mediation) {
    chronological.push({
      date: m.petsa,
      type: `Mediation Proceeding (${m.status})`,
      actor: m.assigned_personnel || 'Lupon Tagapamayapa',
      details: `Scheduled at ${m.lokasyon}. Attendees: ${m.attendees || 'None recorded'}. ${m.detalye ? 'Notes: ' + m.detalye : ''}`,
    });
  }

  for (const msg of messages) {
    chronological.push({
      date: msg.petsa,
      type: 'Recorded Message',
      actor: isAnonymous && msg.sender === complaint.reporter ? 'Anonymous' : (msg.sender || 'Participant'),
      details: msg.mensahe,
    });
  }

  for (const d of dispositions) {
    chronological.push({
      date: d.disposition_date,
      type: `Final Disposition: ${d.action_type === 'resolved' ? 'Case Resolved' : 'Case Archived'}`,
      actor: d.staff_name || 'Staff',
      details: d.resolution_details,
    });
  }

  // Sort chronological events ascending by date
  chronological.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Personnel involved
  const personnelMap = new Map<string, string>();
  if (complaint.assigned_name) personnelMap.set(complaint.assigned_name, 'Assigned Barangay Officer');
  for (const d of dispositions) {
    if (d.staff_name) personnelMap.set(d.staff_name, `Resolving Staff (${d.action_type})`);
  }
  for (const a of audit) {
    if (a.actor && a.actor !== 'System') personnelMap.set(a.actor, 'Reviewing Staff / Case Officer');
  }
  for (const m of mediation) {
    if (m.assigned_personnel) personnelMap.set(m.assigned_personnel, 'Mediation Officer / Presiding Lupon');
  }
  for (const l of luponMembers) {
    personnelMap.set(l.pangalan, l.posisyon || 'Lupon Tagapamayapa Member');
  }

  // Final resolution
  const latestDisposition = dispositions[dispositions.length - 1];

  const captainName = officials?.captainName || 'Hon. Josefina Dela Cruz';
  const captainTitle = officials?.captainTitle || 'Punong Barangay / Lupon Chairperson';
  const secretaryName = officials?.secretaryName || 'Bernardo Ramos';
  const secretaryTitle = officials?.secretaryTitle || 'Barangay / Lupon Secretary';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 },
          },
        },
        children: [
          // Header / Identification
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'REPUBLIC OF THE PHILIPPINES', size: 18, color: '4B5563' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Province of Rizal • Municipality of Cainta', size: 18, color: '4B5563' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'BARANGAY SAN ANDRES', bold: true, size: 28, color: '1E3A8A' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'OFFICE OF THE LUPONG TAGAPAMAYAPA & BARANGAY COMPLAINT DESK', size: 18, bold: true, color: '374151' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 200 },
            children: [
              new TextRun({
                text: 'OFFICIAL CASE RESOLUTION AND CLOSURE REPORT',
                bold: true,
                size: 24,
                underline: {},
                color: '111827',
              }),
            ],
          }),

          // Section 1: Barangay and Report Identification
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '1. Barangay and Report Identification', bold: true, size: 22, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [
              createKeyValueRow('Barangay & Jurisdiction', 'Barangay San Andres, Cainta, Rizal (PSGC 0405805014)'),
              createKeyValueRow('Report Title', 'Official Case Resolution and Closure Documentation'),
              createKeyValueRow('Report Reference No.', reportRef),
              createKeyValueRow('Blotter / Case Number', blotterNumber),
              createKeyValueRow('Date Report Generated', formatDate(new Date())),
              createKeyValueRow('Current Case Status', statusDisplay(complaint.status)),
            ],
          }),

          // Section 2: Initial Complaint Information
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: '2. Initial Complaint Information', bold: true, size: 22, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [
              createKeyValueRow('Original Submission Date & Time', formatDate(complaint.created_at)),
              createKeyValueRow('Complaint Category', complaint.category || 'General Barangay Concern'),
              createKeyValueRow('Complaint Type / Subject', complaint.uri_ng_reklamo),
              createKeyValueRow('Complainant Identity', isAnonymous ? 'Anonymous (Identity concealed per resident request)' : complainantDisplayName),
              createKeyValueRow('Person Involved / Respondent', complaint.nireklamo_pangalan || 'Not specified'),
              createKeyValueRow('Exact Incident Address', incidentAddress),
              createKeyValueRow('Geographic Coordinates', complaint.latitude != null && complaint.longitude != null ? `${Number(complaint.latitude).toFixed(6)}, ${Number(complaint.longitude).toFixed(6)}` : 'Not recorded'),
              createKeyValueRow('Complaint Details', complaint.detalye),
            ],
          }),

          // Section 3: Complaint Progress and Chronological History
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: '3. Complaint Progress and Chronological History', bold: true, size: 22, color: '1E3A8A' })],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: 'The recorded chronological history of proceedings, status transitions, follow-up actions, and communications for this case:', size: 19, italics: true, color: '4B5563' })],
          }),
          new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [
              createTableHeader('Date & Time', 'Action / Event Type', 'Actor / Official', 'Recorded Details'),
              ...chronological.map(
                (ev) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 2200, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: formatDate(ev.date), size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 2200, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: ev.type, bold: true, size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 2500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: ev.actor, size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 2600, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: ev.details || '—', size: 18 })] })],
                      }),
                    ],
                  })
              ),
            ],
          }),

          // Section 4: Audit Trail and Supporting Evidence
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: '4. Audit Trail and Supporting Evidence', bold: true, size: 22, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [
              createTableHeader('Item / Timestamp', 'Type / Action', 'Details & File References'),
              ...evidence.map(
                (ev) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 2500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: formatDate(ev.created_at || complaint.created_at), size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 2500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: 'Supporting Evidence', bold: true, size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 4500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: `${ev.original_name || 'Evidence Image'} (${ev.file_path})`, size: 18 })] })],
                      }),
                    ],
                  })
              ),
              ...audit.map(
                (au) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 2500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: formatDate(au.created_at), size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 2500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: au.action_type.replace(/_/g, ' '), bold: true, size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 4500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: `Recorded by: ${au.actor}. Remarks: ${au.remarks || 'None'}`, size: 18 })] })],
                      }),
                    ],
                  })
              ),
            ],
          }),

          // Section 5: Personnel Involved in Handling and Resolving the Case
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: '5. Personnel Involved in Handling and Resolving the Case', bold: true, size: 22, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [
              createTableHeader('Personnel Name', 'Assigned / Recorded Role', 'Participation / Actions'),
              ...Array.from(personnelMap.entries()).map(
                ([pName, pRole]) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 3000, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: pName, bold: true, size: 19 })] })],
                      }),
                      new TableCell({
                        width: { size: 3500, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: pRole, size: 19 })] })],
                      }),
                      new TableCell({
                        width: { size: 3000, type: WidthType.DXA },
                        borders: cellBorders,
                        children: [new Paragraph({ children: [new TextRun({ text: 'Recorded in case proceedings and audit logs.', size: 18 })] })],
                      }),
                    ],
                  })
              ),
            ],
          }),

          // Section 6: Final Resolution and Closure
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: '6. Final Resolution and Closure', bold: true, size: 22, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [
              createKeyValueRow('Final Case Status', statusDisplay(complaint.status)),
              createKeyValueRow('Resolution / Closure Date', formatDate(latestDisposition?.disposition_date || complaint.updated_at)),
              createKeyValueRow('Recorded Resolution Details', latestDisposition?.resolution_details || 'Case successfully concluded and marked as completed in the system.'),
              createKeyValueRow('Final Staff Findings / Remarks', latestDisposition?.action_type ? `Case action: ${latestDisposition.action_type}. Supporting documentation recorded.` : 'All necessary administrative and dispute resolution steps completed.'),
              createKeyValueRow('Closing Staff Member & Role', latestDisposition?.staff_name ? `${latestDisposition.staff_name} (Authorized Barangay Staff)` : 'Authorized Barangay Staff'),
              createKeyValueRow('Archival / Resolution Reference', latestDisposition?.evidence_path ? `Attached file: ${latestDisposition.evidence_path}` : 'Filed digitally in San Andres Complaint Management Archives'),
            ],
          }),

          // Barangay Officials Footer
          new Paragraph({
            spacing: { before: 400, after: 100 },
            children: [
              new TextRun({
                text: 'CERTIFIED AND RECORDED BY BARANGAY OFFICIALS:',
                bold: true,
                size: 20,
                color: '374151',
              }),
            ],
          }),
          new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4750, type: WidthType.DXA },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        spacing: { before: 300 },
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: secretaryName, bold: true, size: 21 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: secretaryTitle, size: 18, color: '4B5563' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Barangay San Andres, Cainta, Rizal', size: 16, italics: true, color: '6B7280' }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4750, type: WidthType.DXA },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        spacing: { before: 300 },
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: captainName, bold: true, size: 21 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: captainTitle, size: 18, color: '4B5563' }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Barangay San Andres, Cainta, Rizal', size: 16, italics: true, color: '6B7280' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
