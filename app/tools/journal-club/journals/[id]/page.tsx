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

function ArticleRow({ article, expanded, onToggle }: { article: Article; expanded: boolean; onToggle: () => void }) {
  const [readingListAdded, setReadingListAdded] = useState(false);
  const [downloadingArticleId, setDownloadingArticleId] = useState<string | null>(null);
  const [addingToListArticleId, setAddingToListArticleId] = useState<string | null>(null);

  const handleAddToReadingList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAddingToListArticleId(article.id);
    try {
      const response = await fetch('/api/journal-club/reading-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toc_article_id: article.id }),
      });
      if (!response.ok) {
        alert('Failed to add to reading list');
        setAddingToListArticleId(null);
        return;
      }
      // Only update state after successful response
      setReadingListAdded(!readingListAdded);
      setAddingToListArticleId(null);
    } catch (err) {
      console.error('[ArticleRow] Failed to add to reading list:', err);
      alert('Error adding to reading list');
      setAddingToListArticleId(null);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingArticleId(article.id);
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
      setDownloadingArticleId(null);
    } catch (err) {
      console.error('[ArticleRow] Failed to download PDF:', err);
      alert('Error downloading PDF');
      setDownloadingArticleId(null);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        marginBottom: '12px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(0, 89, 119, 0.05)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0, 89, 119, 0.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)';
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
                color: 'var(--text-primary)',
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
                  color: 'var(--text-secondary)',
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
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
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
                color: 'var(--text-secondary)',
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
            borderTop: '1px solid var(--border-color)',
            padding: '16px',
            backgroundColor: 'rgba(0, 89, 119, 0.03)',
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
                  color: 'var(--text-secondary)',
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
                  color: 'var(--text-tertiary)',
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
                  color: 'var(--primary)',
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
              disabled={downloadingArticleId === article.id}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: downloadingArticleId === article.id ? 'rgba(0, 89, 119, 0.5)' : 'var(--primary)',
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: downloadingArticleId === article.id ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: downloadingArticleId === article.id ? 0.6 : 1,
              }}
            >
              {downloadingArticleId === article.id ? '⏳ Loading...' : '⬇ Download PDF'}
            </button>

            <button
              onClick={handleAddToReadingList}
              disabled={addingToListArticleId === article.id}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${readingListAdded ? '#16a34a' : 'var(--primary)'}`,
                background: readingListAdded ? 'rgba(22, 163, 74, 0.1)' : 'transparent',
                color: readingListAdded ? '#16a34a' : 'var(--primary)',
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: addingToListArticleId === article.id ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: addingToListArticleId === article.id ? 0.6 : 1,
              }}
            >
              {addingToListArticleId === article.id ? '⏳ Loading...' : readingListAdded ? '✓ In Reading List' : '+ Add to Reading List'}
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
          background: 'var(--bg-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
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
        background: 'var(--bg-main)',
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
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.background = 'rgba(0, 89, 119, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.background = 'transparent';
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
                color: 'var(--text-primary)',
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
                  color: 'var(--text-secondary)',
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
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading articles...</div>
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
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}
          >
            No articles available
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
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
              color: 'var(--text-secondary)',
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
