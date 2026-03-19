'use client';

import { useEffect, useState, useCallback } from 'react';

interface SimUser {
  id: number;
  username: string;
  email: string | null;
  is_admin: boolean;
  approved: boolean;
  deactivated: boolean;
  role: string;
  display_name: string | null;
  last_active: string | null;
  has_pending_invite: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  physician_instructor: 'רופא/מנחה',
  midwife_instructor:   'מיילדת/מנחה',
  trainee:              'מתמחה',
};

const ROLE_COLORS: Record<string, string> = {
  physician_instructor: '#a78bfa',
  midwife_instructor:   '#6ee7b7',
  trainee:              '#93c5fd',
};

export default function UserManagement() {
  const [users, setUsers]       = useState<SimUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // New user form
  const [newUsername, setNewUsername]   = useState('');
  const [newEmail, setNewEmail]         = useState('');
  const [newRole, setNewRole]           = useState('trainee');
  const [newDisplay, setNewDisplay]     = useState('');
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState('');
  const [lastInvite, setLastInvite]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulator/admin/users');
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'שגיאה'); return; }
      setUsers(data.users);
    } catch { setError('שגיאת רשת'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyInvite = (url: string, id: number) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await fetch('/api/simulator/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, email: newEmail, role: newRole, display_name: newDisplay }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? 'שגיאה'); return; }
      setLastInvite(data.inviteUrl);
      setNewUsername(''); setNewEmail(''); setNewDisplay(''); setNewRole('trainee');
      await load();
    } catch { setCreateError('שגיאת רשת'); }
    finally { setCreating(false); }
  };

  const patch = async (id: number, updates: Record<string, unknown>, onUrl?: (url: string) => void) => {
    const res = await fetch('/api/simulator/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const data = await res.json();
    if (data.inviteUrl && onUrl) onUrl(data.inviteUrl);
    await load();
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: '0.85rem',
    fontFamily: 'inherit', outline: 'none', direction: 'rtl', width: '100%', boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

  if (loading) return <div style={{ color: '#9ca3af', padding: 20 }}>טוען...</div>;
  if (error)   return <div style={{ color: '#f87171', padding: 20 }}>{error}</div>;

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem' }}>
          משתמשים ({users.length})
        </span>
        <button
          onClick={() => { setShowNew(v => !v); setCreateError(''); setLastInvite(''); }}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#4B2E6A,#7c3aed)', color: '#fff',
            fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
          }}
        >
          + הוסף משתמש
        </button>
      </div>

      {/* New user form */}
      {showNew && (
        <form
          onSubmit={createUser}
          style={{
            background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          <div style={{ color: '#c4b5fd', fontWeight: 700, marginBottom: 4 }}>משתמש חדש</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>שם משתמש *</label>
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="username" style={inputStyle} required />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>שם תצוגה</label>
              <input value={newDisplay} onChange={e => setNewDisplay(e.target.value)} placeholder="ד״ר שם משפחה" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>מייל</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" style={{ ...inputStyle, direction: 'ltr' }} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>תפקיד</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} style={selectStyle}>
                <option value="trainee">מתמחה</option>
                <option value="midwife_instructor">מיילדת/מנחה</option>
                <option value="physician_instructor">רופא/מנחה</option>
              </select>
            </div>
          </div>
          {createError && (
            <div style={{ color: '#f87171', fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '6px 10px' }}>
              {createError}
            </div>
          )}
          {lastInvite && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ color: '#6ee7b7', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>✓ המשתמש נוצר — קישור הזמנה:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, color: '#d1d5db', fontSize: '0.72rem', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '4px 8px' }}>
                  {lastInvite}
                </code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(lastInvite); }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                >
                  העתק
                </button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={creating}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: creating ? '#374151' : 'linear-gradient(135deg,#4B2E6A,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {creating ? 'יוצר...' : 'צור וצור קישור הזמנה'}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem' }}
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['משתמש', 'שם תצוגה', 'מייל', 'תפקיד', 'סטטוס', 'פעיל לאחרונה', 'פעולות'].map(h => (
                <th key={h} style={{ padding: '8px 10px', color: '#9ca3af', fontWeight: 600, textAlign: 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr
                key={u.id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  opacity: u.deactivated ? 0.45 : 1,
                }}
              >
                <td style={{ padding: '10px 10px', color: '#f1f5f9', fontWeight: 600 }}>
                  {u.username}
                  {u.is_admin && <span style={{ marginRight: 6, fontSize: '0.68rem', background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 4, padding: '1px 5px', color: '#fde047' }}>מנהל</span>}
                  {u.has_pending_invite && <span style={{ marginRight: 6, fontSize: '0.68rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, padding: '1px 5px', color: '#93c5fd' }}>ממתין לאישור</span>}
                </td>
                <td style={{ padding: '10px 10px', color: '#d1d5db' }}>{u.display_name ?? '—'}</td>
                <td style={{ padding: '10px 10px', color: '#9ca3af', direction: 'ltr' }}>{u.email ?? '—'}</td>
                <td style={{ padding: '10px 10px' }}>
                  {u.is_admin ? (
                    <span style={{ color: '#fde047' }}>{ROLE_LABELS[u.role] ?? u.role}</span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={e => patch(u.id, { role: e.target.value })}
                      style={{ ...selectStyle, width: 'auto', padding: '4px 8px', fontSize: '0.78rem', color: ROLE_COLORS[u.role] ?? '#d1d5db' }}
                    >
                      <option value="trainee">מתמחה</option>
                      <option value="midwife_instructor">מיילדת/מנחה</option>
                      <option value="physician_instructor">רופא/מנחה</option>
                    </select>
                  )}
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <span style={{
                    fontSize: '0.75rem', borderRadius: 4, padding: '2px 8px',
                    background: u.deactivated ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    border: u.deactivated ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)',
                    color: u.deactivated ? '#fca5a5' : '#6ee7b7',
                  }}>
                    {u.deactivated ? 'מושבת' : 'פעיל'}
                  </span>
                </td>
                <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: '0.78rem' }}>
                  {u.last_active ? new Date(u.last_active).toLocaleDateString('he-IL') : '—'}
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!u.is_admin && (
                      <button
                        onClick={() => patch(u.id, { deactivated: !u.deactivated })}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.04)', color: u.deactivated ? '#6ee7b7' : '#fca5a5',
                          cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
                        }}
                      >
                        {u.deactivated ? 'הפעל' : 'השבת'}
                      </button>
                    )}
                    <button
                      onClick={() => patch(u.id, { regenerate_invite: true }, url => {
                        copyInvite(url, u.id);
                      })}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.3)',
                        background: 'rgba(139,92,246,0.08)', color: copiedId === u.id ? '#6ee7b7' : '#c4b5fd',
                        cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
                      }}
                    >
                      {copiedId === u.id ? '✓ הועתק' : '🔗 הזמנה'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
