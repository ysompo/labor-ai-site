import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is not set');
}
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET);

const PUBLIC = [
  '/tools/simulator/login',
  '/tools/simulator/reset-password',
  '/tools/simulator/participant/',   // trainees join without auth
  '/tools/simulator/join/',          // join page is public
  '/tools/research/login',
  '/api/simulator/auth/',
  '/api/sim-state/',
  '/api/pusher/',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // iOS < 13 cannot run React 19 — redirect participant pages to vanilla HTML
  const ua = req.headers.get('user-agent') ?? '';
  const iosMatch = ua.match(/(?:iPhone|iPad|iPod).*OS (\d+)_/);
  const iosVer = iosMatch ? parseInt(iosMatch[1], 10) : 99;
  if (iosVer < 13) {
    const m = pathname.match(/^(\/tools\/simulator\/participant\/[^/]+)$/);
    if (m) {
      const dest = new URL(req.url);
      dest.pathname = m[1] + '/html';
      return NextResponse.redirect(dest);
    }
  }

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
    const loginBase = isResearchPage ? '/tools/research/login' : '/tools/simulator/login';
    const loginUrl = new URL(loginBase, req.url);
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
    const loginBase = isResearchPage ? '/tools/research/login' : '/tools/simulator/login';
    const loginUrl = new URL(loginBase, req.url);
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
