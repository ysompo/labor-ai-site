'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface StaffMember {
  id: number;
  name: string;
  role: string;
  email: string;
  active: boolean;
}

const ROLES = ['מתמחה', 'מיילדת', 'רופא בכיר', 'מיילדת אחראית', 'משקיף'];

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(139,92,246,0.3)',
  borderRadius: 7,
  padding: '7px 10px',
  color: '#f1f5f9',
  fontSize: '0.83rem',
  fontFamily: 'inherit',
  outline: 'none',
  direction: 'rtl',
};

export default function RosterPage() {
  const [staff, setStaff]               = useState<StaffMember[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editId, setEditId]             = useState<number | null>(null);
  const [editForm, setEditForm]         = useState<{ name: string; role: string; email: string }>({ name: '', role: '', email: '' });
  const [addOpen, setAddOpen]           = useState(false);
  const [addForm, setAddForm]           = useState({ name: '', role: 'מתמחה', email: '' });
  const [saving, setSaving]             = useState(false);
  const [deleteId, setDeleteId]         = useState<number | null>(null);
  const [search, setSearch]             = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/simulator/staff?all=1')
      .then(r => r.json())
      .then((d: { staff?: StaffMember[] }) => { setStaff(d.staff ?? []); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (s: StaffMember) => {
    setEditId(s.id);
    setEditForm({ name: s.name, role: s.role, email: s.email });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    await fetch(`/api/simulator/staff/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditId(null);
    load();
  };

  const deleteStaff = async (id: number) => {
    setDeleteId(null);
    // Optimistically remove from local state immediately
    setStaff(prev => prev.filter(s => s.id !== id));
    const res  = await fetch(`/api/simulator/staff/${id}`, { method: 'DELETE' });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (data.error) {
      // Revert on failure
      setError(`שגיאה במחיקה: ${data.error}`);
      load();
    }
  };

  const toggleActive = async (s: StaffMember) => {
    await fetch(`/api/simulator/staff/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  };

  const addStaff = async () => {
    if (!addForm.name.trim()) return;
    setSaving(true);
    await fetch('/api/simulator/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    setSaving(false);
    setAddOpen(false);
    setAddForm({ name: '', role: 'מתמחה', email: '' });
    load();
  };

  const q = search.toLowerCase();
  const visible = staff.filter(s =>
    (showInactive || s.active) &&
    (!q || s.name.includes(search) || s.email.toLowerCase().includes(q) || s.role.includes(search))
  );

  // Group by role; include roles with no members so structure is always shown
  const grouped = ROLES.reduce<Record<string, StaffMember[]>>((acc, role) => {
    acc[role] = visible.filter(s => s.role === role);
    return acc;
  }, {});
  // Catch any non-standard roles
  const otherMembers = visible.filter(s => !ROLES.includes(s.role));

  const totalActive   = staff.filter(s => s.active).length;
  const totalInactive = staff.filter(s => !s.active).length;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0d0d1f', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '24px 20px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>👥 רשימת משתתפים</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '4px 0 0' }}>
              {totalActive} פעילים · {totalInactive} לא פעילים · Labor-AI Lab
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/tools/simulator" style={{ color: '#9ca3af', fontSize: '0.8rem', textDecoration: 'none' }}>← חזרה לסימולטור</Link>
            <button
              onClick={() => { setAddOpen(o => !o); }}
              style={{ background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', padding: '8px 18px', fontFamily: 'inherit' }}
            >
              + הוסף משתתף
            </button>
          </div>
        </div>

        {/* Add form */}
        {addOpen && (
          <div style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <div style={{ color: '#c4b5fd', fontWeight: 700, marginBottom: 12, fontSize: '0.88rem' }}>הוספת משתתף חדש</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.7rem', display: 'block', marginBottom: 3 }}>שם מלא</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="שם מלא"
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  onKeyDown={e => e.key === 'Enter' && addStaff()}
                />
              </div>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.7rem', display: 'block', marginBottom: 3 }}>תפקיד</label>
                <select
                  value={addForm.role}
                  onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  {ROLES.map(r => <option key={r} value={r} style={{ background: '#1a1a2e' }}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.7rem', display: 'block', marginBottom: 3 }}>אימייל</label>
                <input
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="name@hospital.org"
                  type="email"
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  onKeyDown={e => e.key === 'Enter' && addStaff()}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={addStaff}
                disabled={saving || !addForm.name.trim()}
                style={{ background: saving ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 7, color: '#c4b5fd', fontSize: '0.83rem', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', padding: '7px 20px', fontFamily: 'inherit' }}
              >
                {saving ? '⏳ שומר...' : '✓ שמור'}
              </button>
              <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.83rem', fontFamily: 'inherit' }}>ביטול</button>
            </div>
          </div>
        )}

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, אימייל, תפקיד..."
            style={{ ...inputStyle, flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.25)' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ accentColor: '#7c3aed' }} />
            כולל לא פעילים
          </label>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>טוען...</div>
        ) : error ? (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', color: '#fca5a5', fontSize: '0.82rem' }}>{error}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {[...ROLES.map(r => ({ role: r, members: grouped[r] })), ...(otherMembers.length ? [{ role: 'אחר', members: otherMembers }] : [])].map(({ role, members }) => (
              <div key={role}>
                {/* Role header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ color: '#7c3aed', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{role}</div>
                  <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.15)' }} />
                  <div style={{ color: '#4b5563', fontSize: '0.7rem' }}>{members.length}</div>
                </div>

                {members.length === 0 ? (
                  <div style={{ color: '#374151', fontSize: '0.78rem', padding: '4px 0' }}>אין משתתפים</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {members.map(s => (
                      <div
                        key={s.id}
                        style={{
                          background: s.active ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${s.active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: 8,
                          padding: '9px 14px',
                          opacity: s.active ? 1 : 0.45,
                        }}
                      >
                        {editId === s.id ? (
                          /* ─ Edit row ─ */
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                            <input
                              value={editForm.name}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              style={{ ...inputStyle, fontSize: '0.83rem' }}
                              onKeyDown={e => e.key === 'Enter' && saveEdit()}
                            />
                            <select
                              value={editForm.role}
                              onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                              style={{ ...inputStyle, fontSize: '0.83rem', cursor: 'pointer' }}
                            >
                              {ROLES.map(r => <option key={r} value={r} style={{ background: '#1a1a2e' }}>{r}</option>)}
                            </select>
                            <input
                              value={editForm.email}
                              onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                              placeholder="אימייל"
                              type="email"
                              style={{ ...inputStyle, fontSize: '0.83rem' }}
                              onKeyDown={e => e.key === 'Enter' && saveEdit()}
                            />
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 6, color: '#c4b5fd', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 12px', fontFamily: 'inherit' }}
                              >
                                ✓ שמור
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit' }}
                              >
                                ביטול
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ─ Display row ─ */
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                            <span style={{ color: '#f1f5f9', fontSize: '0.85rem', fontWeight: 500 }}>{s.name}</span>
                            <span
                              style={{ color: s.email ? '#6ee7b7' : '#4b5563', fontSize: '0.78rem', cursor: 'pointer' }}
                              onClick={() => startEdit(s)}
                              title="לחץ לעריכה"
                            >
                              {s.email || '— לחץ להוספת אימייל —'}
                            </span>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                              <button
                                onClick={() => startEdit(s)}
                                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6, color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit' }}
                              >
                                ✎ ערוך
                              </button>
                              <button
                                onClick={() => toggleActive(s)}
                                title={s.active ? 'השבת' : 'הפעל'}
                                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer', padding: '3px 8px', fontFamily: 'inherit' }}
                              >
                                {s.active ? '⊗' : '⊙'}
                              </button>
                              {deleteId === s.id ? (
                                <>
                                  <span style={{ color: '#fca5a5', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>בטוח?</span>
                                  <button
                                    onClick={() => deleteStaff(s.id)}
                                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, color: '#fca5a5', fontSize: '0.7rem', cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit' }}
                                  >
                                    מחק
                                  </button>
                                  <button
                                    onClick={() => setDeleteId(null)}
                                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}
                                  >
                                    ביטול
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setDeleteId(s.id)}
                                  title="מחק משתתף"
                                  style={{ background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer', padding: '3px 8px', fontFamily: 'inherit' }}
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
