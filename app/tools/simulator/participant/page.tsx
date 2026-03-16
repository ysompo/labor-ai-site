'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ParticipantJoinPage() {
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('נא להזין קוד סשן'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/simulator/sessions/${trimmed}`);
      if (!res.ok) { setError('קוד סשן לא נמצא — בדוק שוב'); setLoading(false); return; }
      router.push(`/tools/simulator/participant/${trimmed}`);
    } catch {
      setError('שגיאת תקשורת — נסה שוב');
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8, padding: '12px 16px', color: '#f1f5f9', fontSize: '1.1rem',
    fontFamily: 'monospace', outline: 'none', textAlign: 'center', letterSpacing: '0.15em',
    textTransform: 'uppercase',
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh', background: '#0d0d1f',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏥</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Labor-AI Simulator</h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '6px 0 0' }}>Hadassah Mount Scopus</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 28 }}>
          <h2 style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '1rem', margin: '0 0 20px', textAlign: 'center' }}>
            הצטרף לסימולציה
          </h2>
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 8 }}>
                קוד סשן (לדוגמה: SIM-XXXX)
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="SIM-XXXX"
                style={inputStyle}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </div>
            {error && (
              <div style={{ color: '#f87171', fontSize: '0.82rem', textAlign: 'center', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4, padding: '12px 0', borderRadius: 8, border: 'none',
                background: loading ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
                color: '#fff', fontWeight: 700, fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {loading ? 'מתחבר...' : 'הצטרף לסימולציה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
