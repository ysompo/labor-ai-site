'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'login' | 'signup';

export default function SimulatorLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');

  // Login
  const [loginUser, setLoginUser]   = useState('');
  const [loginPass, setLoginPass]   = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup
  const [signUser, setSignUser]   = useState('');
  const [signPass, setSignPass]   = useState('');
  const [signEmail, setSignEmail] = useState('');
  const [signError, setSignError] = useState('');
  const [signDone, setSignDone]   = useState(false);
  const [signLoading, setSignLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: '0.9rem',
    fontFamily: 'inherit', outline: 'none', direction: 'rtl',
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const res = await fetch('/api/simulator/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUser.trim(), password: loginPass }),
    });
    const data = await res.json();
    setLoginLoading(false);
    if (!res.ok) { setLoginError(data.error ?? 'שגיאה'); return; }
    router.push('/tools/simulator');
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignError('');
    setSignLoading(true);
    const res = await fetch('/api/simulator/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: signUser.trim(), password: signPass, email: signEmail.trim() }),
    });
    const data = await res.json();
    setSignLoading(false);
    if (!res.ok) { setSignError(data.error ?? 'שגיאה'); return; }
    if (data.emailWarning) { setSignError(data.emailWarning); }
    setSignDone(true);
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh', background: '#0d0d1f',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏥</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Labor-AI Simulator</h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '6px 0 0' }}>Hadassah Mount Scopus</p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 28 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
            {(['login', 'signup'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '8px 0', background: 'none', border: 'none',
                  borderBottom: tab === t ? '2px solid #7c3aed' : '2px solid transparent',
                  color: tab === t ? '#c4b5fd' : '#6b7280',
                  fontWeight: tab === t ? 700 : 500, fontSize: '0.88rem',
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
                }}
              >
                {t === 'login' ? 'כניסה' : 'הרשמה'}
              </button>
            ))}
          </div>

          {/* Login form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>שם משתמש</label>
                <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="username" style={inputStyle} autoComplete="username" required />
              </div>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>סיסמה</label>
                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="••••••" style={inputStyle} autoComplete="current-password" required />
              </div>
              {loginError && (
                <div style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  marginTop: 4, padding: '11px 0', borderRadius: 8, border: 'none',
                  background: loginLoading ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
                  color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                  cursor: loginLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {loginLoading ? 'מתחבר...' : 'כניסה'}
              </button>
            </form>
          )}

          {/* Signup form */}
          {tab === 'signup' && (
            signDone ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>📨</div>
                <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>הבקשה נשלחה!</div>
                <div style={{ color: '#9ca3af', fontSize: '0.82rem', lineHeight: 1.7 }}>
                  בקשת ההרשמה שלך נשלחה למנהל לאישור.<br />
                  תקבל גישה לאחר האישור.
                </div>
                <button onClick={() => { setTab('login'); setSignDone(false); }} style={{ marginTop: 20, background: 'none', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#a78bfa', padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                  חזור לכניסה
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>שם משתמש</label>
                  <input type="text" value={signUser} onChange={e => setSignUser(e.target.value)} placeholder="username" style={inputStyle} autoComplete="username" required />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>סיסמה (לפחות 6 תווים)</label>
                  <input type="password" value={signPass} onChange={e => setSignPass(e.target.value)} placeholder="••••••" style={inputStyle} autoComplete="new-password" required minLength={6} />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>מייל</label>
                  <input type="email" value={signEmail} onChange={e => setSignEmail(e.target.value)} placeholder="you@example.com" style={{ ...inputStyle, direction: 'ltr' }} autoComplete="email" required />
                </div>
                {signError && (
                  <div style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                    {signError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={signLoading}
                  style={{
                    marginTop: 4, padding: '11px 0', borderRadius: 8, border: 'none',
                    background: signLoading ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
                    color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                    cursor: signLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {signLoading ? 'שולח בקשה...' : 'שלח בקשת הרשמה'}
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
