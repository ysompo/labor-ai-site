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
      height: 36,
      background: 'rgba(13,17,23,0.95)',
      borderBottom: '1px solid rgba(56,139,253,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      padding: '0 14px', gap: 10,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      backdropFilter: 'blur(8px)',
    }}>
      <a
        href="/tools/simulator"
        style={{
          background: 'none', border: '1px solid rgba(139,92,246,0.3)',
          color: '#c4b5fd', fontSize: '0.75rem', cursor: 'pointer',
          fontFamily: 'inherit', padding: '4px 10px', borderRadius: 6,
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
        }}
      >
        🏥 סימולטור
      </a>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        style={{
          background: 'none', border: '1px solid rgba(239,68,68,0.3)',
          color: '#f87171', fontSize: '0.75rem',
          cursor: loggingOut ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', padding: '4px 10px', borderRadius: 6,
        }}
      >
        {loggingOut ? '...' : 'יציאה'}
      </button>
    </div>
  );
}

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ResearchUserBar />
      <div style={{ paddingTop: 36 }}>
        {children}
      </div>
    </>
  );
}
