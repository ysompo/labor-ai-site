import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getSimState, setSimState } from '@/lib/sessionStore';
import { isDbConfigured } from '@/lib/db';

if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is not set');
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET);

// GET: Public — trainee devices poll this without auth
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const entry = await getSimState(code);
  return Response.json({
    payload: entry?.payload ?? null,
    updatedAt: entry?.updatedAt ?? null,
    dbOk: isDbConfigured(),
  });
}

// PUT: Instructor-only — verify JWT from cookie directly (route is outside middleware matcher)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const token = req.cookies.get('sim_auth')?.value;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await jwtVerify(token, SECRET);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { code } = await params;
  const body = await req.json();
  await setSimState(code, body);
  return Response.json({ ok: true });
}
