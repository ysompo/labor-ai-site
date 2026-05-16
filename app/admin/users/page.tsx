'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const StaffRoster = dynamic(() => import('@/components/tools/simulator/admin/StaffRoster'), { ssr: false });

type User = {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  is_admin: boolean;
  approved: boolean;
  deactivated: boolean;
  has_jc: boolean;
  has_ra: boolean;
  last_active: string | null;
  has_pending_invite: boolean;
};

const ROLES = ['מתמחה', 'בכיר', 'מיילדת', 'physician_instructor', 'trainee'];

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
  background: '#f9fafb', fontSize: '0.85rem', fontFamily: 'inherit',
  color: '#111827', outline: 'none', boxSizing: 'border-box',
};

export default function AdminUsersPage() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [editId,      setEditId]      = useState<number | null>(null);
  const [editForm,    setEditForm]    = useState({ display_name: '', role: '', email: '' });
  const [saving,      setSaving]      = useState(false);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [inviteForm,  setInviteForm]  = useState({ username: '', email: '', role: 'מתמחה', display_name: '' });
  const [inviteResult, setInviteResult] = useState<{ url?: string; error?: string } | null>(null);
  const [tab,         setTab]         = useState<'all' | 'pending' | 'roster'>('all');

  const load = useCallback(() => {
    fetch('/api/simulator/admin/users', { cache: 'no-store' })
      .then(res => res.json().then((data: { users?: User[]; error?: string }) => {
        if (!res.ok || data.error) setError(data.error ?? `HTTP ${res.status}`);
        else { setError(''); setUsers(data.users ?? []); }
        setLoading(false);
      }))
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: number, fields: Record<string, unknown>) => {
    setSaving(true);
    await fetch('/api/simulator/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    await load();
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editId) return;
    await patch(editId, { role: editForm.role, display_name: editForm.display_name });
    setEditId(null);
  };

  const invite = async () => {
    if (!inviteForm.username.trim()) return;
    setSaving(true);
    setInviteResult(null);
    const res  = await fetch('/api/simulator/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });
    const data = await res.json() as { ok?: boolean; inviteUrl?: string; error?: string; emailError?: string };
    setSaving(false);
    if (!res.ok || data.error) { setInviteResult({ error: data.error }); return; }
    setInviteResult({ url: data.inviteUrl });
    setInviteForm({ username: '', email: '', role: 'מתמחה', display_name: '' });
    await load();
  };

  const q = search.toLowerCase();
  const visible = users.filter(u => {
    if (tab === 'pending' && (u.approved || u.deactivated)) return false;
    if (!q) return true;
    return (u.username + (u.display_name ?? '') + (u.email ?? '') + u.role).toLowerCase().includes(q);
  });

  const pending = users.filter(u => !u.approved && !u.deactivated).length;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '24px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#111827', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>ניהול משתמשים</h1>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '4px 0 0' }}>
              {users.filter(u => !u.deactivated && u.approved).length} פעילים · {pending} ממתינים לאישור · Labor-AI
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#6b7280', fontSize: '0.8rem', textDecoration: 'none' }}>← Labor-AI</Link>
            <button
              onClick={() => { setInviteOpen(o => !o); setInviteResult(null); }}
              style={{ background: '#4B2E6A', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', padding: '8px 18px', fontFamily: 'inherit' }}
            >
              + הזמן משתמש
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#dc2626', fontSize: '0.83rem', display: 'flex', justifyContent: 'space-between' }}>
            {error}
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
          </div>
        )}

        {/* Invite form */}
        {inviteOpen && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#111827', marginBottom: 14, fontSize: '0.9rem' }}>הזמנת משתמש חדש</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { label: 'שם משתמש *', key: 'username', placeholder: 'username', type: 'text' },
                { label: 'שם לתצוגה', key: 'display_name', placeholder: 'שם מלא', type: 'text' },
                { label: 'מייל', key: 'email', placeholder: 'name@hospital.org', type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ color: '#374151', fontSize: '0.72rem', display: 'block', marginBottom: 4, fontWeight: 600 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={inviteForm[f.key as keyof typeof inviteForm]}
                    onChange={e => setInviteForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ ...inp, width: '100%' }}
                    onKeyDown={e => e.key === 'Enter' && invite()}
                  />
                </div>
              ))}
              <div>
                <label style={{ color: '#374151', fontSize: '0.72rem', display: 'block', marginBottom: 4, fontWeight: 600 }}>תפקיד</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))} style={{ ...inp, width: '100%', cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={invite} disabled={saving || !inviteForm.username.trim()} style={{ background: saving ? '#e5e7eb' : '#4B2E6A', border: 'none', borderRadius: 7, color: saving ? '#9ca3af' : '#fff', fontSize: '0.83rem', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', padding: '8px 20px', fontFamily: 'inherit' }}>
                {saving ? 'שולח...' : '✓ הזמן'}
              </button>
              <button onClick={() => { setInviteOpen(false); setInviteResult(null); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.83rem', fontFamily: 'inherit' }}>ביטול</button>
            </div>
            {inviteResult?.error && (
              <div style={{ marginTop: 10, color: '#dc2626', fontSize: '0.8rem', padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{inviteResult.error}</div>
            )}
            {inviteResult?.url && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <div style={{ color: '#166534', fontWeight: 700, fontSize: '0.82rem', marginBottom: 4 }}>✓ הזמנה נוצרה</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: '0.72rem', color: '#374151', background: '#fff', padding: '4px 8px', borderRadius: 5, border: '1px solid #d1fae5', wordBreak: 'break-all', flex: 1 }}>{inviteResult.url}</code>
                  <button onClick={() => navigator.clipboard.writeText(inviteResult!.url!)} style={{ background: '#16a34a', border: 'none', borderRadius: 6, color: '#fff', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>העתק</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs + search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {(['all', 'pending', 'roster'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', background: tab === t ? '#4B2E6A' : '#fff', color: tab === t ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tab === t ? 700 : 500, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                {t === 'all' ? 'כל המשתמשים' : t === 'roster' ? 'צוות' : <>ממתינים {pending > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700 }}>{pending}</span>}</>}
              </button>
            ))}
          </div>
          {tab !== 'roster' && (
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש..." style={{ ...inp, flex: 1, minWidth: 160, border: '1px solid #e5e7eb' }}
            />
          )}
        </div>

        {/* Roster tab */}
        {tab === 'roster' && <StaffRoster />}

        {/* Table */}
        {tab !== 'roster' && (loading ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>טוען...</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['משתמש', 'תפקיד', 'מודולים', 'סטטוס', 'פעולות'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', color: '#6b7280', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>אין משתמשים</td></tr>
                ) : visible.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < visible.length - 1 ? '1px solid #f3f4f6' : 'none', opacity: u.deactivated ? 0.45 : 1 }}>

                    {/* User info */}
                    <td style={{ padding: '10px 14px' }}>
                      {editId === u.id ? (
                        <input value={editForm.display_name} onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))} placeholder="שם לתצוגה" style={{ ...inp, width: 120 }} onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{u.display_name || u.username}</div>
                          {u.display_name && <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>@{u.username}</div>}
                          {u.email && <div style={{ color: '#6b7280', fontSize: '0.72rem' }}>{u.email}</div>}
                        </>
                      )}
                    </td>

                    {/* Role */}
                    <td style={{ padding: '10px 14px' }}>
                      {editId === u.id ? (
                        <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span style={{ background: u.is_admin ? '#fef3c7' : '#f3f4f6', color: u.is_admin ? '#92400e' : '#374151', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
                          {u.is_admin ? '👑 ' : ''}{u.role}
                        </span>
                      )}
                    </td>

                    {/* Module access */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                          { key: 'sim', label: 'SIM', color: '#4B2E6A', always: true },
                          { key: 'has_ra', label: 'RA',  color: '#2563eb', always: false },
                          { key: 'has_jc', label: 'JC',  color: '#005977', always: false },
                        ].map(m => {
                          const active = m.always ? true : (u[m.key as 'has_jc' | 'has_ra'] ?? true);
                          return (
                            <button
                              key={m.key}
                              onClick={() => !m.always && patch(u.id, { [m.key]: !active })}
                              disabled={m.always || saving}
                              title={m.always ? 'SIM תמיד פעיל' : active ? `השבת ${m.label}` : `הפעל ${m.label}`}
                              style={{
                                background: active ? m.color : '#f3f4f6',
                                color: active ? '#fff' : '#9ca3af',
                                border: 'none', borderRadius: 6, padding: '2px 7px', fontSize: '0.7rem', fontWeight: 700,
                                cursor: m.always ? 'default' : 'pointer', fontFamily: 'inherit',
                                opacity: m.always ? 0.7 : 1,
                              }}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 14px' }}>
                      {u.deactivated ? (
                        <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>מושבת</span>
                      ) : !u.approved ? (
                        <span style={{ color: '#d97706', fontSize: '0.75rem', fontWeight: 600 }}>ממתין לאישור</span>
                      ) : u.has_pending_invite ? (
                        <span style={{ color: '#7c3aed', fontSize: '0.75rem', fontWeight: 600 }}>הזמנה ממתינה</span>
                      ) : (
                        <span style={{ color: '#16a34a', fontSize: '0.75rem', fontWeight: 600 }}>פעיל</span>
                      )}
                      {u.last_active && (
                        <div style={{ color: '#9ca3af', fontSize: '0.68rem', marginTop: 2 }}>
                          {new Date(u.last_active).toLocaleDateString('he-IL')}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {editId === u.id ? (
                          <>
                            <button onClick={saveEdit} disabled={saving} style={{ background: '#4B2E6A', border: 'none', borderRadius: 6, color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit' }}>✓ שמור</button>
                            <button onClick={() => setEditId(null)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, color: '#6b7280', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>ביטול</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditId(u.id); setEditForm({ display_name: u.display_name ?? '', role: u.role, email: u.email ?? '' }); }}
                              style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, color: '#374151', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}
                            >
                              ✎ ערוך
                            </button>
                            {!u.approved && !u.deactivated && (
                              <button onClick={() => patch(u.id, { approve: true })} style={{ background: '#dcfce7', border: 'none', borderRadius: 6, color: '#15803d', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit' }}>✓ אשר</button>
                            )}
                            <button
                              onClick={() => patch(u.id, { deactivated: !u.deactivated })}
                              style={{ background: u.deactivated ? '#f0fdf4' : '#fef2f2', border: 'none', borderRadius: 6, color: u.deactivated ? '#16a34a' : '#dc2626', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}
                            >
                              {u.deactivated ? '⊙ הפעל' : '⊗ השבת'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <p style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 24 }}>
          Labor-AI Admin · Hadassah Medical Center
        </p>
      </div>
    </div>
  );
}
