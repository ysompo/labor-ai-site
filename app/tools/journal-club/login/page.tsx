import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import Link from 'next/link';

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'labor-ai-simulator-secret-key-change-in-production';
const SECRET = new TextEncoder().encode(AUTH_SECRET);

export const metadata = {
  title: 'Login — Journal Club',
};

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sim_auth')?.value;

  if (!token) return null;

  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const isAuth = await checkAuth();

  // If already logged in, redirect to journals
  if (isAuth) {
    redirect('/tools/journal-club/journals');
  }

  return (
    <html lang="en">
      <head>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%);
            color: #191c1e;
            min-height: 100vh;
          }
        `}</style>
      </head>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            {/* Back button */}
            <div style={{ marginBottom: '32px' }}>
              <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: '600', color: '#005977', textDecoration: 'none' }}>
                ← Back to Home
              </Link>
            </div>

            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: '#005977',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontFamily: 'Noto Serif',
                fontWeight: 'bold',
                fontSize: '24px',
                margin: '0 auto 16px',
              }}>
                JC
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#005977', margin: 0 }}>Journal Club</h1>
              <p style={{ fontSize: '14px', color: '#9ca3af', margin: '8px 0 0' }}>HUJI · PDF Library</p>
            </div>

            {/* Login Form */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 13px rgba(0, 0, 0, 0.07)',
              border: '1px solid #e2e8f0',
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', color: '#191c1e' }}>Sign In</h2>

              <form action="/api/journal-club/auth/login" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#191c1e', marginBottom: '6px' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#f9fafb',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#191c1e',
                      fontFamily: 'inherit',
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                    placeholder="Your username"
                    onFocus={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#005977';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#191c1e', marginBottom: '6px' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#f9fafb',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#191c1e',
                      fontFamily: 'inherit',
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                    placeholder="Your password"
                    onFocus={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#005977';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    marginTop: '8px',
                    padding: '12px 16px',
                    background: '#005977',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#007398';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#005977';
                  }}
                >
                  Sign In
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af', marginTop: '16px' }}>
                You use your Labor-AI account to access Journal Club.
              </p>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: '#9ca3af' }}>
              <p style={{ margin: 0 }}>Need help? Contact support</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
