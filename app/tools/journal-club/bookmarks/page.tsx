'use client';

export default function BookmarksPage() {
  return (
    <div style={{ padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Bookmarks</h1>
      <p style={{ margin: '0 0 32px', color: 'var(--text-tertiary)' }}>Your saved articles</p>

      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔖</div>
        <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Bookmarks coming soon</p>
        <p style={{ fontSize: '0.875rem' }}>Save articles for later reading</p>
      </div>
    </div>
  );
}
