'use client';

import { useState, useActionState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginAction } from './actions';

type Tab = 'login' | 'signup' | 'forgot' | 'invite';

const MODULES: Record<string, { label: string; icon: string; color: string }> = {
  simulator:      { label: 'Labor-AI Simulator',        icon: '⚙️', color: '#4B2E6A' },
  research:       { label: 'Research Assistant',         icon: '🔬', color: '#2563eb' },
  'journal-club': { label: 'Journal Club',               icon: '📚', color: '#005977' },
  default:        { label: 'Labor-AI',                   icon: '🏥', color: '#374151' },
};

function detectModule(redirect: string) {
  if (redirect.includes('/simulator'))      return MODULES.simulator;
  if (redirect.includes('/research'))       return MODULES.research;
  if (redirect.includes('/journal-club'))   return MODULES['journal-club'];
  return MODULES.default;
}

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px', borderRadius: 8,
  border: '1px solid #e2e8f0', background: '#f9fafb',
  fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none',
  color: '#191c1e', transition: 'border-color 0.15s, background 0.15s',
};

export default function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ redirect?: string; invite?: string }>;
}) {
  const searchParams = use(searchParamsPromise);
  const redirectTo   = searchParams.redirect  ?? '';
  const inviteToken  = searchParams.invite    ?? '';
  const mod          = detectModule(redirectTo);

  const router = useRouter();
  const [tab, setTab] = useState<Tab>(inviteToken ? 'invite' : 'login');

  const [loginState, formAction, loginPending] = useActionState(loginAction, null);

  // Forgot password
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotDone,    setForgotDone]    = useState(false);
  const [forgotError,   setForgotError]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Signup
  const [signUser,      setSignUser]      = useState('');
  const [signPass,      setSignPass]      = useState('');
  const [signEmail,     setSignEmail]     = useState('');
  const [signError,     setSignError]     = useState('');
  const [signEmailWarn, setSignEmailWarn] = useState('');
  const [signDone,      setSignDone]      = useState(false);
  const [signLoading,   setSignLoading]   = useState(false);

  // Invite set-password
  const [invitePass,    setInvitePass]    = useState('');
  const [invitePass2,   setInvitePass2]   = useState('');
  const [inviteError,   setInviteError]   = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);


  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    const res  = await fetch('/api/simulator/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail.trim() }),
    });
    const data = await res.json();
    setForgotLoading(false);
    if (!res.ok) { setForgotError(data.error ?? 'שגיאה'); return; }
    setForgotDone(true);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignError('');
    setSignLoading(true);
    const res  = await fetch('/api/simulator/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: signUser.trim(), password: signPass, email: signEmail.trim() }),
    });
    const data = await res.json();
    setSignLoading(false);
    if (!res.ok) { setSignError(data.error ?? 'שגיאה'); return; }
    if (data.emailWarning) setSignEmailWarn(data.emailWarning);
    setSignDone(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    if (invitePass !== invitePass2) { setInviteError('הסיסמאות אינן תואמות'); return; }
    if (invitePass.length < 6)      { setInviteError('סיסמה חייבת להכיל לפחות 6 תווים'); return; }
    setInviteLoading(true);
    const res  = await fetch('/api/simulator/auth/set-invite-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken, password: invitePass }),
    });
    const data = await res.json();
    setInviteLoading(false);
    if (!res.ok) { setInviteError(data.error ?? 'שגיאה'); return; }
    router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
  };

  const btn = (color: string, disabled = false): React.CSSProperties => ({
    width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
    background: disabled ? '#d1d5db' : color,
    color: '#fff', fontWeight: 700, fontSize: '0.95rem',
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Back to Labor-AI */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, fontWeight: 600, color: '#6b7280', textDecoration: 'none',
          }}>
            ← Labor-AI
          </Link>
        </div>

        {/* Module logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, margin: '0 auto 14px',
            background: mod.color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 26,
          }}>
            {mod.icon}
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            {mod.label}
          </h1>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '6px 0 0' }}>Hadassah Medical Center</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff', borderRadius: 16, padding: 32,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
        }}>

          {/* Tabs */}
          {tab !== 'invite' && (
            <div style={{ display: 'flex', marginBottom: 24, borderBottom: '2px solid #f3f4f6' }}>
              {(['login', 'signup'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: '8px 0', background: 'none', border: 'none',
                    borderBottom: tab === t ? `2px solid ${mod.color}` : '2px solid transparent',
                    color: tab === t ? mod.color : '#9ca3af',
                    fontWeight: tab === t ? 700 : 500, fontSize: '0.9rem',
                    cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2,
                  }}
                >
                  {t === 'login' ? 'כניסה' : 'הרשמה'}
                </button>
              ))}
            </div>
          )}

          {tab === 'forgot' && (
            <button
              onClick={() => setTab('login')}
              style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', padding: '0 0 14px', display: 'block' }}
            >
              ← חזור לכניסה
            </button>
          )}

          {/* ── Login ── */}
          {tab === 'login' && (
            <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="hidden" name="redirect" value={redirectTo} />
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>שם משתמש</label>
                <input
                  type="text" name="username" placeholder="username"
                  style={input} autoComplete="username"
                  onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>סיסמה</label>
                <input
                  type="password" name="password" placeholder="••••••"
                  style={input} autoComplete="current-password"
                  onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                />
              </div>
              {loginState?.error && (
                <div style={{ color: '#dc2626', fontSize: '0.82rem', padding: '8px 12px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
                  {loginState.error}
                </div>
              )}
              <button type="submit" disabled={loginPending} style={btn(mod.color, loginPending)}>
                {loginPending ? 'מתחבר...' : 'כניסה'}
              </button>
              <button
                type="button"
                onClick={() => { setTab('forgot'); setForgotDone(false); setForgotError(''); setForgotEmail(''); }}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', padding: '2px 0' }}
              >
                שכחתי סיסמה
              </button>
            </form>
          )}

          {/* ── Forgot password ── */}
          {tab === 'forgot' && (
            forgotDone ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>📨</div>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: 8 }}>בדוק את תיבת הדואר</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.7 }}>
                  אם הכתובת קיימת במערכת,<br />נשלח אליה קישור לאיפוס הסיסמה.
                </div>
                <button
                  onClick={() => setTab('login')}
                  style={{ marginTop: 20, background: 'none', border: `1px solid ${mod.color}`, borderRadius: 8, color: mod.color, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
                >
                  חזור לכניסה
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                  הזן את כתובת המייל שרשמת בהרשמה — נשלח קישור לאיפוס הסיסמה.
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>כתובת מייל</label>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" style={{ ...input, direction: 'ltr' }} autoComplete="email" required
                    onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                  />
                </div>
                {forgotError && <div style={{ color: '#dc2626', fontSize: '0.82rem', padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{forgotError}</div>}
                <button type="submit" disabled={forgotLoading} style={btn(mod.color, forgotLoading)}>
                  {forgotLoading ? 'שולח...' : 'שלח קישור איפוס'}
                </button>
              </form>
            )
          )}

          {/* ── Signup ── */}
          {tab === 'signup' && (
            signDone ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: 8 }}>הבקשה נשלחה!</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.7 }}>
                  בקשת ההרשמה שלך נשלחה למנהל לאישור.<br />
                  תקבל גישה לאחר האישור.
                </div>
                {signEmailWarn && (
                  <div style={{ marginTop: 12, color: '#92400e', fontSize: '0.78rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px' }}>
                    ⚠ {signEmailWarn}
                  </div>
                )}
                <button onClick={() => { setTab('login'); setSignDone(false); }} style={{ marginTop: 20, background: 'none', border: `1px solid ${mod.color}`, borderRadius: 8, color: mod.color, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                  חזור לכניסה
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>שם משתמש</label>
                  <input type="text" value={signUser} onChange={e => setSignUser(e.target.value)} placeholder="username" style={input} required
                    onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>כתובת מייל</label>
                  <input type="email" value={signEmail} onChange={e => setSignEmail(e.target.value)} placeholder="you@example.com" style={{ ...input, direction: 'ltr' }} required
                    onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>סיסמה</label>
                  <input type="password" value={signPass} onChange={e => setSignPass(e.target.value)} placeholder="לפחות 6 תווים" style={input} required
                    onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                  />
                </div>
                {signError && <div style={{ color: '#dc2626', fontSize: '0.82rem', padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{signError}</div>}
                <button type="submit" disabled={signLoading} style={btn(mod.color, signLoading)}>
                  {signLoading ? 'שולח...' : 'בקש גישה'}
                </button>
              </form>
            )
          )}

          {/* ── Invite set-password ── */}
          {tab === 'invite' && (
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '1rem' }}>הגדר סיסמה</div>
                <div style={{ color: '#6b7280', fontSize: '0.83rem', marginTop: 4 }}>בחר סיסמה להתחברות לחשבונך</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>סיסמה חדשה</label>
                <input type="password" value={invitePass} onChange={e => setInvitePass(e.target.value)} placeholder="לפחות 6 תווים" style={input} required
                  onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>אימות סיסמה</label>
                <input type="password" value={invitePass2} onChange={e => setInvitePass2(e.target.value)} placeholder="הזן שוב" style={input} required
                  onFocus={e => { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f9fafb'; }}
                />
              </div>
              {inviteError && <div style={{ color: '#dc2626', fontSize: '0.82rem', padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{inviteError}</div>}
              <button type="submit" disabled={inviteLoading} style={btn(mod.color, inviteLoading)}>
                {inviteLoading ? 'שומר...' : 'הגדר סיסמה והתחבר'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 24 }}>
          Labor-AI · Hadassah Medical Center
        </p>
      </div>
    </div>
  );
}
