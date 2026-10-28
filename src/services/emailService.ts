import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS?.replace(/\s/g, ''),
  },
});

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character] as string);

const generateHtmlTemplate = (title: string, content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; color: #1f2937; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
    <!-- Header -->
    <div style="background-color: #2563eb; padding: 30px 40px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">San Andres Complaint System</h1>
    </div>
    <!-- Body -->
    <div style="padding: 40px; line-height: 1.6;">
      ${content}
    </div>
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">This message was automatically sent by the San Andres Complaint System. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;

export const STATUS_DISPLAY_MAP: Record<string, string> = {
  bago: 'New',
  sinusuri: 'Under Review',
  'naka-assign': 'Assigned',
  iniimbestigahan: 'Under Investigation',
  'naka-iskedyul': 'Scheduled',
  'sa-mediation': 'In Mediation',
  natapos: 'Resolved',
  archived: 'Archived',
};

export function formatStatusForEmail(status?: string | null): string {
  if (!status) return 'New';
  return STATUS_DISPLAY_MAP[status] || status;
}

export async function sendComplaintCreatedEmail(to: string, name: string, blotterNumber: string, type: string) {
  if (!to) return;
  const content = `
    <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0;">Hello, ${escapeHtml(name)}!</h2>
    <p style="color: #4b5563;">We have successfully received your complaint.</p>
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Blotter Number:</strong> <span style="color: #1d4ed8; font-weight: 700;">${escapeHtml(blotterNumber)}</span></p>
      <p style="margin: 0 0 10px 0;"><strong>Complaint Type:</strong> ${escapeHtml(type)}</p>
      <p style="margin: 0;"><strong>Status:</strong> <strong style="color: #1d4ed8; font-size: 15px;">New</strong></p>
    </div>
    <p style="color: #4b5563;">Your complaint is currently marked as <strong>New</strong> and is being reviewed by our officials. You will receive email notifications as your case progresses.</p>
    <br/>
    <p style="color: #4b5563; margin-bottom: 0;">Thank you,<br><strong>Barangay San Andres</strong></p>
  `;
  
  try {
    await transporter.sendMail({
      from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
      to,
      subject: `Complaint Received: ${blotterNumber} - New`,
      html: generateHtmlTemplate('Complaint Received', content),
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

export async function sendStatusUpdateEmail(
  to: string,
  name: string,
  blotterNumber: string,
  newStatus: string,
  remarks?: string,
  updateDate?: Date | string
) {
  if (!to) return;

  const statusDisplay = formatStatusForEmail(newStatus);
  const cleanRemarks = remarks
    ? remarks
        .replace(/\bstatus\s+sa\s+sinusuri\b/gi, 'Under Review')
        .replace(/\bstatus\s+sa\s+bago\b/gi, 'New')
        .replace(/\bsinusuri\b/gi, 'Under Review')
        .replace(/\bbago\b/gi, 'New')
    : '';

  const dateFormatted = updateDate ? new Date(updateDate).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const remarksHtml = cleanRemarks && cleanRemarks.trim() ? `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-left: 4px solid #4b5563; padding: 12px 18px; margin: 18px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #374151;">Remarks / Action Details:</p>
      <p style="margin: 0; color: #1f2937; font-size: 14px; white-space: pre-wrap;">${escapeHtml(cleanRemarks.trim())}</p>
    </div>
  ` : '';
  
  const content = `
    <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0;">Hello, ${escapeHtml(name)}!</h2>
    <p style="color: #4b5563;">There is an update regarding your complaint (<strong>${escapeHtml(blotterNumber)}</strong>).</p>
    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 6px 0;"><strong>Case Reference:</strong> ${escapeHtml(blotterNumber)}</p>
      <p style="margin: 0 0 6px 0;"><strong>Update Date:</strong> ${escapeHtml(dateFormatted)}</p>
      <p style="margin: 0;">The new status of your complaint is: <strong style="color: #166534; font-size: 16px;">${escapeHtml(statusDisplay)}</strong></p>
    </div>
    ${remarksHtml}
    <p style="color: #4b5563;">You can review the full details and history by signing in to the San Andres Complaint System.</p>
    <br/>
    <p style="color: #4b5563; margin-bottom: 0;">Thank you,<br><strong>Barangay San Andres</strong></p>
  `;
  
  try {
    await transporter.sendMail({
      from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
      to,
      subject: `Complaint Update: ${blotterNumber} - ${statusDisplay}`,
      html: generateHtmlTemplate('Complaint Status Update', content),
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

export async function sendCaseHistoryEmail(
  to: string,
  recipientName: string,
  blotterNumber: string,
  complaintTitle: string,
  complaintDate: string,
  events: Array<{ created_at: string; action_type: string; previous_status?: string | null; new_status?: string | null; actor: string; remarks: string }>
) {
  if (!to) throw new Error('A recipient email address is required.');
  const statusText = (value?: string | null) => ({
    bago: 'New',
    sinusuri: 'Under Review',
    'naka-assign': 'Assigned',
    iniimbestigahan: 'Under Investigation',
    'naka-iskedyul': 'Scheduled',
    'sa-mediation': 'In Mediation',
    natapos: 'Resolved',
    archived: 'Archived',
  } as Record<string, string>)[value || ''] || value || '—';
  const actionText = (value: string) => ({
    status_updated: 'Status updated',
    case_resolved: 'Case resolution',
    case_archived: 'Case archived',
    mediation_eligibility_verified: 'Mediation eligibility verified',
    mediation_eligibility_declined: 'Mediation eligibility declined',
    mediation_scheduled: 'Mediation scheduled',
    mediation_outcome_recorded: 'Mediation proceedings recorded',
    mediation_personnel_assigned: 'Mediation personnel assigned',
    summons_document_saved: 'Official summons saved',
    certificate_to_file_action_prepared: 'Certificate to File Action prepared',
    administrative_action: 'Administrative action',
    filed: 'Complaint filed',
    edited: 'Complaint details edited',
    complaint_deleted: 'Complaint moved to recycle bin',
    complaint_restored: 'Complaint restored',
    resolved: 'Case resolution',
    archived: 'Case archived',
  } as Record<string, string>)[value] || value.replaceAll('_', ' ');
  const rows = events.map((event) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #d1d5db;white-space:nowrap">${escapeHtml(new Date(event.created_at).toLocaleString())}</td>
      <td style="padding:10px;border-bottom:1px solid #d1d5db">${escapeHtml(statusText(event.previous_status))} ${event.new_status ? `→ ${escapeHtml(statusText(event.new_status))}` : ''}</td>
      <td style="padding:10px;border-bottom:1px solid #d1d5db">${escapeHtml(actionText(event.action_type))}</td>
      <td style="padding:10px;border-bottom:1px solid #d1d5db">${escapeHtml(event.actor)}</td>
      <td style="padding:10px;border-bottom:1px solid #d1d5db;white-space:pre-wrap">${escapeHtml(event.remarks)}</td>
    </tr>
  `).join('');
  const content = `
    <h2 style="margin-top:0">Official Case History</h2>
    <p>Dear ${escapeHtml(recipientName)},</p>
    <p>This is the chronological activity statement for complaint <strong>${escapeHtml(blotterNumber)}</strong>.</p>
    <p><strong>Case:</strong> ${escapeHtml(complaintTitle)}<br><strong>Complaint date:</strong> ${escapeHtml(new Date(complaintDate).toLocaleString())}</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:10px;border-bottom:2px solid #6b7280">Date / Time</th>
        <th style="padding:10px;border-bottom:2px solid #6b7280">Status change</th>
        <th style="padding:10px;border-bottom:2px solid #6b7280">Action</th>
        <th style="padding:10px;border-bottom:2px solid #6b7280">Recorded by</th>
        <th style="padding:10px;border-bottom:2px solid #6b7280">Remarks</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="padding:10px">No recorded administrative actions.</td></tr>'}</tbody>
    </table>
    <p style="margin-top:24px">This statement reflects entries recorded in the Barangay San Andres Complaint Management System.</p>
  `;
  await transporter.sendMail({
    from: '"Barangay San Andres Complaint System" <' + process.env.SMTP_USER + '>',
    to,
    subject: `Official Case History: ${blotterNumber}`,
    html: generateHtmlTemplate('Official Case History', content),
  });
}

export async function sendMediationScheduledEmail(to: string, name: string, blotterNumber: string, date: string, location: string, isRespondent: boolean) {
  if (!to) return;
  
  const formattedDate = new Date(date).toLocaleString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' 
  });

  const content = `
    <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0;">Hello, ${escapeHtml(name)}!</h2>
    <p style="color: #4b5563;">
      ${isRespondent 
        ? 'You are being called to mediation regarding a complaint.'
        : 'Your complaint has formally entered the mediation process.'}
    </p>
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Blotter Number:</strong> ${escapeHtml(blotterNumber)}</p>
      <p style="margin: 0 0 10px 0;"><strong>Date and Time:</strong> ${formattedDate}</p>
      <p style="margin: 0;"><strong>Location:</strong> ${escapeHtml(location)}</p>
    </div>
    <p style="color: #4b5563;">Please attend personally as provided by Section 415 of the Local Government Code (Republic Act No. 7160). Any procedural consequence of nonappearance will be determined under applicable law and barangay procedure after consideration of proper service. This notice does not impose a separate fine or penalty.</p>
    <br/>
    <p style="color: #4b5563; margin-bottom: 0;">Thank you,<br><strong>Barangay San Andres Mediation Council</strong></p>
  `;
  
  try {
    await transporter.sendMail({
      from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
      to,
      subject: `${isRespondent ? 'Summons' : 'Notice of Mediation'}: ${blotterNumber}`,
      html: generateHtmlTemplate('Mediation Schedule', content),
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

export async function sendMediationOutcomeEmail(to: string, name: string, blotterNumber: string, outcome: string) {
  if (!to) return;
  
  const outcomeText = outcome === 'settled' ? 'Settled' : outcome === 'referred' ? 'Referred for further action' : 'Dismissed';

  const content = `
    <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0;">Hello, ${escapeHtml(name)}!</h2>
    <p style="color: #4b5563;">The mediation process for complaint <strong>${escapeHtml(blotterNumber)}</strong> is complete.</p>
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0;">The mediation outcome is: <strong style="color: #1d4ed8; font-size: 16px;">${outcomeText}</strong></p>
    </div>
    <p style="color: #4b5563;">Additional documents, if any, are available in your system dashboard.</p>
    <br/>
    <p style="color: #4b5563; margin-bottom: 0;">Thank you,<br><strong>Barangay San Andres</strong></p>
  `;
  
  try {
    await transporter.sendMail({
      from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
      to,
      subject: `Mediation Outcome: ${blotterNumber}`,
      html: generateHtmlTemplate('Mediation Outcome', content),
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

export async function sendPasswordResetOtpEmail(to: string, name: string, otp: string) {
  const content = `
    <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0;">Hello, ${name}!</h2>
    <p style="color: #4b5563;">Use this code to reset your password:</p>
    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 18px 20px; margin: 25px 0; text-align: center; border-radius: 0 8px 8px 0;">
      <strong style="color: #1d4ed8; font-size: 30px; letter-spacing: 8px;">${otp}</strong>
    </div>
    <p style="color: #4b5563;">This code is valid for 10 minutes and can only be used once.</p>
    <p style="color: #b91c1c;">If you did not request this, you may ignore this email.</p>
    <br/>
    <p style="color: #4b5563; margin-bottom: 0;">Thank you,<br><strong>Barangay San Andres</strong></p>
  `;

  await transporter.sendMail({
    from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
    to,
    subject: 'Password Reset OTP',
    html: generateHtmlTemplate('Password Reset OTP', content),
  });
}

export async function sendGoogleLoginOtpEmail(to: string, name: string, otp: string) {
  const content = `
    <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0;">Hello, ${name}!</h2>
    <p style="color: #4b5563;">Use this code to complete your Google sign-in:</p>
    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 18px 20px; margin: 25px 0; text-align: center; border-radius: 0 8px 8px 0;">
      <strong style="color: #1d4ed8; font-size: 30px; letter-spacing: 8px;">${otp}</strong>
    </div>
    <p style="color: #4b5563;">This code is valid for 10 minutes and can only be used once.</p>
    <p style="color: #b91c1c;">If you did not sign in with Google, you may ignore this email.</p>
    <br/>
    <p style="color: #4b5563; margin-bottom: 0;">Thank you,<br><strong>Barangay San Andres</strong></p>
  `;

  await transporter.sendMail({
    from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
    to,
    subject: 'Google Sign-In OTP',
    html: generateHtmlTemplate('Google Login OTP', content),
  });
}

export async function sendRegistrationVerificationOtpEmail(to: string, username: string, otp: string) {
  const content = `
    <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0;">Verify your email address</h2>
    <p style="color: #4b5563;">A Barangay San Andres Complaint System account was started using this email address and username <strong>${username}</strong>.</p>
    <p style="color: #4b5563;">Enter this one-time code in the registration form to verify your email address:</p>
    <div style="background-color: #fff7ed; border-left: 4px solid #8b0000; padding: 18px 20px; margin: 25px 0; text-align: center; border-radius: 0 8px 8px 0;">
      <strong style="color: #8b0000; font-size: 32px; letter-spacing: 8px;">${otp}</strong>
    </div>
    <p style="color: #4b5563;"><strong>Important:</strong> This code expires in 10 minutes and can only be used once. Do not forward or share it. Your account will not be activated until you accept the Terms and Conditions.</p>
    <p style="color: #6b7280; font-size: 13px;">If you did not start this registration, ignore this message. No account will be activated.</p>
    <p style="color: #4b5563; margin-bottom: 0;">Thank you,<br><strong>Barangay San Andres</strong></p>
  `;

  await transporter.sendMail({
    from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
    to,
    subject: 'Your San Andres email verification code',
    html: generateHtmlTemplate('Email Verification Code', content),
  });
}

export async function sendQuickRegistrationOtpEmail(to: string, otp: string) {
  const content = `
    <h2 style="color:#111827;font-size:20px;font-weight:600;margin-top:0">Verify your email address</h2>
    <p style="color:#4b5563">Use this one-time code to verify your email and continue creating your Barangay San Andres account.</p>
    <div style="background-color:#fff7ed;border-left:4px solid #8b0000;padding:18px 20px;margin:25px 0;text-align:center;border-radius:0 8px 8px 0">
      <strong style="color:#8b0000;font-size:32px;letter-spacing:8px">${escapeHtml(otp)}</strong>
    </div>
    <p style="color:#4b5563"><strong>Important:</strong> This code expires in 10 minutes and can only be used once. Keep it private.</p>
    <p style="color:#6b7280;font-size:13px">If you did not request an account, ignore this message. No account will be created.</p>
    <p style="color:#4b5563;margin-bottom:0">Thank you,<br><strong>Barangay San Andres</strong></p>
  `;

  await transporter.sendMail({
    from: '"San Andres Complaint System" <' + process.env.SMTP_USER + '>',
    to,
    subject: 'Your San Andres email verification code',
    html: generateHtmlTemplate('Email Verification Code', content),
  });
}
