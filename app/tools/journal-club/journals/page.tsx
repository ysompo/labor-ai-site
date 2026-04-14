'use client';

import { useState, useEffect } from 'react';

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

interface CatalogEntry {
  name: string;
  publisher: string;
  toc_url: string;
  issn: string;
}

const CATALOG: CatalogEntry[] = [
  { name: 'NEJM', publisher: 'NEJM', toc_url: 'https://www.nejm.org/toc/nejm/medical-research', issn: '0028-4793' },
  { name: 'JAMA', publisher: 'AMA', toc_url: 'https://jamanetwork.com/journals/jama/currentissue', issn: '0098-7484' },
  { name: 'The Lancet', publisher: 'Elsevier', toc_url: 'https://www.thelancet.com/current', issn: '0140-6736' },
  { name: 'BMJ', publisher: 'BMJ', toc_url: 'https://www.bmj.com/current-issue', issn: '0959-8138' },
  { name: 'Nature Medicine', publisher: 'Nature', toc_url: 'https://www.nature.com/nm', issn: '1078-8956' },
  { name: 'AJOG', publisher: 'Elsevier', toc_url: 'https://www.ajog.org/current', issn: '0002-9378' },
  { name: 'Obstetrics & Gynecology', publisher: 'ACOG', toc_url: 'https://journals.lww.com/greenjournal/pages/currenttoc.aspx', issn: '0029-7844' },
  { name: 'Annals of Internal Medicine', publisher: 'ACP', toc_url: 'https://www.acpjournals.org/toc/aim/current', issn: '0003-4819' },
];

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [tocArticles, setTocArticles] = useState<TocArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [issueCount, setIssueCount] = useState(1);
  const [refreshMessage, setRefreshMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customTocUrl, setCustomTocUrl] = useState('');
  const [customPublisher, setCustomPublisher] = useState('');
  const [customIssn, setCustomIssn] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/journal-club/journals');
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `HTTP ${res.status}`); }
        const list: Journal[] = await res.json();
        setJournals(Array.isArray(list) ? list : []);
        if (list.length > 0) setSelectedJournal(list[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch journals');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchToc = async (journalId: string) => {
    try {
      const res = await fetch(`/api/journal-club/journals/${journalId}/toc`);
      if (!res.ok) throw new Error('Failed to fetch TOC');
      const articles = await res.json();
      setTocArticles(Array.isArray(articles) ? articles : []);
    } catch {
      setTocArticles([]);
    }
  };

  useEffect(() => {
    if (!selectedJournal) return;
    fetchToc(selectedJournal.id);
  }, [selectedJournal]);

  const handleRefreshToc = async () => {
    if (!selectedJournal || refreshing) return;
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch(`/api/journal-club/journals/${selectedJournal.id}/toc?issues=${issueCount}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.issue_label) setSelectedJournal(p => p ? { ...p, current_issue_label: data.issue_label } : p);
      await fetchToc(selectedJournal.id);
      setRefreshMessage({ text: `Fetched ${data.count} articles`, ok: true });
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch (err) {
      setRefreshMessage({ text: err instanceof Error ? err.message : 'Refresh failed', ok: false });
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveJournal = async (e: React.MouseEvent, journalId: string) => {
    e.stopPropagation();
    if (!confirm('Unfollow this journal?')) return;
    try {
      await fetch(`/api/journal-club/journals/${journalId}`, { method: 'DELETE' });
      setJournals(j => j.filter(x => x.id !== journalId));
      if (selectedJournal?.id === journalId) setSelectedJournal(journals.find(x => x.id !== journalId) || null);
    } catch { /* ignore */ }
  };

  const handleAddFromCatalog = async (entry: CatalogEntry) => {
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch('/api/journal-club/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `HTTP ${res.status}`); }
      const data = await res.json();
      const newJournal = data.journal || data;
      setJournals(p => [...p, newJournal]);
      setShowModal(false);
      setCatalogSearch('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to add journal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customTocUrl.trim()) { setModalError('Name and TOC URL are required'); return; }
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch('/api/journal-club/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customName.trim(), publisher: customPublisher.trim() || undefined, toc_url: customTocUrl.trim(), issn: customIssn.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `HTTP ${res.status}`); }
      const data = await res.json();
      setJournals(p => [...p, data.journal || data]);
      setShowModal(false);
      setCustomName(''); setCustomTocUrl(''); setCustomPublisher(''); setCustomIssn('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to add journal');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCatalog = CATALOG.filter(e =>
    e.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    e.publisher.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8f9fa', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* LEFT PANEL */}
      <aside style={{ width: '272px', flexShrink: 0, background: '#ffffff', borderRight: '1px solid #e9ecef', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 14px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: '600', color: '#005977', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Work Sans', sans-serif" }}>Following</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#868e96' }}>{journals.length} journal{journals.length !== 1 ? 's' : ''}</p>
        </div>

        <ul style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', margin: 0, listStyle: 'none' }}>
          {journals.map(j => (
            <li key={j.id}>
              <button
                onClick={() => setSelectedJournal(j)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 8px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  border: 'none', borderRadius: '6px',
                  background: selectedJournal?.id === j.id ? 'rgba(0,89,119,0.08)' : 'transparent',
                  cursor: 'pointer', transition: 'background 0.15s',
                  color: 'inherit', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (selectedJournal?.id !== j.id) e.currentTarget.style.background = 'rgba(0,89,119,0.04)'; }}
                onMouseLeave={e => { if (selectedJournal?.id !== j.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: j.has_new_issue ? '#2f9e44' : '#dee2e6', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: selectedJournal?.id === j.id ? '#005977' : '#212529', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                  {j.current_issue_label && <div style={{ fontSize: '11px', color: '#868e96', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{j.current_issue_label}</div>}
                </div>
                <button
                  onClick={e => handleRemoveJournal(e, j.id)}
                  style={{ background: 'none', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '14px', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#e03131'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#adb5bd'; }}
                >×</button>
              </button>
            </li>
          ))}
          {!loading && journals.length === 0 && (
            <li style={{ padding: '24px 8px', textAlign: 'center', color: '#adb5bd', fontSize: '13px' }}>No journals yet</li>
          )}
        </ul>

        <div style={{ padding: '12px 8px', borderTop: '1px solid #e9ecef' }}>
          <button
            onClick={() => setShowModal(true)}
            style={{ width: '100%', padding: '9px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #005977, #007398)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.02em' }}
          >
            + Add Journal
          </button>
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f9fa' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#868e96', fontSize: '14px' }}>
            Loading journals…
          </div>
        )}

        {error && (
          <div style={{ margin: '24px', padding: '14px 16px', background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '6px', color: '#c92a2a', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {!loading && !selectedJournal && journals.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#868e96', gap: '8px' }}>
            <div style={{ fontSize: '36px' }}>📚</div>
            <p style={{ fontSize: '15px', fontWeight: '600', color: '#495057', margin: 0 }}>No journals followed yet</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Click &quot;Add Journal&quot; to get started.</p>
          </div>
        )}

        {selectedJournal && (
          <>
            {/* Sticky Header */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(248,249,250,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e9ecef', padding: '16px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#212529', fontFamily: "'Noto Serif', Georgia, serif", lineHeight: 1.2 }}>
                    {selectedJournal.name}
                  </h1>
                  {selectedJournal.current_issue_label && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#868e96', fontFamily: "'Work Sans', sans-serif", letterSpacing: '0.03em' }}>
                      {selectedJournal.current_issue_label}
                    </p>
                  )}
                </div>

                {/* Refresh controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {refreshMessage && (
                    <span style={{ fontSize: '12px', color: refreshMessage.ok ? '#2f9e44' : '#c92a2a', fontWeight: '500' }}>
                      {refreshMessage.text}
                    </span>
                  )}
                  <select
                    value={issueCount}
                    onChange={e => setIssueCount(Number(e.target.value))}
                    disabled={refreshing}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', background: '#ffffff', fontSize: '13px', color: '#495057', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <option value={1}>1 issue</option>
                    <option value={2}>2 issues</option>
                    <option value={3}>3 issues</option>
                    <option value={4}>4 issues</option>
                  </select>
                  <button
                    onClick={handleRefreshToc}
                    disabled={refreshing}
                    style={{
                      padding: '9px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      background: refreshing ? '#adb5bd' : 'linear-gradient(135deg, #005977, #007398)',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: refreshing ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.02em',
                      boxShadow: refreshing ? 'none' : '0 2px 8px rgba(0,89,119,0.25)',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {refreshing ? '⏳ Fetching…' : '↻ Fetch Latest'}
                  </button>
                </div>
              </div>
            </div>

            {/* Article count */}
            {tocArticles.length > 0 && (
              <div style={{ padding: '16px 28px 4px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: '600', color: '#868e96', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Work Sans', sans-serif" }}>
                  {tocArticles.length} article{tocArticles.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {/* Empty state */}
            {tocArticles.length === 0 && !refreshing && (
              <div style={{ padding: '64px 28px', textAlign: 'center', color: '#868e96' }}>
                <p style={{ fontSize: '32px', margin: '0 0 12px' }}>📄</p>
                <p style={{ fontSize: '15px', fontWeight: '600', color: '#495057', margin: '0 0 6px' }}>No articles yet</p>
                <p style={{ fontSize: '13px', margin: 0 }}>Click &quot;↻ Fetch Latest&quot; to load the current issue.</p>
              </div>
            )}

            {/* Articles list */}
            <div style={{ padding: '12px 28px 32px', display: 'flex', flexDirection: 'column', gap: '0' }}>
              {tocArticles.map((article, idx) => (
                <div key={article.id}>
                  {/* Divider between articles */}
                  {idx > 0 && <div style={{ height: '1px', background: '#e9ecef', margin: '0' }} />}

                  <div
                    style={{ padding: '20px 0', cursor: 'pointer' }}
                    onClick={() => setExpandedArticleId(expandedArticleId === article.id ? null : article.id)}
                  >
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Article type chip */}
                        {article.article_type && (
                          <div style={{ marginBottom: '6px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              background: 'rgba(0,89,119,0.08)',
                              color: '#005977',
                              fontSize: '10px',
                              fontWeight: '600',
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              fontFamily: "'Work Sans', sans-serif",
                            }}>
                              {article.article_type}
                            </span>
                          </div>
                        )}

                        {/* Title */}
                        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#212529', fontFamily: "'Noto Serif', Georgia, serif", lineHeight: '1.4' }}>
                          {article.title}
                        </h3>

                        {/* Authors */}
                        {article.authors && article.authors.length > 0 && (
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#868e96', lineHeight: '1.4' }}>
                            {article.authors.slice(0, 4).join(', ')}{article.authors.length > 4 ? ' et al.' : ''}
                          </p>
                        )}

                        {/* Abstract preview */}
                        {article.abstract && expandedArticleId !== article.id && (
                          <p style={{ margin: 0, fontSize: '13px', color: '#495057', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {article.abstract}
                          </p>
                        )}

                        {/* Expanded abstract + actions */}
                        {expandedArticleId === article.id && (
                          <div onClick={e => e.stopPropagation()}>
                            {article.abstract && (
                              <div style={{ marginBottom: '14px' }}>
                                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '600', color: '#868e96', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Work Sans', sans-serif" }}>Abstract</p>
                                <p style={{ margin: 0, fontSize: '13px', color: '#495057', lineHeight: '1.7' }}>{article.abstract}</p>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {article.doi && (
                                <a
                                  href={`https://doi.org/${article.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '12px', color: '#005977', textDecoration: 'none' }}
                                >
                                  → {article.doi}
                                </a>
                              )}
                              <button
                                onClick={async () => {
                                  await fetch('/api/journal-club/reading-list', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ toc_article_id: article.id }),
                                  });
                                }}
                                style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid #ced4da', background: '#ffffff', color: '#495057', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                              >
                                + Reading List
                              </button>
                              <button
                                onClick={async () => {
                                  await fetch('/api/journal-club/download', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ article_url: article.url, article_title: article.title, article_doi: article.doi }),
                                  });
                                }}
                                style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', background: 'linear-gradient(135deg, #005977, #007398)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                ⬇ PDF
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expand chevron */}
                      <div style={{ fontSize: '12px', color: '#adb5bd', paddingTop: '4px', flexShrink: 0, transform: expandedArticleId === article.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ADD JOURNAL MODAL */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#ffffff', borderRadius: '8px', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}
          >
            <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#212529', fontFamily: "'Noto Serif', Georgia, serif" }}>Add Journal</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#868e96', cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
              {modalError && (
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '4px', color: '#c92a2a', fontSize: '13px' }}>{modalError}</div>
              )}

              {/* Catalog */}
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '600', color: '#868e96', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Work Sans', sans-serif" }}>From Catalog</p>
              <input
                type="text"
                placeholder="Search journals…"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px', marginBottom: '10px', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
                {filteredCatalog.map(entry => (
                  <button
                    key={entry.name}
                    onClick={() => handleAddFromCatalog(entry)}
                    disabled={submitting}
                    style={{ padding: '10px 12px', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,89,119,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#212529', fontFamily: "'Noto Serif', Georgia, serif" }}>{entry.name}</span>
                      <span style={{ fontSize: '11px', color: '#868e96', marginLeft: '8px' }}>{entry.publisher}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#005977', fontWeight: '600' }}>+ Follow</span>
                  </button>
                ))}
              </div>

              {/* Custom */}
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '600', color: '#868e96', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Work Sans', sans-serif" }}>Custom Journal</p>
              <form onSubmit={handleAddCustom} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Journal Name *', value: customName, set: setCustomName, type: 'text', placeholder: 'e.g. NEJM Evidence' },
                  { label: 'TOC URL *', value: customTocUrl, set: setCustomTocUrl, type: 'url', placeholder: 'https://...' },
                  { label: 'Publisher', value: customPublisher, set: setCustomPublisher, type: 'text', placeholder: 'optional' },
                  { label: 'ISSN', value: customIssn, set: setCustomIssn, type: 'text', placeholder: 'optional, e.g. 0028-4793' },
                ].map(field => (
                  <div key={field.label}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '4px' }}>{field.label}</label>
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={e => field.set(e.target.value)}
                      placeholder={field.placeholder}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px', borderRadius: '4px', border: 'none', background: 'linear-gradient(135deg, #005977, #007398)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '4px' }}
                >
                  {submitting ? 'Adding…' : 'Add Journal'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
