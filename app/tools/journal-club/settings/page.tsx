'use client';

export default function SettingsPage() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: '600px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Settings</h1>
      <p style={{ margin: '0 0 32px', color: 'var(--text-tertiary)' }}>Configure your Journal Club preferences</p>

      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚙️</div>
        <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Settings coming soon</p>
        <p style={{ fontSize: '0.875rem' }}>Manage your HUJI credentials and email preferences</p>
      </div>
    </div>
  );
}
