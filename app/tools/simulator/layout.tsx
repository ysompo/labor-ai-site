'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur]   = useState('');
  const [next, setNext] = useState('');
  const [err, setErr]   = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await fetch('/api/simulator/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(data.error ?? 'שגיאה'); return; }
    setDone(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        dir="rtl"
        style={{
          background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 16, padding: 28, width: '100%', maxWidth: 340,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ color: '#c4b5fd', fontSize: '1rem', fontWeight: 700, margin: '0 0 20px' }}>
          שינוי סיסמה
        </h3>

        {done ? (
          <div style={{ textAlign: 'center', color: '#86efac', fontSize: '0.9rem', padding: '12px 0' }}>
            ✓ הסיסמה שונתה בהצלחה
            <br />
            <button onClick={onClose} style={{ marginTop: 16, background: 'none', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#a78bfa', padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
              סגור
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'סיסמה נוכחית', val: cur, set: setCur, auto: 'current-password' },
              { label: 'סיסמה חדשה (לפחות 6 תווים)', val: next, set: setNext, auto: 'new-password' },
            ].map(({ label, val, set, auto }) => (
              <div key={label}>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>{label}</label>
                <input
                  type="password" value={val} onChange={e => set(e.target.value)}
                  autoComplete={auto} required minLength={auto === 'new-password' ? 6 : undefined}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', direction: 'rtl' }}
                />
              </div>
            ))}
            {err && <div style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: 'none', color: '#9ca3af', fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                ביטול
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: loading ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function UserBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [showChangePass, setShowChangePass] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Don't show the user bar on the login page
  if (pathname === '/tools/simulator/login') return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/simulator/auth/logout', { method: 'POST' });
    router.push('/tools/simulator/login');
  };

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        height: 36,
        background: 'rgba(13,13,31,0.92)',
        borderBottom: '1px solid rgba(139,92,246,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 14px', gap: 10,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        backdropFilter: 'blur(8px)',
      }} className="sim-userbar">
        <a
          href="/"
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'inherit', padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}
        >
          🏠 Labor-AI
        </a>
        <button
          onClick={() => setShowChangePass(true)}
          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6 }}
        >
          🔑 שנה סיסמה
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.75rem', cursor: loggingOut ? 'not-allowed' : 'pointer', fontFamily: 'inherit', padding: '4px 10px', borderRadius: 6 }}
        >
          {loggingOut ? '...' : 'יציאה'}
        </button>
      </div>
      {showChangePass && <ChangePasswordModal onClose={() => setShowChangePass(false)} />}
    </>
  );
}

function PortraitLock() {
  const pathname = usePathname();
  // Only lock during live sessions — setup page works fine in portrait
  const shouldLock = pathname.startsWith('/tools/simulator/live/');
  if (!shouldLock) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#0d0d1f', display: 'none',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 20, color: '#f1f5f9',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          textAlign: 'center', padding: 32,
        }}
        className="portrait-lock"
      >
        <div style={{ fontSize: '4rem', animation: 'spin90 1.5s ease-in-out infinite alternate' }}>📱</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>סובבו את המסך</div>
        <div style={{ fontSize: '0.85rem', color: '#9ca3af', maxWidth: 260, lineHeight: 1.7 }}>
          הסימולטור מיועד לשימוש במצב אופקי (Landscape).<br />
          אנא סובבו את הטאבלט.
        </div>
      </div>
      <style>{`
        @media (orientation: portrait) and (min-width: 600px) {
          .portrait-lock { display: flex !important; }
        }
        @keyframes spin90 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(90deg); }
        }
      `}</style>
    </>
  );
}

export default function SimulatorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UserBar />
      {children}
      <PortraitLock />
      <style>{`
        /* Push page content below user bar (except login page) */
        .sim-userbar ~ * { padding-top: 36px; }
      `}</style>
    </>
  );
}
