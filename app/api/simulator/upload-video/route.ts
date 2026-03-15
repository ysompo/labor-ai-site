import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file        = formData.get('file') as File | null;
  const sessionCode = formData.get('sessionCode') as string;
  const deviceRole  = formData.get('deviceRole') as string;
  const simTimeStart = Number(formData.get('simTimeStart') ?? 0);
  const simTimeEnd   = Number(formData.get('simTimeEnd') ?? 0);

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

  const clipId = `clip_${Date.now()}`;

  // Upload to Vercel Blob if configured
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  let blobUrl = `/api/simulator/clips/${clipId}`;  // placeholder

  if (blobToken) {
    try {
      const { put } = await import('@vercel/blob');
      const blob = await put(`simulator/${sessionCode}/${clipId}.webm`, file, { access: 'public', token: blobToken });
      blobUrl = blob.url;
    } catch (e) {
      console.error('Blob upload failed:', e);
    }
  }

  const duration = simTimeEnd - simTimeStart;

  if (isDbConfigured()) {
    try {
      const sessionResult = await sql`SELECT id FROM sim_sessions WHERE session_code = ${sessionCode}`;
      if (sessionResult.rows.length > 0) {
        await sql`
          INSERT INTO sim_video_clips (session_id, device_role, sim_time_start, sim_time_end, blob_url, duration_seconds)
          VALUES (${sessionResult.rows[0].id}, ${deviceRole}, ${simTimeStart}, ${simTimeEnd}, ${blobUrl}, ${duration})
        `;
      }
    } catch (e) {
      console.error('DB save failed:', e);
    }
  }

  return Response.json({ blobUrl, clipId, duration });
}
