import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 400 });

  if (!isDbConfigured()) {
    return new Response('DB not configured', { status: 503 });
  }

  try {
    const result = await sql`
      UPDATE sim_users SET approved = TRUE, approval_token = NULL
      WHERE approval_token = ${token}
      RETURNING username
    `;
    if (result.rows.length === 0) {
      return new Response('Token not found or already used', { status: 404 });
    }
    const username = result.rows[0].username;
    return new Response(
      `<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:60px;background:#f0fdf4;">
        <h2 style="color:#16a34a;">✓ המשתמש "${username}" אושר בהצלחה</h2>
        <p>המשתמש יכול כעת להתחבר לסימולטור.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}
