import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { Resend } from 'resend';

const SCORE_LABELS: Record<number, string> = { 0: 'לא בוצע', 1: 'בוצע חלקית', 2: 'בוצע מלא' };
const SCORE_COLORS: Record<number, string> = { 0: '#dc2626',  1: '#d97706',    2: '#16a34a'   };

const RUBRIC_ITEMS: Record<string, string> = {
  diag_1: 'זיהוי מוקדם של הסימנים הקליניים',
  diag_2: 'פרשנות נכונה של הממצאים',
  diag_3: 'קביעת אבחנה מדויקת',
  diag_4: 'תיעדוף בעיות לפי חומרה',
  mgmt_1: 'קבלת החלטות בזמן',
  mgmt_2: 'ביצוע פרוטוקול טיפולי',
  mgmt_3: 'ניטור ומעקב אחר תגובה לטיפול',
  mgmt_4: 'קריאה לעזרה בזמן',
  comm_1: 'תקשורת עם הצוות',
  comm_2: 'הסבר למטופלת',
  comm_3: 'תיעוד ודיווח',
};

const RUBRIC_SECTIONS = [
  { category: 'זיהוי ואבחנה',  ids: ['diag_1','diag_2','diag_3','diag_4'] },
  { category: 'ניהול קליני',   ids: ['mgmt_1','mgmt_2','mgmt_3','mgmt_4'] },
  { category: 'תקשורת וצוות', ids: ['comm_1','comm_2','comm_3'] },
];

function buildHtmlEmail(body: {
  participantName: string;
  evaluatorName: string;
  scenarioName?: string;
  formType: string;
  scores: Record<string, number>;
  strengths: string;
  improvements: string;
  keyMessage: string;
  total: number;
}): string {
  const maxScore = Object.keys(RUBRIC_ITEMS).length * 2;
  const pct      = Math.round((body.total / maxScore) * 100);
  const band     = body.total >= maxScore * 0.75 ? { bg: '#f0fdf4', border: '#16a34a', label: 'טוב מאוד' }
                 : body.total >= maxScore * 0.5  ? { bg: '#fffbeb', border: '#d97706', label: 'סביר'     }
                 :                                 { bg: '#fef2f2', border: '#dc2626', label: 'דרוש שיפור' };

  const sectionRows = RUBRIC_SECTIONS.map(sec => {
    const rows = sec.ids.map(id => {
      const score = body.scores[id] ?? 0;
      const color = SCORE_COLORS[score];
      const label = SCORE_LABELS[score];
      return `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:9px 14px;font-size:13px;text-align:right;">${RUBRIC_ITEMS[id] ?? id}</td>
          <td style="padding:9px 14px;text-align:center;">
            <span style="background:${color}18;color:${color};border:1px solid ${color}40;border-radius:5px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap;">${score}/2 — ${label}</span>
          </td>
        </tr>`;
    }).join('');

    return `
      <tr><td colspan="2" style="background:#1e40af;color:#fff;font-weight:700;font-size:13px;padding:9px 14px;text-align:right;">${sec.category}</td></tr>
      ${rows}`;
  }).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#4B2E6A);padding:28px 32px;">
      <div style="color:#fff;font-size:20px;font-weight:700;margin-bottom:4px;">הערכת סימולציה</div>
      <div style="color:#bfdbfe;font-size:13px;">Labor-AI Lab · Hadassah Mount Scopus</div>
    </div>

    <div style="padding:24px 32px;">

      <!-- Meta -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        <tr>
          <td style="padding:5px 0;color:#6b7280;width:40%;">משתתף</td>
          <td style="padding:5px 0;font-weight:700;">${body.participantName}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;">מעריך</td>
          <td style="padding:5px 0;font-weight:700;">${body.evaluatorName}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;">תרחיש</td>
          <td style="padding:5px 0;font-weight:700;">${body.scenarioName ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;">סוג טופס</td>
          <td style="padding:5px 0;">${body.formType === 'resident' ? 'מתמחה' : 'מיילדת'}</td>
        </tr>
      </table>

      <!-- Score band -->
      <div style="background:${band.bg};border:2px solid ${band.border};border-radius:10px;padding:14px 20px;text-align:center;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:700;color:#111;">${body.total}</span>
        <span style="font-size:16px;color:#6b7280;">/${maxScore}</span>
        <span style="margin-right:12px;font-size:14px;color:#6b7280;">(${pct}%) — ${band.label}</span>
      </div>

      <!-- Rubric table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #dbeafe;border-radius:8px;overflow:hidden;">
        ${sectionRows}
      </table>

      <!-- Text sections -->
      ${[
        { label: 'חוזקות',        value: body.strengths,   color: '#16a34a' },
        { label: 'נקודות לשיפור', value: body.improvements, color: '#d97706' },
        { label: 'מסר מרכזי',    value: body.keyMessage,   color: '#1e40af' },
      ].map(s => s.value ? `
      <div style="margin-bottom:16px;">
        <div style="font-weight:700;color:${s.color};font-size:13px;margin-bottom:6px;">${s.label}</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:12px 14px;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${s.value}</div>
      </div>` : '').join('')}

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;color:#9ca3af;font-size:12px;">
      Labor-AI Simulation Lab · Hadassah Medical Center, Mount Scopus
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    sessionCode: string;
    participantName: string;
    participantEmails?: string[];
    evaluatorName: string;
    formType: 'resident' | 'midwife';
    scores: Record<string, 0 | 1 | 2>;
    strengths: string;
    improvements: string;
    keyMessage: string;
    total: number;
    scenarioName?: string;
  };

  const assessmentId = `assess_${Date.now()}`;

  if (isDbConfigured()) {
    try {
      const sessionResult = await sql`SELECT id FROM sim_sessions WHERE session_code = ${body.sessionCode}`;
      if (sessionResult.rows.length > 0) {
        await sql`
          INSERT INTO sim_assessments (session_id, form_type, scores, strengths, improvements, key_message, total_score, submitted_at)
          VALUES (${sessionResult.rows[0].id}, ${body.formType}, ${JSON.stringify(body.scores)}, ${body.strengths}, ${body.improvements}, ${body.keyMessage}, ${body.total}, NOW())
        `;
      }
    } catch (e) {
      console.error('DB error:', e);
    }
  }

  const emailRecipients = (body.participantEmails ?? []).filter(e => e.includes('@'));
  let emailError: string | null = null;
  if (process.env.RESEND_API_KEY && emailRecipients.length > 0) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from:    'Labor-AI Simulator <onboarding@resend.dev>',
        to:      emailRecipients,
        subject: `הערכת סימולציה — ${body.scenarioName ?? 'סימולציה'} | Labor-AI Lab`,
        html:    buildHtmlEmail(body),
      });
      if (result.error) {
        emailError = result.error.message;
        console.error('Resend error:', result.error);
      }
    } catch (e) {
      emailError = String(e);
      console.error('Email error:', e);
    }
  }

  return Response.json({ assessmentId, ok: true, emailError, emailsSent: emailError ? 0 : emailRecipients.length });
}
