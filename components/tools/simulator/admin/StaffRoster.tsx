'use client';

import { useState, useEffect } from 'react';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  email: string;
  active: boolean;
}

const ROLES = ['מתמחה', 'מיילדת', 'רופא בכיר', 'מיילדת אחראית'];

const TH: React.CSSProperties = {
  padding: '10px 14px',
  color: '#1e40af',
  fontWeight: 700,
  fontSize: '0.78rem',
  borderBottom: '2px solid #c7d2fe',
  background: '#f0f4ff',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  padding: '9px 14px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '0.83rem',
  color: '#111',
  textAlign: 'right',
};

export default function StaffRoster() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState(ROLES[0]);
  const [formEmail, setFormEmail] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/simulator/staff');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStaff(data.staff ?? []);
    } catch (err) {
      setError('שגיאה בטעינת הצוות');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setFormSaving(true);
    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/simulator/staff/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, role: formRole, email: formEmail }),
        });
        if (!res.ok) throw new Error('שגיאה בעדכון');
        // Optimistic update
        setStaff((prev) =>
          prev.map((s) =>
            s.id === editingId ? { ...s, name: formName, role: formRole, email: formEmail } : s
          )
        );
      } else {
        // Create
        const res = await fetch('/api/simulator/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, role: formRole, email: formEmail }),
        });
        if (!res.ok) throw new Error('שגיאה ביצירה');
        const data = await res.json();
        setStaff((prev) => [...prev, data.staff ?? data.member]);
      }
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('למחוק איש צוות זה?')) return;
    // Optimistic
    setStaff((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/simulator/staff/${id}`, { method: 'DELETE' });
    } catch {
      fetchStaff(); // revert
    }
  };

  const handleEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setFormName(member.name);
    setFormRole(member.role);
    setFormEmail(member.email);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName('');
    setFormRole(ROLES[0]);
    setFormEmail('');
  };

  const inputStyle: React.CSSProperties = {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: '0.85rem',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#111',
    background: '#fafafa',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111' }}>

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#1e40af', fontSize: '1rem', fontWeight: 700 }}>ניהול צוות</h3>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          style={{
            background: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: '8px 18px',
            fontFamily: 'inherit',
          }}
        >
          + הוסף איש צוות
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div
          style={{
            background: '#f0f4ff',
            border: '1px solid #c7d2fe',
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h4 style={{ margin: '0 0 12px', color: '#1e40af', fontSize: '0.9rem' }}>
            {editingId ? 'עריכת איש צוות' : 'הוספת איש צוות'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>שם</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="שם מלא"
                style={inputStyle}
                dir="rtl"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>תפקיד</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                style={inputStyle}
                dir="rtl"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>דוא"ל</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="example@hospital.com"
                style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={formSaving || !formName.trim()}
              style={{
                background: formSaving || !formName.trim() ? '#9ca3af' : 'linear-gradient(135deg, #1e40af, #1d4ed8)',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: formSaving || !formName.trim() ? 'not-allowed' : 'pointer',
                padding: '7px 18px',
                fontFamily: 'inherit',
              }}
            >
              {formSaving ? 'שומר...' : 'שמור'}
            </button>
            <button
              onClick={resetForm}
              style={{
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                color: '#6b7280',
                fontSize: '0.82rem',
                cursor: 'pointer',
                padding: '7px 14px',
                fontFamily: 'inherit',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 16px', marginBottom: 12, color: '#dc2626', fontSize: '0.85rem' }}>
          {error}
          <button onClick={fetchStaff} style={{ marginRight: 12, color: '#1e40af', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>
            נסה שוב
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>שם</th>
                <th style={TH}>תפקיד</th>
                <th style={{ ...TH, direction: 'ltr', textAlign: 'left' }}>דוא"ל</th>
                <th style={{ ...TH, textAlign: 'center' }}>פעיל</th>
                <th style={{ ...TH, textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9ca3af' }}>טוען...</td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9ca3af' }}>אין אנשי צוות</td>
                </tr>
              ) : (
                staff.map((member, i) => (
                  <tr key={member.id} style={{ background: i % 2 === 0 ? '#fff' : '#f7f9ff' }}>
                    <td style={{ ...TD, fontWeight: 600 }}>{member.name}</td>
                    <td style={TD}>
                      <span
                        style={{
                          background: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: 20,
                          padding: '2px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td style={{ ...TD, direction: 'ltr', textAlign: 'left', color: '#6b7280' }}>{member.email}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <span style={{ color: member.active ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: '0.82rem' }}>
                        {member.active ? '✓ פעיל' : '✗ לא פעיל'}
                      </span>
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(member)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 5,
                            color: '#1e40af',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            padding: '4px 10px',
                            fontFamily: 'inherit',
                          }}
                        >
                          ✏️ ערוך
                        </button>
                        <button
                          onClick={() => handleDelete(member.id)}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 5,
                            color: '#dc2626',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            padding: '4px 10px',
                            fontFamily: 'inherit',
                          }}
                        >
                          🗑 מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
