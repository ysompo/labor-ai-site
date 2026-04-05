import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    sessionCode: string;
    residentName: string;
    scenarioName?: string;
  };

  if (!body.sessionCode || !body.residentName?.trim()) {
    return Response.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({ ok: true, mock: true });
  }

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS sim_self_assessments (
        id            SERIAL PRIMARY KEY,
        token         TEXT UNIQUE NOT NULL,
        session_id    INT REFERENCES sim_sessions(id) ON DELETE SET NULL,
        participant_name TEXT DEFAULT '',
        participant_role TEXT DEFAULT '',
        strengths     TEXT,
        improvements  TEXT,
        submitted_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Look up session
    const sessionResult = await sql`
      SELECT id FROM sim_sessions WHERE session_code = ${body.sessionCode}
    `;
    const sessionId: number | null = sessionResult.rows[0]?.id ?? null;

    // Look up resident email from staff
    const staffResult = await sql`
      SELECT name, role, email FROM sim_staff
      WHERE name = ${body.residentName.trim()}
        AND role ILIKE '%מתמחה%'
        AND active = TRUE
      LIMIT 1
    `;
    const staff = staffResult.rows[0] as { name: string; role: string; email: string } | undefined;
    const email = staff?.email ?? null;
    const participantRole = staff?.role ?? 'מתמחה';

    // Generate token and insert record
    const token = randomUUID();
    await sql`
      INSERT INTO sim_self_assessments (token, session_id, participant_name, participant_role)
      VALUES (${token}, ${sessionId}, ${body.residentName.trim()}, ${participantRole})
    `;

    // Send email
    let emailSent = false;
    if (process.env.RESEND_API_KEY && email?.includes('@')) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://labor-ai.org';
      const formUrl = `${baseUrl}/tools/simulator/self-assessment/${token}`;

      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from:    'Labor-AI Simulator <onboarding@resend.dev>',
        to:      [email],
        subject: `הערכה עצמית — ${body.scenarioName ?? 'סימולציה'} | Labor-AI Lab`,
        html:    buildSelfAssessmentEmail({ participantName: body.residentName, scenarioName: body.scenarioName, formUrl }),
      });
      if (!error) emailSent = true;
    }

    return Response.json({ ok: true, token, emailSent });
  } catch (e) {
    console.error('self-assessment send error:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

function buildSelfAssessmentEmail(data: {
  participantName: string;
  scenarioName?: string;
  formUrl: string;
}): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e40af,#4B2E6A);padding:24px 32px;">
      <div style="color:#fff;font-size:18px;font-weight:700;">הערכה עצמית — ${data.scenarioName ?? 'סימולציה'}</div>
      <div style="color:#bfdbfe;font-size:12px;margin-top:2px;">Labor-AI Lab · Hadassah Mount Scopus</div>
    </div>
    <div style="padding:24px 32px;">
      <p style="font-size:14px;color:#374151;margin-bottom:20px;">שלום ${data.participantName},</p>
      <p style="font-size:14px;color:#374151;margin-bottom:20px;">הסימולציה הסתיימה. אנא מלא/י את ההערכה העצמית שלך — מה עבד טוב ומה ניתן לשפר.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${data.formUrl}" style="background:linear-gradient(135deg,#1e40af,#4B2E6A);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">מילוי הערכה עצמית</a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;">הקישור ייסגר לאחר שליחת הטופס</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 32px;text-align:center;color:#9ca3af;font-size:11px;">
      Labor-AI Simulation Lab · Hadassah Medical Center, Mount Scopus
    </div>
  </div>
</body>
</html>`;
}
