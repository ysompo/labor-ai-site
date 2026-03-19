import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'labor-ai-simulator-secret-key-change-in-production'
);

const PUBLIC = [
  '/tools/simulator/login',
  '/tools/simulator/reset-password',
  '/api/simulator/auth/',
  '/api/sim-state/',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isSimPage      = pathname.startsWith('/tools/simulator');
  const isSimApi       = pathname.startsWith('/api/simulator');
  const isResearchPage = pathname.startsWith('/tools/research');
  const isResearchApi  = pathname.startsWith('/api/research');

  if (!isSimPage && !isSimApi && !isResearchPage && !isResearchApi) return NextResponse.next();

  // Public routes — always allowed
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('sim_auth')?.value;

  const isApi = isSimApi || isResearchApi;

  if (!token) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Preserve destination so login can redirect back
    const loginUrl = new URL('/tools/simulator/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const res = NextResponse.next();
    res.headers.set('x-username', String(payload.username ?? ''));
    res.headers.set('x-user-id',  String(payload.userId  ?? ''));
    res.headers.set('x-is-admin', String(payload.isAdmin ?? false));
    res.headers.set('x-role',     String(payload.role     ?? 'trainee'));
    return res;
  } catch {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const loginUrl = new URL('/tools/simulator/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('sim_auth');
    return res;
  }
}

export const config = {
  matcher: [
    '/tools/simulator/:path*',
    '/api/simulator/:path*',
    '/tools/research/:path*',
    '/api/research/:path*',
  ],
};
