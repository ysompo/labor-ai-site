'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Journal {
  id: string;
  name: string;
  publisher?: string;
  toc_url: string;
  issn?: string;
  has_new_issue: boolean;
  current_issue_label?: string;
}

const COLORS = {
  darkBg: '#0d0d1f',
  cardBg: '#1a1a2e',
  purpleAccent: '#9333ea',
  purpleBorder: 'rgba(147, 51, 234, 0.2)',
  purpleBorderHover: 'rgba(147, 51, 234, 0.5)',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  greenBadge: '#16a34a',
  greenBg: 'rgba(22, 163, 74, 0.1)',
};

function JournalCard({ journal }: { journal: Journal }) {
  return (
    <Link href={`/tools/journal-club/journals/${journal.id}`}>
      <div
        style={{
          background: COLORS.cardBg,
          border: `1px solid ${COLORS.purpleBorder}`,
          borderRadius: '12px',
          padding: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          height: '100%',
        }}
        onMouseEnter={(e) => {
          const target = e.currentTarget as HTMLDivElement;
          target.style.borderColor = COLORS.purpleBorderHover;
          target.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          const target = e.currentTarget as HTMLDivElement;
          target.style.borderColor = COLORS.purpleBorder;
          target.style.transform = 'translateY(0)';
        }}
      >
        {/* Header with title and badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: COLORS.textPrimary,
              lineHeight: '1.3',
              flex: 1,
            }}
          >
            {journal.name}
          </h2>
          {journal.has_new_issue && (
            <span
              style={{
                background: COLORS.greenBg,
                color: COLORS.greenBadge,
                fontSize: '0.7rem',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '6px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              New Issue
            </span>
          )}
        </div>

        {/* Publisher */}
        {journal.publisher && (
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: COLORS.textSecondary,
            }}
          >
            {journal.publisher}
          </p>
        )}

        {/* Current issue label */}
        {journal.current_issue_label && (
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: COLORS.textTertiary,
            }}
          >
            {journal.current_issue_label}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/journal-club/journals');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setJournals(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[JournalsPage] Failed to fetch journals:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch journals');
      } finally {
        setLoading(false);
      }
    };

    fetchJournals();
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.darkBg,
        padding: '32px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '2rem',
              fontWeight: 'bold',
              color: COLORS.textPrimary,
            }}
          >
            My Journals
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '0.875rem',
              color: COLORS.textSecondary,
            }}
          >
            Follow and manage your academic journals
          </p>
        </div>
        <Link href="/tools/journal-club/journals/add">
          <button
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: `linear-gradient(135deg, #9333ea, #7c3aed)`,
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.background = 'linear-gradient(135deg, #a855f7, #8b5cf6)';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.background = 'linear-gradient(135deg, #9333ea, #7c3aed)';
            }}
          >
            + Add Journal
          </button>
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📚</div>
          <div style={{ color: COLORS.textSecondary, fontSize: '0.95rem' }}>Loading journals...</div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '16px',
            color: '#fca5a5',
            fontSize: '0.9rem',
            marginBottom: '24px',
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && journals.length === 0 && !error && (
        <div style={{ textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔬</div>
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: COLORS.textPrimary,
              marginBottom: '8px',
            }}
          >
            No journals yet
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: COLORS.textSecondary,
              marginBottom: '28px',
              lineHeight: '1.6',
            }}
          >
            Start by adding a journal to your reading list.
          </p>
          <Link href="/tools/journal-club/journals/add">
            <button
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: 'none',
                background: `linear-gradient(135deg, #9333ea, #7c3aed)`,
                color: '#fff',
                fontSize: '1.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(147, 51, 234, 0.4)',
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.transform = 'scale(1)';
              }}
            >
              +
            </button>
          </Link>
        </div>
      )}

      {/* Journals grid */}
      {!loading && journals.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {journals.map((journal) => (
            <JournalCard key={journal.id} journal={journal} />
          ))}
        </div>
      )}
    </div>
  );
}
