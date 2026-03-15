'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function JoinSimulatorPage() {
  const searchParams  = useSearchParams();
  const [code, setCode]       = useState('');
  const [name, setName]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Pre-fill code from QR link (?code=SIM-XXXX)
  useEffect(() => {
    const c = searchParams.get('code');
    if (c) setCode(c.toUpperCase());
  }, [searchParams]);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed.startsWith('SIM-') || trimmed.length !== 8) {
      setError('קוד לא תקין — פורמט: SIM-XXXX');
      return;
    }
    if (!name.trim()) {
      setError('נא להזין שם');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/simulator/sessions/${trimmed}`);
      if (!res.ok) { setError('קוד סימולציה לא נמצא'); setLoading(false); return; }
    } catch { /* offline graceful */ }
    router.push(`/tools/simulator/participant/${trimmed}?name=${encodeURIComponent(name.trim())}`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d1f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
      dir="rtl"
    >
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏥</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            הצטרף לסימולציה
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: '6px 0 0' }}>
            מיילדת אחראית — צפייה והערכה
          </p>
        </div>

        {/* Name input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#c4b5fd', fontSize: '0.8rem', fontWeight: 600 }}>שמך (מיילדת אחראית / מעריך)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="שם מלא"
            autoFocus={!!searchParams.get('code')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '10px 12px',
              color: '#f1f5f9',
              fontSize: '0.9rem',
              outline: 'none',
              direction: 'rtl',
            }}
          />
        </div>

        {/* Code input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#c4b5fd', fontSize: '0.8rem', fontWeight: 600 }}>קוד סימולציה</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="SIM-XXXX"
            maxLength={8}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${code.length === 8 ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: '#f1f5f9',
              fontSize: '1.1rem',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              outline: 'none',
              direction: 'ltr',
              textAlign: 'center',
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center' }}>{error}</div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading}
          style={{
            background: loading ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '13px 0',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'מתחבר...' : 'הצטרף לסימולציה ▶'}
        </button>

        <div style={{ textAlign: 'center', marginTop: -8 }}>
          <Link href="/tools/simulator" style={{ color: '#7c3aed', fontSize: '0.8rem', textDecoration: 'none' }}>
            ← חזור
          </Link>
        </div>
      </div>
    </div>
  );
}
