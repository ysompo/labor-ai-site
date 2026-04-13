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

interface TocArticle {
  id: string;
  title: string;
  authors?: string[];
  abstract?: string;
  doi?: string;
  url: string;
  article_type?: string;
}

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [tocArticles, setTocArticles] = useState<TocArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Fetch journals on mount
  useEffect(() => {
    const fetchJournals = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/journal-club/journals');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        const journalList = Array.isArray(data) ? data : [];
        setJournals(journalList);
        if (journalList.length > 0) {
          setSelectedJournal(journalList[0]);
        }
      } catch (err) {
        console.error('Failed to fetch journals:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch journals');
      } finally {
        setLoading(false);
      }
    };
    fetchJournals();
  }, []);

  // Fetch TOC when journal is selected
  useEffect(() => {
    if (!selectedJournal) return;

    const fetchToc = async () => {
      try {
        const response = await fetch(`/api/journal-club/journals/${selectedJournal.id}/toc`);
        if (!response.ok) throw new Error('Failed to fetch TOC');
        const articles = await response.json();
        setTocArticles(Array.isArray(articles) ? articles : []);
      } catch (err) {
        console.error('Failed to fetch TOC:', err);
        setTocArticles([]);
      }
    };
    fetchToc();
  }, [selectedJournal]);

  const handleRemoveJournal = async (e: React.MouseEvent, journalId: string) => {
    e.stopPropagation();
    if (!confirm('Unfollow this journal?')) return;

    try {
      const response = await fetch(`/api/journal-club/journals/${journalId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove journal');
      setJournals(journals.filter(j => j.id !== journalId));
      if (selectedJournal?.id === journalId) {
        setSelectedJournal(journals.find(j => j.id !== journalId) || null);
      }
    } catch (err) {
      console.error('Failed to remove journal:', err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-main)', overflow: 'hidden' }}>
      {/* LEFT PANEL: Journal List */}
      <aside style={{ width: '288px', flexShrink: 0, borderRight: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px 16px 12px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>Following</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{journals.length} journal{journals.length !== 1 ? 's' : ''}</p>
        </div>

        <ul style={{ flex: 1, overflowY: 'auto', padding: '8px 0', margin: 0, listStyle: 'none' }}>
          {journals.map(j => (
            <li key={j.id}>
              <button
                onClick={() => setSelectedJournal(j)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  background: selectedJournal?.id === j.id ? 'rgba(0, 89, 119, 0.1)' : 'transparent',
                  borderLeft: `2px solid ${selectedJournal?.id === j.id ? 'var(--primary)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (selectedJournal?.id !== j.id) {
                    e.currentTarget.style.background = 'rgba(0, 89, 119, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedJournal?.id !== j.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* New issue indicator */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: j.has_new_issue ? '#22c55e' : 'transparent', flexShrink: 0 }} />

                {/* Journal info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.current_issue_label || 'No issue info'}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => handleRemoveJournal(e, j.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0 4px',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  ×
                </button>
              </button>
            </li>
          ))}
        </ul>

        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
          <Link href="/tools/journal-club/journals/add">
            <button style={{ width: '100%', padding: '8px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
              + Add Journal
            </button>
          </Link>
        </div>
      </aside>

      {/* RIGHT PANEL: TOC */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-main)' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
            <div>Loading journals...</div>
          </div>
        )}

        {error && (
          <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderRadius: '6px', margin: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            Error: {error}
          </div>
        )}

        {!loading && journals.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>No journals followed yet</p>
            <p style={{ fontSize: '0.875rem' }}>Click &quot;Add Journal&quot; to get started.</p>
          </div>
        )}

        {!loading && selectedJournal && (
          <>
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 10 }}>
              <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{selectedJournal.name}</h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>{selectedJournal.current_issue_label || 'Fetching current issue…'}</p>
            </div>

            {/* TOC Articles */}
            <div style={{ padding: '16px' }}>
              {tocArticles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
                  <p>No articles yet — refresh to fetch the current issue.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tocArticles.map(article => (
                    <div key={article.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-card)', overflow: 'hidden' }}>
                      {/* Article header */}
                      <div
                        onClick={() => setExpandedArticleId(expandedArticleId === article.id ? null : article.id)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          background: 'var(--bg-card)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 89, 119, 0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {article.article_type && (
                              <div style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {article.article_type}
                              </div>
                            )}
                            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.4' }}>{article.title}</p>
                            {article.authors && (
                              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                {article.authors.slice(0, 3).join(', ')}{article.authors.length > 3 ? ' et al.' : ''}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <Link href={`/tools/journal-club/journals/${selectedJournal.id}/${article.id}`}>
                              <button style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '600', border: '1px solid var(--primary)', background: 'var(--bg-card)', color: 'var(--primary)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                View
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Article detail (expanded) */}
                      {expandedArticleId === article.id && (
                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'rgba(0, 89, 119, 0.02)' }}>
                          {article.abstract ? (
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{article.abstract}</p>
                          ) : (
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No abstract available.</p>
                          )}
                          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem' }}>
                            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', cursor: 'pointer' }}>
                              → Article page
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
