'use client';

export default function HistoryPage() {
  return (
    <div style={{ padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>History</h1>
      <p style={{ margin: '0 0 32px', color: 'var(--text-tertiary)' }}>Downloaded and viewed articles</p>

      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📜</div>
        <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>History coming soon</p>
        <p style={{ fontSize: '0.875rem' }}>Track all your downloaded articles here</p>
      </div>
    </div>
  );
}
