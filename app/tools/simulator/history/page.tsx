'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Session {
  id: number;
  session_code: string;
  scenario_name?: string;
  scenario_id?: number;
  instructor_name?: string; // JSON: {resident, midwife, observers}
  status: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  assessment_count?: number;
  assessment_form_types?: string; // comma-separated form types
}

interface Participants {
  resident?: string;
  midwife?: string;
  senior_doctor?: string;
  charge_midwife?: string;
  observers?: string[];
}

function parseParticipants(raw?: string): Participants {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { resident: raw }; }
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function duration(start?: string, end?: string): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.round((e - s) / 60000);
  if (mins < 1) return '< 1 דק׳';
  return `${mins} דק׳`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  setup:     { label: 'הגדרה',   color: '#6b7280' },
  running:   { label: 'פעיל',    color: '#22c55e' },
  debrief:   { label: 'דיבריפינג', color: '#3b82f6' },
  completed: { label: 'הושלם',   color: '#a78bfa' },
};

export default function SimulatorHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    fetch('/api/simulator/sessions')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        setSessions(d.sessions ?? []);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    if (!q) return true;
    const p = parseParticipants(s.instructor_name);
    return (
      s.session_code.toLowerCase().includes(q) ||
      (s.scenario_name ?? '').includes(q) ||
      (p.resident       ?? '').includes(q) ||
      (p.midwife        ?? '').includes(q) ||
      (p.senior_doctor  ?? '').includes(q) ||
      (p.charge_midwife ?? '').includes(q) ||
      (p.observers ?? []).some(o => o.includes(q))
    );
  });

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0d0d1f', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '24px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>📋 היסטוריית סימולציות</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '4px 0 0' }}>Labor-AI Lab · Hadassah Mount Scopus</p>
          </div>
          <Link href="/tools/simulator" style={{ background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)', color: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}>
            + סימולציה חדשה
          </Link>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי תרחיש, שם משתתף, קוד..."
          dir="rtl"
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 16,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: '0.85rem',
            outline: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Content */}
        {loading ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>טוען...</div>
        ) : error ? (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '16px 20px', color: '#fca5a5', fontSize: '0.82rem' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ שגיאה בטעינת ההיסטוריה</div>
            <div style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.75rem' }}>{error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
            {sessions.length === 0 ? 'אין סימולציות שמורות עדיין' : 'לא נמצאו תוצאות'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(s => {
              const p = parseParticipants(s.instructor_name);
              const status = STATUS_LABELS[s.status] ?? { label: s.status, color: '#6b7280' };
              const allParticipants = [p.resident, p.midwife, p.senior_doctor, p.charge_midwife, ...(p.observers ?? [])].filter(Boolean);

              return (
                <div
                  key={s.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(139,92,246,0.18)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '8px 20px',
                    alignItems: 'start',
                  }}
                >
                  {/* Left: main info */}
                  <div>
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '0.9rem' }}>
                        {s.scenario_name ?? '—'}
                      </span>
                      <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                        {s.session_code}
                      </span>
                      <span style={{
                        background: `${status.color}18`, color: status.color,
                        border: `1px solid ${status.color}40`,
                        borderRadius: 20, padding: '1px 10px', fontSize: '0.7rem', fontWeight: 600,
                      }}>
                        {status.label}
                      </span>
                    </div>

                    {/* Participants */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {p.resident && (
                        <span style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem' }}>
                          מתמחה: {p.resident}
                        </span>
                      )}
                      {p.midwife && (
                        <span style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem' }}>
                          מיילדת: {p.midwife}
                        </span>
                      )}
                      {p.senior_doctor && (
                        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem' }}>
                          רופא מומחה: {p.senior_doctor}
                        </span>
                      )}
                      {p.charge_midwife && (
                        <span style={{ background: 'rgba(245,158,11,0.1)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem' }}>
                          מיילדת אחראית: {p.charge_midwife}
                        </span>
                      )}
                      {(p.observers ?? []).filter(Boolean).map((o, i) => (
                        <span key={i} style={{ background: 'rgba(107,114,128,0.12)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.2)', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem' }}>
                          👁 {o}
                        </span>
                      ))}
                      {allParticipants.length === 0 && (
                        <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>אין משתתפים רשומים</span>
                      )}
                    </div>

                    {/* Date + duration */}
                    <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem', color: '#6b7280' }}>
                      <span>📅 {formatDate(s.created_at)}</span>
                      {s.started_at && <span>⏱ {duration(s.started_at, s.ended_at)}</span>}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {s.status === 'running' && (
                      <Link
                        href={`/tools/simulator?code=${s.session_code}`}
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        ▶ המשך
                      </Link>
                    )}
                    <Link
                      href={`/tools/simulator/evaluate/${s.session_code}`}
                      style={{ background: 'rgba(124,58,237,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      📝 הערכה
                    </Link>
                    {(s.assessment_count ?? 0) > 0 && (s.assessment_form_types ?? '').split(',').map((type, i) => (
                      <a
                        key={i}
                        href={`/api/simulator/assessments/${s.session_code}/pdf?index=${i}`}
                        download
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        📄 PDF {s.assessment_count! > 1 ? `(${type === 'resident' ? 'בכיר' : type === 'resident_junior' ? 'צעיר' : 'מיילדת'})` : ''}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
