'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ModuleId, Project, ChatMessage } from '@/lib/research/types';
import { MODULE_META } from '@/lib/research/types';

// ─── colours ────────────────────────────────────────────────────────────────
const C = {
  bg:         '#f8f9fa',
  sidebar:    '#ffffff',
  panel:      '#ffffff',
  border:     'rgba(75,46,106,0.15)',
  borderFaint:'rgba(0,0,0,0.08)',
  text:       '#1a1a2e',
  textMuted:  '#6b7280',
  purple:     '#4B2E6A',
  purpleLight:'#4B2E6A',
  green:      '#16a34a',
};

// ─── Module tabs strip ───────────────────────────────────────────────────────
function ModuleTabs({ active, onChange }: { active: ModuleId; onChange: (m: ModuleId) => void }) {
  const modules = Object.entries(MODULE_META) as [ModuleId, typeof MODULE_META[ModuleId]][];
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.panel, overflowX: 'auto' }}>
      {modules.map(([id, meta]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: '12px 18px', border: 'none', background: 'none',
            borderBottom: active === id ? `2px solid ${C.purple}` : '2px solid transparent',
            color: active === id ? C.purpleLight : C.textMuted,
            fontWeight: active === id ? 700 : 400,
            fontSize: '0.82rem', cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap', marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span>{meta.icon}</span>
          <span>{meta.labelHe}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Project sidebar ─────────────────────────────────────────────────────────
function ProjectSidebar({
  projects, activeId, onSelect, onCreate,
}: {
  projects: Project[];
  activeId: number | null;
  onSelect: (p: Project) => void;
  onCreate: (title: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onCreate(newTitle.trim());
    setNewTitle('');
    setCreating(false);
  };

  return (
    <div style={{
      width: 220, flexShrink: 0,
      borderLeft: `1px solid ${C.border}`,
      background: C.sidebar,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
      direction: 'rtl',
    }}>
      <div style={{ padding: '16px 14px 10px', borderBottom: `1px solid ${C.borderFaint}` }}>
        <div style={{ color: C.purpleLight, fontWeight: 700, fontSize: '0.8rem', marginBottom: 10 }}>
          🗂 פרויקטים
        </div>
        {creating ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              placeholder="שם הפרויקט..."
              style={{
                background: '#f3f4f6', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '7px 10px', color: C.text, fontSize: '0.8rem',
                fontFamily: 'inherit', outline: 'none', direction: 'rtl',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleCreate} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: C.purple, color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>צור</button>
              <button onClick={() => setCreating(false)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>ביטול</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={{
              width: '100%', padding: '7px 0', borderRadius: 7,
              border: `1px dashed ${C.border}`, background: 'none',
              color: C.textMuted, fontSize: '0.78rem', cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            + פרויקט חדש
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {projects.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: '0.75rem', padding: '16px 14px', textAlign: 'center', lineHeight: 1.6 }}>
            אין פרויקטים עדיין.<br />צור פרויקט ראשון למעלה.
          </div>
        ) : projects.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            style={{
              width: '100%', textAlign: 'right', padding: '9px 14px',
              border: 'none', borderRight: activeId === p.id ? `3px solid ${C.purple}` : '3px solid transparent',
              background: activeId === p.id ? 'rgba(124,58,237,0.1)' : 'none',
              color: activeId === p.id ? C.purpleLight : C.text,
              fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'block', lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: activeId === p.id ? 700 : 400, marginBottom: 2 }}>{p.title}</div>
            <div style={{ color: C.textMuted, fontSize: '0.7rem' }}>
              {p.status === 'draft' ? 'טיוטה' : p.status}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Streaming chat ───────────────────────────────────────────────────────────
function ResearchChat({
  moduleId,
  projectId,
  projectTitle,
}: {
  moduleId: ModuleId;
  projectId: number | null;
  projectTitle: string;
}) {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [language, setLanguage]   = useState<'he' | 'en'>('he');
  const [error, setError]         = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  const meta = MODULE_META[moduleId];

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset on module change
  useEffect(() => {
    setMessages([]);
    setError('');
  }, [moduleId, projectId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setError('');

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setStreaming(true);

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/research/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({ moduleId, messages: nextMessages, language }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'שגיאת שרת');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as { type: string; text?: string };
            if (chunk.type === 'text' && chunk.text) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + chunk.text,
                };
                return updated;
              });
            }
            if (chunk.type === 'tool' && chunk.text) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + `\n\n*${chunk.text}*\n\n`,
                };
                return updated;
              });
            }
            if (chunk.type === 'error') throw new Error(chunk.text);
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setMessages(prev => prev.filter((_, i) => i < prev.length - 1));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, moduleId, language, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleExportPDF = () => {
    if (!messages.length) return;
    const content = messages.map(m =>
      `${m.role === 'user' ? '👤 שאלה' : '🤖 Labor-AI'}:\n${m.content}`
    ).join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${moduleId}-${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, direction: language === 'he' ? 'rtl' : 'ltr' }}>
      {/* Chat toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
        borderBottom: `1px solid ${C.borderFaint}`, background: C.panel,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
          <span style={{ color: C.purpleLight, fontWeight: 700, fontSize: '0.85rem' }}>{meta.labelHe}</span>
          {projectTitle && <span style={{ color: C.textMuted, fontSize: '0.75rem' }}>— {projectTitle}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Language toggle */}
          <button
            onClick={() => setLanguage(l => l === 'he' ? 'en' : 'he')}
            style={{
              padding: '4px 12px', borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'none', color: C.textMuted,
              fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {language === 'he' ? '🇮🇱 עברית' : '🇺🇸 English'}
          </button>
          {/* Clear */}
          <button
            onClick={() => setMessages([])}
            disabled={!messages.length}
            style={{
              padding: '4px 12px', borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'none', color: C.textMuted,
              fontSize: '0.75rem', cursor: messages.length ? 'pointer' : 'default',
              opacity: messages.length ? 1 : 0.4, fontFamily: 'inherit',
            }}
          >
            נקה
          </button>
          {/* Export */}
          <button
            onClick={handleExportPDF}
            disabled={!messages.length}
            style={{
              padding: '4px 12px', borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'none', color: C.textMuted,
              fontSize: '0.75rem', cursor: messages.length ? 'pointer' : 'default',
              opacity: messages.length ? 1 : 0.4, fontFamily: 'inherit',
            }}
          >
            📄 ייצוא
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: C.textMuted }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{meta.icon}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>{meta.labelHe}</div>
            <div style={{ fontSize: '0.82rem', maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>{meta.description}</div>
            <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {getStarterPrompts(moduleId, language).map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: 'rgba(75,46,106,0.06)',
                    color: C.purple, fontSize: '0.78rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                    maxWidth: 220, textAlign: 'center', lineHeight: 1.4,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
            }}
          >
            <div style={{
              maxWidth: '78%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
              background: msg.role === 'user' ? '#f3f4f6' : 'rgba(75,46,106,0.08)',
              border: `1px solid ${msg.role === 'user' ? C.borderFaint : C.border}`,
              color: C.text,
              fontSize: '0.875rem',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                <span style={{ display: 'inline-block', width: 6, height: 14, background: C.purpleLight, borderRadius: 2, marginRight: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />
              )}
            </div>
          </div>
        ))}

        {error && (
          <div style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center', padding: '8px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.borderFaint}`, background: C.panel }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder={language === 'he' ? 'כתוב כאן... (Enter לשליחה, Shift+Enter לשורה חדשה)' : 'Type here... (Enter to send, Shift+Enter for new line)'}
            rows={2}
            style={{
              flex: 1, resize: 'none',
              background: '#f8f9fa',
              border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '10px 14px',
              color: C.text, fontSize: '0.875rem',
              fontFamily: 'inherit', outline: 'none',
              lineHeight: 1.5, direction: language === 'he' ? 'rtl' : 'ltr',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={streaming || !input.trim()}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: streaming || !input.trim() ? '#d1d5db' : `linear-gradient(135deg, #4B2E6A, #7c3aed)`,
              color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', minWidth: 80,
            }}
          >
            {streaming ? '...' : '⬆'}
          </button>
        </div>
        <div style={{ color: C.textMuted, fontSize: '0.68rem', marginTop: 6, textAlign: 'center' }}>
          Labor-AI Research Assistant · Hadassah Mount Scopus · לצרכי לימוד בלבד — כל פלט טעון בדיקת מנחה
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}

function getStarterPrompts(moduleId: ModuleId, language: 'he' | 'en'): string[] {
  const he: Record<ModuleId, string[]> = {
    'ideation':      ['שמתי לב לדפוס קליני מעניין בחולות עם סוכרת הריון', 'אני רוצה לחקור גורמי סיכון ל-PPH', 'יש לי רעיון למחקר על לידה מכשירנית'],
    'data-explorer': ['אילו משתנים קיימים בנושא מצג עכוז?', 'האם יש נתוני Apgar בבסיס הנתונים?', 'חפש משתנים הקשורים ל-GDM'],
    'lit-search':    ['בנה מחרוזת PubMed לנושא VBAC ו-BMI', 'סנן עבורי רשימת תקצירים', 'מה ידוע על ניבוי PPH?'],
    'stats':         ['מה הבדיקה המתאימה להשוואת שתי קבוצות?', 'עזור לי לחשב גודל מדגם למחקר', 'צור תכנית ניתוח סטטיסטי ל-IRB'],
    'manuscript':    ['כתוב תקציר מובנה למחקר הקוהורט שלי', 'עזור לי לכתוב את סעיף השיטות', 'ניסחתי תגובה למבקרים — ערוך אותה'],
    'schedule':      ['צור לוח זמנים למחקר על לידה מוקדמת', 'אני בשלב הגשה ל-IRB — מה הצעדים הבאים?', 'עדכן את לוח הזמנים שלי'],
  };
  const en: Record<ModuleId, string[]> = {
    'ideation':      ['I noticed a pattern in GDM patients I want to investigate', "I want to study risk factors for PPH", 'I have an idea for an instrumental delivery study'],
    'data-explorer': ['What variables are available for breech presentation?', 'Is Apgar score data available?', 'Search for GDM-related variables'],
    'lit-search':    ['Build a PubMed search string for VBAC and BMI', 'Help me screen a list of abstracts', 'What is known about PPH prediction?'],
    'stats':         ['What test should I use to compare two groups?', 'Help me calculate sample size for my study', 'Generate a statistical analysis plan for IRB'],
    'manuscript':    ['Write a structured abstract for my cohort study', 'Help me write the Methods section', 'Edit my response to reviewers'],
    'schedule':      ['Create a timeline for a preterm labor study', "I'm at IRB submission — what are the next steps?", 'Update my research schedule'],
  };
  return (language === 'he' ? he : en)[moduleId] ?? [];
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ResearchWorkspace() {
  const [activeModule, setActiveModule] = useState<ModuleId>('ideation');
  const [projects, setProjects]         = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  useEffect(() => {
    fetch('/api/research/projects')
      .then(r => r.json())
      .then((d: { projects?: Project[] }) => { if (d.projects) setProjects(d.projects); })
      .catch(() => {});
  }, []);

  const handleCreate = async (title: string) => {
    try {
      const res = await fetch('/api/research/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const d = await res.json() as { project?: Project };
      if (d.project) {
        setProjects(prev => [d.project!, ...prev]);
        setActiveProject(d.project!);
      }
    } catch { /* ignore */ }
  };

  return (
    <div style={{
      height: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      direction: 'rtl',
    }}>
      {/* Module tabs */}
      <ModuleTabs active={activeModule} onChange={setActiveModule} />

      {/* Main content: sidebar + chat */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Chat / module content */}
        <ResearchChat
          moduleId={activeModule}
          projectId={activeProject?.id ?? null}
          projectTitle={activeProject?.title ?? ''}
        />

        {/* Project sidebar */}
        <ProjectSidebar
          projects={projects}
          activeId={activeProject?.id ?? null}
          onSelect={setActiveProject}
          onCreate={handleCreate}
        />
      </div>
    </div>
  );
}
