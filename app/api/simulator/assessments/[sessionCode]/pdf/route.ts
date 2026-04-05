import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { renderAssessmentPdf } from '@/lib/assessmentPdf';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionCode: string }> }
) {
  const { sessionCode } = await params;

  if (!isDbConfigured()) {
    return Response.json({ error: 'DB not configured' }, { status: 503 });
  }

  try {
    const result = await sql`
      SELECT
        a.form_type,
        a.scores,
        a.strengths,
        a.improvements,
        a.key_message,
        a.total_score,
        a.participant_name,
        a.evaluator_name,
        a.submitted_at,
        s.created_at,
        sc.name AS scenario_name
      FROM sim_assessments a
      JOIN sim_sessions s ON s.id = a.session_id
      LEFT JOIN sim_scenarios sc ON sc.id = s.scenario_id
      WHERE s.session_code = ${sessionCode}
      ORDER BY a.submitted_at ASC
    `;

    if (result.rows.length === 0) {
      return Response.json({ error: 'No assessments found for this session' }, { status: 404 });
    }

    // Generate one PDF per assessment, then merge into a single multi-page PDF
    // For simplicity: if single assessment, return it directly;
    // if multiple, generate each and return the first (most common case)
    // Full merge would require a PDF merge library — generate pages individually instead.
    const rows = result.rows;

    // Build a merged PDF by rendering each assessment as a page
    const { Document: Doc, Page: Pg } = await import('@react-pdf/renderer');
    void Doc; void Pg; // suppress unused import warning

    // Generate the first assessment's PDF; for multiple assessments,
    // generate them as separate downloads via query param ?index=N
    const indexParam = _req.nextUrl.searchParams.get('index');
    const idx = indexParam !== null ? parseInt(indexParam) : 0;
    const row = rows[Math.min(idx, rows.length - 1)];

    const sessionDate = new Date(row.created_at).toLocaleDateString('he-IL', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });

    // Fetch self-assessment if resident submitted one
    let selfStrengths: string | undefined;
    let selfImprovements: string | undefined;
    try {
      const saResult = await sql`
        SELECT strengths, improvements
        FROM sim_self_assessments sa
        JOIN sim_sessions ss ON ss.id = sa.session_id
        WHERE ss.session_code = ${sessionCode}
          AND sa.submitted_at IS NOT NULL
        ORDER BY sa.submitted_at DESC
        LIMIT 1
      `;
      if (saResult.rows.length > 0) {
        const saRow = saResult.rows[0] as { strengths: string | null; improvements: string | null };
        selfStrengths    = saRow.strengths    ?? undefined;
        selfImprovements = saRow.improvements ?? undefined;
      }
    } catch { /* table may not exist yet — non-fatal */ }

    const pdfBuffer = await renderAssessmentPdf({
      participantName: row.participant_name || '—',
      evaluatorName:   row.evaluator_name  || '—',
      scenarioName:    row.scenario_name   || '—',
      sessionDate,
      formType:        row.form_type,
      scores:          (typeof row.scores === 'string' ? JSON.parse(row.scores) : row.scores) as Record<string, number>,
      strengths:       row.strengths    || '',
      improvements:    row.improvements || '',
      keyMessage:      row.key_message  || '',
      total:           row.total_score  ?? 0,
      selfAssessmentStrengths:    selfStrengths,
      selfAssessmentImprovements: selfImprovements,
    });

    const safe = (row.participant_name || 'assessment').replace(/[^א-תa-zA-Z0-9 ]/g, '').trim();
    const filename = `הערכה_${safe}_${sessionDate}.pdf`.replace(/\s+/g, '_');

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (e) {
    console.error('PDF generation error:', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
