'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UserSettings {
  email: string | null;
  name: string | null;
  email_cc_1: string | null;
  email_cc_2: string | null;
  is_admin: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #ced4da',
  borderRadius: '6px',
  fontSize: '14px',
  color: '#212529',
  background: '#f9fafb',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600',
  color: '#495057',
  marginBottom: '5px',
  fontFamily: "'Work Sans', sans-serif",
  letterSpacing: '0.03em',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e9ecef',
  borderRadius: '8px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const sectionLabel: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '11px',
  fontWeight: '600',
  color: '#005977',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontFamily: "'Work Sans', sans-serif",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [emailCc1, setEmailCc1] = useState('');
  const [emailCc2, setEmailCc2] = useState('');

  useEffect(() => {
    fetch('/api/journal-club/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setEmailCc1(data.email_cc_1 ?? '');
        setEmailCc2(data.email_cc_2 ?? '');
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load settings' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/journal-club/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_cc_1: emailCc1.trim(), email_cc_2: emailCc2.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      } else {
        setMessage({ type: 'success', text: 'Settings saved.' });
        setSettings(s => s ? { ...s, email_cc_1: emailCc1.trim() || null, email_cc_2: emailCc2.trim() || null } : s);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#868e96', fontSize: '14px' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '40px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>

        {/* Header */}
        <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: '#212529', fontFamily: "'Noto Serif', Georgia, serif" }}>Settings</h1>
        <p style={{ margin: '0 0 32px', fontSize: '13px', color: '#868e96' }}>Your Journal Club preferences</p>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '6px', fontSize: '13px',
            background: message.type === 'success' ? 'rgba(47,158,68,0.08)' : 'rgba(201,42,42,0.08)',
            border: `1px solid ${message.type === 'success' ? 'rgba(47,158,68,0.3)' : 'rgba(201,42,42,0.3)'}`,
            color: message.type === 'success' ? '#2f6b1e' : '#c92a2a',
          }}>
            {message.text}
          </div>
        )}

        {/* Account card */}
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <p style={sectionLabel}>Account</p>
          <div>
            <p style={labelStyle}>Email</p>
            <div style={{ ...inputStyle, color: '#868e96', cursor: 'default' }}>
              {settings?.email ?? '—'}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#adb5bd' }}>Your login email. Cannot be changed here.</p>
          </div>
          {settings?.name && (
            <div>
              <p style={labelStyle}>Name</p>
              <div style={{ ...inputStyle, color: '#868e96', cursor: 'default' }}>
                {settings.name}
              </div>
            </div>
          )}
        </div>

        {/* Email preferences card */}
        <form onSubmit={handleSave}>
          <div style={{ ...cardStyle, marginBottom: '16px' }}>
            <p style={sectionLabel}>Reading List Email</p>
            <p style={{ margin: '-8px 0 4px', fontSize: '13px', color: '#495057', lineHeight: '1.5' }}>
              When you send your reading list, it goes to your email above. Add up to 2 CC addresses (e.g., colleagues or a shared inbox).
            </p>

            <div>
              <label style={labelStyle}>CC Address 1</label>
              <input
                type="email"
                value={emailCc1}
                onChange={e => setEmailCc1(e.target.value)}
                placeholder="colleague@example.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#005977'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#ced4da'; e.currentTarget.style.background = '#f9fafb'; }}
              />
            </div>

            <div>
              <label style={labelStyle}>CC Address 2</label>
              <input
                type="email"
                value={emailCc2}
                onChange={e => setEmailCc2(e.target.value)}
                placeholder="another@example.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#005977'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#ced4da'; e.currentTarget.style.background = '#f9fafb'; }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '4px' }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '9px 22px', borderRadius: '6px', border: 'none',
                  background: saving ? '#adb5bd' : 'linear-gradient(135deg, #005977, #007398)',
                  color: 'white', fontSize: '13px', fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : '0 2px 8px rgba(0,89,119,0.2)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {emailCc1 || emailCc2 ? (
                <button
                  type="button"
                  onClick={() => { setEmailCc1(''); setEmailCc2(''); }}
                  style={{ padding: '9px 14px', borderRadius: '6px', border: '1px solid #ced4da', background: '#fff', color: '#868e96', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </form>

        {/* Admin settings link */}
        {settings?.is_admin && (
          <div style={{ ...cardStyle }}>
            <p style={sectionLabel}>Admin</p>
            <p style={{ margin: '-8px 0 4px', fontSize: '13px', color: '#495057' }}>
              Configure HUJI credentials and Resend email service.
            </p>
            <Link
              href="/tools/journal-club/admin/settings"
              style={{
                display: 'inline-block', padding: '9px 22px', borderRadius: '6px',
                background: 'rgba(0,89,119,0.08)', color: '#005977',
                fontSize: '13px', fontWeight: '600', textDecoration: 'none',
                border: '1px solid rgba(0,89,119,0.2)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,89,119,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,89,119,0.08)'; }}
            >
              Open Admin Settings →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
