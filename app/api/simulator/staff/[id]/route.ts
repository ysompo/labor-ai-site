import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as { name?: string; role?: string; email?: string; active?: boolean };
  if (!isDbConfigured()) return Response.json({ ok: true });
  try {
    if (body.name  !== undefined) await sql`UPDATE sim_staff SET name  = ${body.name}  WHERE id = ${id}`;
    if (body.role  !== undefined) await sql`UPDATE sim_staff SET role  = ${body.role}  WHERE id = ${id}`;
    if (body.email !== undefined) await sql`UPDATE sim_staff SET email = ${body.email} WHERE id = ${id}`;
    if (body.active !== undefined) await sql`UPDATE sim_staff SET active = ${body.active} WHERE id = ${id}`;
    const result = await sql`SELECT * FROM sim_staff WHERE id = ${id}`;
    return Response.json({ staff: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDbConfigured()) return Response.json({ ok: true });
  try {
    await sql`DELETE FROM sim_staff WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch {
    // Any error (likely FK constraint) — fall back to soft deactivation
    try {
      await sql`UPDATE sim_staff SET active = FALSE WHERE id = ${id}`;
      return Response.json({ ok: true, deactivated: true });
    } catch (e2) {
      return Response.json({ error: String(e2) }, { status: 500 });
    }
  }
}
