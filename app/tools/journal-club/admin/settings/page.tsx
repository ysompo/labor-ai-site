'use client';

import { useEffect, useState } from 'react';

interface Settings {
  huji_email_masked: string | null;
  resend_api_key_set: boolean;
  resend_from: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#f9fafb',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '14px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '600',
  color: 'var(--text-primary)',
  marginBottom: '6px',
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [hujiEmail, setHujiEmail] = useState('');
  const [hujiPassword, setHujiPassword] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFrom, setResendFrom] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/journal-club/admin/settings');
        if (!response.ok) {
          setMessage({ type: 'error', text: response.status === 403 ? 'Access denied. Admin access required.' : 'Failed to load settings' });
          return;
        }
        const data = await response.json();
        setSettings(data.settings);
        setResendApiKey('');
        setResendFrom('');
      } catch {
        setMessage({ type: 'error', text: 'Failed to load settings' });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: Record<string, string> = {};

      if (hujiEmail && hujiPassword) {
        payload.huji_email = hujiEmail;
        payload.huji_password = hujiPassword;
      }

      if (resendApiKey) payload.resend_api_key = resendApiKey;

      if (resendFrom) {
        if (!EMAIL_REGEX.test(resendFrom)) {
          setMessage({ type: 'error', text: 'Invalid email format for Resend from address' });
          setSaving(false);
          return;
        }
        payload.resend_from = resendFrom;
      }

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'error', text: 'Please fill in at least one field' });
        setSaving(false);
        return;
      }

      const response = await fetch('/api/journal-club/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to save settings' });
        setSaving(false);
        return;
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setHujiPassword('');
      setHujiEmail('');

      setTimeout(async () => {
        const r = await fetch('/api/journal-club/admin/settings');
        if (r.ok) { const d = await r.json(); setSettings(d.settings); }
      }, 500);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '32px 24px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Admin Settings</h1>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: 'var(--text-tertiary)' }}>HUJI credentials and email configuration</p>

        {message && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            background: message.type === 'success' ? 'rgba(22, 163, 74, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${message.type === 'success' ? 'rgba(22, 163, 74, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: message.type === 'success' ? '#15803d' : '#dc2626',
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* HUJI Credentials */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>HUJI Credentials</h2>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#92400e' }}>
              Credentials are encrypted at rest. Only update if you need to change them.
            </div>

            <div>
              <label style={labelStyle}>HUJI Email</label>
              <input
                type="email"
                value={hujiEmail}
                onChange={(e) => setHujiEmail(e.target.value)}
                placeholder="yourname@mail.huji.ac.il"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = '#f9fafb'; }}
              />
              {settings?.huji_email_masked && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>Current: {settings.huji_email_masked}</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>HUJI Password</label>
              <input
                type="password"
                value={hujiPassword}
                onChange={(e) => setHujiPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = '#f9fafb'; }}
              />
            </div>
          </div>

          {/* Resend */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Resend Configuration</h2>

            <div>
              <label style={labelStyle}>Resend API Key</label>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_..."
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = '#f9fafb'; }}
              />
              {settings?.resend_api_key_set && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#16a34a' }}>✓ API key is configured</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>From Address</label>
              <input
                type="email"
                value={resendFrom}
                onChange={(e) => setResendFrom(e.target.value)}
                placeholder="noreply@labor-ai.org"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = '#f9fafb'; }}
              />
              {settings?.resend_from && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>Current: {settings.resend_from}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: saving ? 'rgba(0, 89, 119, 0.5)' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = 'var(--primary-light)'; }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = 'var(--primary)'; }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
