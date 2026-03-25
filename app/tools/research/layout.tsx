'use client';

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Memory {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
}

function MemoriesPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/research/memories');
      const data = await res.json() as { memories?: Memory[] };
      if (data.memories) setMemories(data.memories);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchMemories();
  }, [open, fetchMemories]);

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await fetch('/api/research/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
    setDeleting(null);
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.35)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 10001,
          width: 340,
          background: '#ffffff',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          direction: 'rtl',
        }}
      >
        <div style={{
          padding: '16px 18px',
          borderBottom: '1px solid rgba(75,46,106,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#4B2E6A',
          color: '#fff',
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🧠 זיכרון AI</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && (
            <div style={{ color: '#6b7280', fontSize: '0.82rem', textAlign: 'center', paddingTop: 24 }}>
              טוען...
            </div>
          )}
          {!loading && memories.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: '0.82rem', textAlign: 'center', paddingTop: 24, lineHeight: 1.7 }}>
              אין זיכרונות עדיין.<br />
              אמור ל-AI "זכור ש..." כדי לשמור מידע.
            </div>
          )}
          {memories.map(m => (
            <div
              key={m.id}
              style={{
                background: 'rgba(75,46,106,0.05)',
                border: '1px solid rgba(75,46,106,0.12)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <p style={{ margin: 0, color: '#1a1a2e', fontSize: '0.82rem', lineHeight: 1.6, flex: 1 }}>
                {m.content}
              </p>
              <button
                onClick={() => handleDelete(m.id)}
                disabled={deleting === m.id}
                style={{
                  background: 'none', border: 'none',
                  color: deleting === m.id ? '#d1d5db' : '#ef4444',
                  cursor: deleting === m.id ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem', padding: 0, flexShrink: 0, lineHeight: 1,
                }}
                title="מחק זיכרון"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(75,46,106,0.1)', color: '#9ca3af', fontSize: '0.7rem', textAlign: 'center' }}>
          זיכרונות אלו מוזנים ל-AI בכל שיחה
        </div>
      </div>
    </>
  );
}

function ResearchUserBar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut]       = useState(false);
  const [memoriesOpen, setMemoriesOpen]   = useState(false);
  const [username, setUsername]           = useState('');

  useEffect(() => {
    try {
      const raw = document.cookie.split('; ').find(c => c.startsWith('sim_meta='));
      if (raw) {
        const val = decodeURIComponent(raw.split('=').slice(1).join('='));
        const meta = JSON.parse(val) as { username?: string };
        if (meta.username) setUsername(meta.username);
      }
    } catch { /* ignore */ }
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/simulator/auth/logout', { method: 'POST' });
    router.push('/tools/research/login');
  };

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        height: 40,
        background: '#ffffff',
        borderBottom: '1px solid rgba(75,46,106,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        direction: 'rtl',
      }}>
        {/* Right: home + dashboard */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a
            href="/"
            style={{
              color: '#4B2E6A', fontSize: '0.82rem', fontWeight: 700,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🏠 Labor-AI
          </a>
          <a
            href="/tools/research"
            style={{
              border: '1px solid rgba(75,46,106,0.25)', color: '#4B2E6A',
              fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6,
              textDecoration: 'none', background: 'none',
            }}
          >
            🔬 לוח מחקר
          </a>
        </div>

        {/* Left: username + memories + logout */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {username && (
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              שלום, {username}
            </span>
          )}
          <button
            onClick={() => setMemoriesOpen(true)}
            style={{
              border: '1px solid rgba(75,46,106,0.25)', color: '#4B2E6A',
              fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6,
              background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🧠 זיכרון
          </button>
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

      <MemoriesPanel open={memoriesOpen} onClose={() => setMemoriesOpen(false)} />
    </>
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
