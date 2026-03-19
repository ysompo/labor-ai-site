'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';

function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);
  const [loading, setLoading]   = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: '0.9rem',
    fontFamily: 'inherit', outline: 'none', direction: 'rtl',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('הסיסמאות אינן תואמות'); return; }
    setError('');
    setLoading(true);
    const res = await fetch('/api/simulator/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'שגיאה'); return; }
    setDone(true);
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔑</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>איפוס סיסמה</h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '6px 0 0' }}>Labor-AI Simulator</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 28 }}>
          {!token ? (
            <div style={{ color: '#f87171', textAlign: 'center', fontSize: '0.88rem' }}>קישור לא תקין</div>
          ) : done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
              <div style={{ color: '#86efac', fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>הסיסמה אופסה בהצלחה!</div>
              <button
                onClick={() => router.push('/tools/simulator/login')}
                style={{ marginTop: 16, background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 28px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700 }}
              >
                כניסה
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>סיסמה חדשה (לפחות 6 תווים)</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" style={inputStyle} autoComplete="new-password" required minLength={6} />
              </div>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>אימות סיסמה</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••" style={inputStyle} autoComplete="new-password" required minLength={6} />
              </div>
              {error && (
                <div style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{ marginTop: 4, padding: '11px 0', borderRadius: 8, border: 'none', background: loading ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {loading ? 'מאפס...' : 'אפס סיסמה'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Server Component — reads token from searchParams on the server
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = use(searchParams);
  return <ResetPasswordForm token={params.token ?? ''} />;
}
