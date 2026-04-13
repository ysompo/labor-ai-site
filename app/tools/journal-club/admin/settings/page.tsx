'use client';

import { useEffect, useState } from 'react';

interface Settings {
  huji_email_masked: string | null;
  resend_api_key: string | null;
  resend_from: string | null;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [hujiEmail, setHujiEmail] = useState('');
  const [hujiPassword, setHujiPassword] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFrom, setResendFrom] = useState('');

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/journal-club/admin/settings');
        if (!response.ok) {
          if (response.status === 403) {
            setMessage({ type: 'error', text: 'Access denied. Admin access required.' });
          } else {
            setMessage({ type: 'error', text: 'Failed to load settings' });
          }
          return;
        }

        const data = await response.json();
        setSettings(data.settings);
        setResendApiKey(data.settings.resend_api_key || '');
        setResendFrom(data.settings.resend_from || '');
      } catch (error) {
        console.error('Error loading settings:', error);
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

      if (resendApiKey) {
        payload.resend_api_key = resendApiKey;
      }

      if (resendFrom) {
        payload.resend_from = resendFrom;
      }

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'error', text: 'Please fill in at least one field' });
        setSaving(false);
        return;
      }

      const response = await fetch('/api/journal-club/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to save settings' });
        setSaving(false);
        return;
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });

      // Clear password field for security
      setHujiPassword('');

      // Reset HUJI email field after successful save
      setHujiEmail('');

      // Reload settings to confirm
      setTimeout(async () => {
        try {
          const response = await fetch('/api/journal-club/admin/settings');
          if (response.ok) {
            const data = await response.json();
            setSettings(data.settings);
          }
        } catch (error) {
          console.error('Error reloading settings:', error);
        }
      }, 500);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1f] text-white p-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d1f] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Settings</h1>

        {/* Messages */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* HUJI Credentials Section */}
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
              <p className="font-semibold mb-1">Security Notice</p>
              <p>
                HUJI credentials are encrypted and securely stored. Only provide these if you want
                to update them.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                HUJI Email
              </label>
              <input
                type="email"
                value={hujiEmail}
                onChange={(e) => setHujiEmail(e.target.value)}
                placeholder="your.email@huji.ac.il"
                className="w-full px-4 py-2 bg-[#1a1a2e] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              {settings?.huji_email_masked && (
                <p className="text-xs text-gray-400 mt-1">Current: {settings.huji_email_masked}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                HUJI Password
              </label>
              <input
                type="password"
                value={hujiPassword}
                onChange={(e) => setHujiPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 bg-[#1a1a2e] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Resend Configuration Section */}
          <div className="border-t border-gray-700 pt-6 space-y-4">
            <h2 className="text-lg font-semibold">Resend Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Resend API Key
              </label>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_..."
                className="w-full px-4 py-2 bg-[#1a1a2e] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              {settings?.resend_api_key && (
                <p className="text-xs text-gray-400 mt-1">API key is configured</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Resend From Address
              </label>
              <input
                type="email"
                value={resendFrom}
                onChange={(e) => setResendFrom(e.target.value)}
                placeholder="noreply@labor-ai.org"
                className="w-full px-4 py-2 bg-[#1a1a2e] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              {settings?.resend_from && (
                <p className="text-xs text-gray-400 mt-1">Current: {settings.resend_from}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6 border-t border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className={`w-full px-6 py-3 font-semibold rounded text-white transition ${
                saving
                  ? 'bg-purple-500 opacity-50 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
