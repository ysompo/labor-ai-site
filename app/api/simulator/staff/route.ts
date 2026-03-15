import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';

const MOCK_STAFF = [
  { id: 1, name: 'ד"ר רונן לוי', role: 'רופא בכיר', email: 'ronen@hadassah.org', active: true },
  { id: 2, name: 'אחות מיכל שמיר', role: 'מיילדת אחראית', email: 'michal@hadassah.org', active: true },
  { id: 3, name: 'ד"ר נועה ברגר', role: 'מתמחה', email: 'noa@hadassah.org', active: true },
  { id: 4, name: 'שירה כהן', role: 'מיילדת', email: 'shira@hadassah.org', active: true },
];

export async function GET() {
  if (!isDbConfigured()) return Response.json({ staff: MOCK_STAFF });
  try {
    const result = await sql`SELECT * FROM sim_staff WHERE active = TRUE ORDER BY role, name`;
    return Response.json({ staff: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; role: string; email?: string };
  if (!isDbConfigured()) {
    return Response.json({ staff: { id: Date.now(), ...body, active: true } });
  }
  try {
    const result = await sql`
      INSERT INTO sim_staff (name, role, email) VALUES (${body.name}, ${body.role}, ${body.email ?? ''})
      RETURNING *
    `;
    return Response.json({ staff: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
