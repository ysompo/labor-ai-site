import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { Resend } from 'resend';
import { renderAssessmentPdf } from '@/lib/assessmentPdf';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!isDbConfigured()) {
    return Response.json({ participantName: 'משתתף', scenarioName: null, submitted: false });
  }

  try {
    const result = await sql`
      SELECT sa.participant_name,
             sa.submitted_at,
             sc.name AS scenario_name
      FROM sim_self_assessments sa
      LEFT JOIN sim_sessions ss ON ss.id = sa.session_id
      LEFT JOIN sim_scenarios sc ON sc.id = ss.scenario_id
      WHERE sa.token = ${token}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const row = result.rows[0] as {
      participant_name: string;
      submitted_at: string | null;
      scenario_name: string | null;
    };
    return Response.json({
      participantName: row.participant_name,
      scenarioName:    row.scenario_name ?? null,
      submitted:       !!row.submitted_at,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json() as { strengths: string; improvements: string };

  if (!isDbConfigured()) {
    return Response.json({ ok: true, mock: true });
  }

  try {
    // Save self-assessment
    const updateResult = await sql`
      UPDATE sim_self_assessments
      SET    strengths    = ${body.strengths    ?? ''},
             improvements = ${body.improvements ?? ''},
             submitted_at = NOW()
      WHERE  token        = ${token}
        AND  submitted_at IS NULL
      RETURNING session_id
    `;

    if (updateResult.rows.length === 0) {
      return Response.json({ error: 'Token not found or already submitted' }, { status: 404 });
    }

    // Respond immediately — resend PDF in background
    const sessionId = updateResult.rows[0].session_id as number | null;
    if (sessionId && process.env.RESEND_API_KEY) {
      void resendCombinedPdf(sessionId, body.strengths, body.improvements).catch(console.error);
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

async function resendCombinedPdf(
  sessionId: number,
  selfStrengths: string,
  selfImprovements: string,
) {
  // Fetch the instructor's assessment for this session
  const assessmentResult = await sql`
    SELECT a.form_type,
           a.scores,
           a.strengths,
           a.improvements,
           a.key_message,
           a.total_score,
           a.participant_name,
           a.evaluator_name,
           a.recipient_emails,
           s.session_code,
           s.created_at,
           sc.name AS scenario_name
    FROM sim_assessments a
    JOIN sim_sessions s  ON s.id  = a.session_id
    LEFT JOIN sim_scenarios sc ON sc.id = s.scenario_id
    WHERE a.session_id = ${sessionId}
    ORDER BY a.submitted_at DESC
    LIMIT 1
  `;

  if (assessmentResult.rows.length === 0) return;

  const row = assessmentResult.rows[0] as {
    form_type: string;
    scores: string | Record<string, number>;
    strengths: string | null;
    improvements: string | null;
    key_message: string | null;
    total_score: number;
    participant_name: string;
    evaluator_name: string;
    recipient_emails: string | null;
    session_code: string;
    created_at: string;
    scenario_name: string | null;
  };

  const recipients: string[] = (() => {
    try { return JSON.parse(row.recipient_emails ?? '[]') as string[]; }
    catch { return []; }
  })().filter((e: string) => e?.includes('@'));

  if (recipients.length === 0) return;

  const sessionDate = new Date(row.created_at).toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });

  const pdfBuffer = await renderAssessmentPdf({
    participantName:  row.participant_name || '—',
    evaluatorName:    row.evaluator_name  || '—',
    scenarioName:     row.scenario_name   ?? undefined,
    sessionDate,
    formType:         row.form_type,
    scores:           (typeof row.scores === 'string' ? JSON.parse(row.scores) : row.scores) as Record<string, number>,
    strengths:        row.strengths    || '',
    improvements:     row.improvements || '',
    keyMessage:       row.key_message  || undefined,
    total:            row.total_score  ?? 0,
    selfAssessmentStrengths:    selfStrengths  || undefined,
    selfAssessmentImprovements: selfImprovements || undefined,
  });

  const safe     = (row.participant_name || 'assessment').replace(/[^א-תa-zA-Z0-9 ]/g, '').trim();
  const filename = `הערכה_מלאה_${safe}_${sessionDate}.pdf`.replace(/\s+/g, '_');

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from:    'Labor-AI Simulator <onboarding@resend.dev>',
    to:      recipients,
    subject: `הערכה מלאה (כולל הערכה עצמית) — ${row.scenario_name ?? 'סימולציה'} | Labor-AI Lab`,
    html:    buildCombinedEmail(row.participant_name, row.scenario_name),
    attachments: [{ filename, content: pdfBuffer }],
  });
}

function buildCombinedEmail(participantName: string, scenarioName: string | null): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e40af,#4B2E6A);padding:24px 32px;">
      <div style="color:#fff;font-size:18px;font-weight:700;">הערכה מלאה — ${scenarioName ?? 'סימולציה'}</div>
      <div style="color:#bfdbfe;font-size:12px;margin-top:2px;">Labor-AI Lab · Hadassah Mount Scopus</div>
    </div>
    <div style="padding:24px 32px;">
      <p style="font-size:14px;color:#374151;margin-bottom:16px;">
        ${participantName} השלים/ה את ההערכה העצמית.
      </p>
      <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px 16px;font-size:13px;color:#374151;">
        📎 הדוח המלא (כולל הערכת המדריך והערכה עצמית) מצורף כקובץ PDF
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 32px;text-align:center;color:#9ca3af;font-size:11px;">
      Labor-AI Simulation Lab · Hadassah Medical Center, Mount Scopus
    </div>
  </div>
</body>
</html>`;
}
