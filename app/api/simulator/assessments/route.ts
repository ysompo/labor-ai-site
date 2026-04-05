import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { Resend } from 'resend';
import { renderAssessmentPdf } from '@/lib/assessmentPdf';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    sessionCode: string;
    participantName: string;
    participantEmails?: string[];
    evaluatorName: string;
    formType: 'resident' | 'resident_junior' | 'midwife';
    scores: Record<string, number>;
    itemNotes?: Record<string, string>;
    strengths: string;
    improvements: string;
    keyMessage?: string;
    total: number;
    scenarioName?: string;
    sessionDate?: string;
    sendEmails?: boolean;
  };

  // ── Save to DB ─────────────────────────────────────────────────────────────
  if (isDbConfigured()) {
    try {
      // Ensure columns exist
      await sql`ALTER TABLE sim_assessments ADD COLUMN IF NOT EXISTS participant_name TEXT DEFAULT ''`;
      await sql`ALTER TABLE sim_assessments ADD COLUMN IF NOT EXISTS evaluator_name TEXT DEFAULT ''`;
      await sql`ALTER TABLE sim_assessments ADD COLUMN IF NOT EXISTS recipient_emails TEXT DEFAULT '[]'`;

      const sessionResult = await sql`SELECT id FROM sim_sessions WHERE session_code = ${body.sessionCode}`;
      if (sessionResult.rows.length > 0) {
        await sql`
          INSERT INTO sim_assessments (session_id, form_type, scores, strengths, improvements, key_message, total_score, participant_name, evaluator_name, recipient_emails, submitted_at)
          VALUES (${sessionResult.rows[0].id}, ${body.formType}, ${JSON.stringify(body.scores)}, ${body.strengths}, ${body.improvements}, ${body.keyMessage ?? ''}, ${body.total}, ${body.participantName}, ${body.evaluatorName}, ${JSON.stringify(body.participantEmails ?? [])}, NOW())
        `;
      }
    } catch (e) {
      console.error('DB error saving assessment:', e);
    }
  }

  // ── Generate PDF + send email ──────────────────────────────────────────────
  const emailRecipients = (body.participantEmails ?? []).filter(e => e?.includes('@'));
  let emailError: string | null = null;

  if (process.env.RESEND_API_KEY && emailRecipients.length > 0 && body.sendEmails !== false) {
    try {
      // Fetch self-assessment if available
      let selfStrengths: string | undefined;
      let selfImprovements: string | undefined;
      if (isDbConfigured()) {
        try {
          const saResult = await sql`
            SELECT strengths, improvements
            FROM sim_self_assessments sa
            JOIN sim_sessions ss ON ss.id = sa.session_id
            WHERE ss.session_code = ${body.sessionCode}
              AND sa.submitted_at IS NOT NULL
            ORDER BY sa.submitted_at DESC
            LIMIT 1
          `;
          if (saResult.rows.length > 0) {
            const saRow = saResult.rows[0] as { strengths: string | null; improvements: string | null };
            selfStrengths    = saRow.strengths    ?? undefined;
            selfImprovements = saRow.improvements ?? undefined;
          }
        } catch { /* non-fatal — table may not exist yet */ }
      }

      // Generate PDF
      const pdfBuffer = await renderAssessmentPdf({
        participantName: body.participantName,
        evaluatorName:   body.evaluatorName,
        scenarioName:    body.scenarioName,
        sessionDate:     body.sessionDate,
        formType:        body.formType,
        scores:          body.scores,
        strengths:       body.strengths,
        improvements:    body.improvements,
        keyMessage:      body.keyMessage,
        total:           body.total,
        selfAssessmentStrengths:    selfStrengths,
        selfAssessmentImprovements: selfImprovements,
      });

      const safeParticipant = body.participantName.replace(/[^א-תa-zA-Z0-9 ]/g, '').trim() || 'assessment';
      const filename = `הערכה_${safeParticipant}_${body.sessionDate ?? 'sim'}.pdf`.replace(/\s+/g, '_');

      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from:    'Labor-AI Simulator <onboarding@resend.dev>',
        to:      emailRecipients,
        subject: `הערכת סימולציה — ${body.scenarioName ?? 'סימולציה'} | Labor-AI Lab`,
        html:    buildHtmlEmail(body),
        attachments: [{
          filename,
          content: pdfBuffer,
        }],
      });

      if (result.error) {
        emailError = result.error.message;
        console.error('Resend error:', result.error);
      }
    } catch (e) {
      emailError = String(e);
      console.error('Email/PDF error:', e);
    }
  }

  return Response.json({
    ok: true,
    emailError,
    emailsSent: emailError ? 0 : emailRecipients.length,
  });
}

// ── HTML email body (inline summary; PDF is the full document) ─────────────
function buildHtmlEmail(body: {
  participantName: string;
  evaluatorName: string;
  scenarioName?: string;
  sessionDate?: string;
  formType: string;
  strengths: string;
  improvements: string;
  keyMessage?: string;
  total: number;
}): string {
  const formLabel = body.formType === 'resident' ? 'מתמחה בכיר'
    : body.formType === 'resident_junior'         ? 'מתמחה צעיר'
    : 'מיילדת';

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e40af,#4B2E6A);padding:24px 32px;">
      <div style="color:#fff;font-size:18px;font-weight:700;">הערכת סימולציה — ${formLabel}</div>
      <div style="color:#bfdbfe;font-size:12px;margin-top:2px;">Labor-AI Lab · Hadassah Mount Scopus</div>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;font-size:13px;margin-bottom:20px;border-collapse:collapse;">
        <tr><td style="color:#6b7280;padding:4px 0;width:35%;">משתתף</td><td style="font-weight:700;">${body.participantName}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0;">מעריך</td><td style="font-weight:700;">${body.evaluatorName}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0;">תרחיש</td><td>${body.scenarioName ?? '—'}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0;">תאריך</td><td>${body.sessionDate ?? '—'}</td></tr>
      </table>
      <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#374151;">
        📎 הערכה מלאה מצורפת כקובץ PDF
      </div>
      ${body.strengths ? `<div style="margin-bottom:12px;"><div style="font-weight:700;color:#16a34a;margin-bottom:4px;font-size:13px;">נקודות לשימור</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;font-size:13px;color:#374151;white-space:pre-wrap;">${body.strengths}</div></div>` : ''}
      ${body.improvements ? `<div style="margin-bottom:12px;"><div style="font-weight:700;color:#d97706;margin-bottom:4px;font-size:13px;">נקודות לשיפור</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;font-size:13px;color:#374151;white-space:pre-wrap;">${body.improvements}</div></div>` : ''}
      ${body.keyMessage ? `<div style="margin-bottom:12px;"><div style="font-weight:700;color:#1e40af;margin-bottom:4px;font-size:13px;">מסר מרכזי</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;font-size:13px;color:#374151;white-space:pre-wrap;">${body.keyMessage}</div></div>` : ''}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 32px;text-align:center;color:#9ca3af;font-size:11px;">
      Labor-AI Simulation Lab · Hadassah Medical Center, Mount Scopus
    </div>
  </div>
</body>
</html>`;
}
