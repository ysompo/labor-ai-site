'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function ResearchUserBar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/simulator/auth/logout', { method: 'POST' });
    router.push('/tools/simulator/login');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      height: 40,
      background: '#ffffff',
      borderBottom: '1px solid rgba(75,46,106,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Left: home link */}
      <a
        href="/"
        style={{
          color: '#4B2E6A', fontSize: '0.82rem', fontWeight: 700,
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        🏠 Labor-AI
      </a>

      {/* Right: simulator + logout */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <a
          href="/tools/simulator"
          style={{
            border: '1px solid rgba(139,92,246,0.3)', color: '#4B2E6A',
            fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6,
            textDecoration: 'none', background: 'none',
          }}
        >
          🏥 סימולטור
        </a>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            background: 'none', border: '1px solid rgba(239,68,68,0.3)',
            color: '#dc2626', fontSize: '0.75rem',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', padding: '4px 10px', borderRadius: 6,
          }}
        >
          {loggingOut ? '...' : 'יציאה'}
        </button>
      </div>
    </div>
  );
}

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ResearchUserBar />
      <div style={{ paddingTop: 40 }}>
        {children}
      </div>
    </>
  );
}
