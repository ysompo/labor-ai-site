import { NextRequest } from 'next/server';
import { getSimState, setSimState } from '@/lib/sessionStore';

// Public endpoint — no auth required (trainee is unauthenticated)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const entry = getSimState(code);
  return Response.json({ payload: entry?.payload ?? null, updatedAt: entry?.updatedAt ?? null });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  setSimState(code, body);
  return Response.json({ ok: true });
}
