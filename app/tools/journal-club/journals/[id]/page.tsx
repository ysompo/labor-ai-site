'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Article {
  id: string;
  url: string;
  title: string;
  authors: string[];
  article_type?: string;
  doi?: string;
  abstract?: string;
  issue_label?: string;
}

interface Journal {
  id: string;
  name: string;
  current_issue_label?: string;
}

const COLORS = {
  darkBg: '#0d0d1f',
  cardBg: '#1a1a2e',
  rowBg: '#1a1a2e',
  rowHover: '#242242',
  purpleAccent: '#9333ea',
  purpleBorder: 'rgba(147, 51, 234, 0.2)',
  purpleBorderHover: 'rgba(147, 51, 234, 0.5)',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  greenBadge: '#16a34a',
  greenBg: 'rgba(22, 163, 74, 0.1)',
  blueBadge: '#3b82f6',
  blueBg: 'rgba(59, 130, 246, 0.1)',
};

function ArticleRow({ article, expanded, onToggle }: { article: Article; expanded: boolean; onToggle: () => void }) {
  const [readingListAdded, setReadingListAdded] = useState(false);

  const handleAddToReadingList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch('/api/journal-club/reading-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toc_article_id: article.id }),
      });
      if (response.ok) {
        setReadingListAdded(!readingListAdded);
      }
    } catch (err) {
      console.error('[ArticleRow] Failed to add to reading list:', err);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch('/api/journal-club/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_url: article.url,
          article_title: article.title,
          article_doi: article.doi,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('[ArticleRow] PDF download initiated:', data);
    } catch (err) {
      console.error('[ArticleRow] Failed to download PDF:', err);
    }
  };

  return (
    <div
      style={{
        background: COLORS.rowBg,
        border: `1px solid ${COLORS.purpleBorder}`,
        borderRadius: '8px',
        marginBottom: '12px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        const target = e.currentTarget as HTMLDivElement;
        target.style.background = COLORS.rowHover;
        target.style.borderColor = COLORS.purpleBorderHover;
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget as HTMLDivElement;
        target.style.background = COLORS.rowBg;
        target.style.borderColor = COLORS.purpleBorder;
      }}
    >
      {/* Collapsed view */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 'bold',
                color: COLORS.textPrimary,
                marginBottom: '6px',
              }}
            >
              {article.title}
            </h3>
            {article.authors && article.authors.length > 0 && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8rem',
                  color: COLORS.textSecondary,
                  lineHeight: '1.4',
                }}
              >
                {article.authors.join(', ')}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
            {article.article_type && (
              <span
                style={{
                  background: COLORS.blueBg,
                  color: COLORS.blueBadge,
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  padding: '3px 8px',
                  borderRadius: '4px',
                }}
              >
                {article.article_type}
              </span>
            )}
            <span
              style={{
                fontSize: '1.2rem',
                color: COLORS.textSecondary,
                transition: 'transform 0.2s ease',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${COLORS.purpleBorder}`,
            padding: '16px',
            backgroundColor: 'rgba(147, 51, 234, 0.03)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Abstract */}
          {article.abstract && (
            <div style={{ marginBottom: '16px' }}>
              <h4
                style={{
                  margin: '0 0 8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: COLORS.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Abstract
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  color: COLORS.textTertiary,
                  lineHeight: '1.6',
                }}
              >
                {article.abstract}
              </p>
            </div>
          )}

          {/* DOI */}
          {article.doi && (
            <div style={{ marginBottom: '16px' }}>
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.875rem',
                  color: COLORS.purpleAccent,
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                  cursor: 'pointer',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                DOI: {article.doi}
              </a>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleDownloadPDF}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: `linear-gradient(135deg, #9333ea, #7c3aed)`,
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.8rem',
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
              ⬇ Download PDF
            </button>

            <button
              onClick={handleAddToReadingList}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${readingListAdded ? COLORS.greenBadge : COLORS.purpleAccent}`,
                background: readingListAdded ? COLORS.greenBg : 'transparent',
                color: readingListAdded ? COLORS.greenBadge : COLORS.purpleAccent,
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.opacity = '1';
              }}
            >
              {readingListAdded ? '✓ In Reading List' : '+ Add to Reading List'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JournalDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [journal, setJournal] = useState<Journal | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchJournalData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/journal-club/journals/${id}/toc`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setJournal(data.journal || null);
        setArticles(Array.isArray(data.articles) ? data.articles : []);
      } catch (err) {
        console.error('[JournalDetailPage] Failed to fetch journal data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch journal data');
      } finally {
        setLoading(false);
      }
    };

    fetchJournalData();
  }, [id]);

  if (!id) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORS.darkBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: COLORS.textSecondary,
        }}
      >
        Invalid journal ID
      </div>
    );
  }

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
      <div style={{ marginBottom: '32px' }}>
        <Link href="/tools/journal-club/journals">
          <button
            style={{
              marginBottom: '16px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: `1px solid ${COLORS.purpleBorder}`,
              background: 'transparent',
              color: COLORS.purpleAccent,
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.borderColor = COLORS.purpleBorderHover;
              target.style.background = 'rgba(147, 51, 234, 0.1)';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.borderColor = COLORS.purpleBorder;
              target.style.background = 'transparent';
            }}
          >
            ← Back to Journals
          </button>
        </Link>

        {journal && (
          <>
            <h1
              style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: COLORS.textPrimary,
                marginBottom: '8px',
              }}
            >
              {journal.name}
            </h1>
            {journal.current_issue_label && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: COLORS.textSecondary,
                }}
              >
                {journal.current_issue_label}
              </p>
            )}
          </>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📖</div>
          <div style={{ color: COLORS.textSecondary, fontSize: '0.95rem' }}>Loading articles...</div>
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
      {!loading && articles.length === 0 && !error && (
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 'bold',
              color: COLORS.textPrimary,
              marginBottom: '8px',
            }}
          >
            No articles available
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: COLORS.textSecondary,
            }}
          >
            Check back soon for new issues.
          </p>
        </div>
      )}

      {/* Articles list */}
      {!loading && articles.length > 0 && (
        <div>
          <p
            style={{
              marginBottom: '16px',
              color: COLORS.textSecondary,
              fontSize: '0.9rem',
            }}
          >
            {articles.length} article{articles.length !== 1 ? 's' : ''} in current issue
          </p>
          <div>
            {articles.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                expanded={expandedId === article.id}
                onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
