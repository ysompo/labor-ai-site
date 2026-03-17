import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'labor-ai-simulator-secret-key-change-in-production'
);

const PUBLIC = [
  '/tools/simulator/login',
  '/tools/simulator/reset-password',
  '/tools/simulator/participant',
  '/api/simulator/auth/',
  '/api/simulator/sessions/',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect old Safari (WebKit < 612 = Safari < 15 = iOS < 15) to vanilla JS page.
  // React 19 requires Safari 15+; older devices get a framework-free fallback.
  if (pathname.match(/^\/tools\/simulator\/participant\/[^/]+$/) ) {
    const ua = req.headers.get('user-agent') || '';
    const wk = /AppleWebKit\/(\d+)/.exec(ua);
    if (wk && parseInt(wk[1]) < 612) {
      const code = pathname.split('/').pop();
      return NextResponse.redirect(new URL(`/tools/simulator/participant/${code}/html`, req.url));
    }
  }

  const isSimPage      = pathname.startsWith('/tools/simulator');
  const isSimApi       = pathname.startsWith('/api/simulator');
  const isResearchPage = pathname.startsWith('/tools/research');
  const isResearchApi  = pathname.startsWith('/api/research');

  if (!isSimPage && !isSimApi && !isResearchPage && !isResearchApi) return NextResponse.next();

  // Public auth routes — always allowed
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('sim_auth')?.value;

  const isApi = isSimApi || isResearchApi;

  if (!token) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/tools/simulator/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const res = NextResponse.next();
    res.headers.set('x-username', String(payload.username ?? ''));
    res.headers.set('x-user-id',  String(payload.userId  ?? ''));
    res.headers.set('x-is-admin', String(payload.isAdmin ?? false));
    return res;
  } catch {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const res = NextResponse.redirect(new URL('/tools/simulator/login', req.url));
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
