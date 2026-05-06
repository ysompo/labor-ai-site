'use client';

import React from 'react';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ModuleId, Project, ChatMessage, BriefSection, DeferredQuestion } from '@/lib/research/types';
import { MODULE_META } from '@/lib/research/types';

// Colors
const C = {
  bg:          '#f8f9fa',
  sidebar:     '#ffffff',
  panel:       '#ffffff',
  border:      'rgba(75,46,106,0.15)',
  borderFaint: 'rgba(0,0,0,0.08)',
  text:        '#1a1a2e',
  textMuted:   '#6b7280',
  purple:      '#4B2E6A',
  purpleLight: '#4B2E6A',
  green:       '#16a34a',
  amber:       '#d97706',
};

// ─── Lightweight markdown renderer ────────────────────────────────────────────
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={match.index} style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3, fontSize: '0.85em' }}>{match[4]}</code>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} style={{ background: 'rgba(0,0,0,0.05)', padding: '8px 12px', borderRadius: 6, overflow: 'auto', fontSize: '0.8rem', margin: '4px 0' }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }
    if (line.trim() === '') { elements.push(<br key={`br-${i}`} />); continue; }

    // Table: collect consecutive | rows
    if (/^\|.*\|/.test(line.trim())) {
      const tableRows: string[][] = [];
      let j = i;
      while (j < lines.length && /^\|.*\|/.test(lines[j].trim())) {
        const cells = lines[j].split('|').slice(1, -1).map(c => c.trim());
        if (!/^[-:]+$/.test(cells.join(''))) tableRows.push(cells);
        j++;
      }
      if (tableRows.length > 0) {
        const [header, ...body] = tableRows;
        elements.push(
          <table key={`tbl-${i}`} style={{ borderCollapse: 'collapse', margin: '8px 0', fontSize: '0.82rem', width: '100%' }}>
            <thead>
              <tr>{header.map((c, ci) => <th key={ci} style={{ border: `1px solid ${C.border}`, padding: '6px 10px', background: 'rgba(75,46,106,0.06)', fontWeight: 600, textAlign: 'start' }}>{formatInline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>{row.map((c, ci) => <td key={ci} style={{ border: `1px solid ${C.borderFaint}`, padding: '5px 10px' }}>{formatInline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        );
        i = j - 1;
        continue;
      }
    }

    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const fontSize = level === 1 ? '1.1rem' : level === 2 ? '1rem' : '0.95rem';
      elements.push(<div key={`h-${i}`} style={{ margin: '8px 0 4px', fontSize, fontWeight: 700 }}>{formatInline(headerMatch[2])}</div>);
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      elements.push(<div key={`li-${i}`} style={{ paddingInlineStart: 16 }}>{'• '}{formatInline(line.replace(/^[-*]\s/, ''))}</div>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(<div key={`ol-${i}`} style={{ paddingInlineStart: 16 }}>{num}. {formatInline(line.replace(/^\d+\.\s/, ''))}</div>);
      continue;
    }
    elements.push(<span key={`p-${i}`}>{formatInline(line)}{'\n'}</span>);
  }
  return <>{elements}</>;
}

// ─── DB Message type ──────────────────────────────────────────────────────────
interface DbMessage {
  id: number;
  project_id: number;
  module_id: string;
  role: string;
  content: string;
  created_at: string;
}

// ─── Task type ────────────────────────────────────────────────────────────────
interface ResearchTask {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  status: string;
  due_date?: string;
  source_module?: string;
  is_ai_suggested: boolean;
  display_order: number;
  created_at: string;
  completed_at?: string;
}

// ─── Brief Panel (collapsible left sidebar) ──────────────────────────────────
function BriefPanel({
  sections,
  collapsed,
  onToggle,
  language,
}: {
  sections: BriefSection[];
  collapsed: boolean;
  onToggle: () => void;
  language: 'he' | 'en';
}) {
  const modules = Object.entries(MODULE_META) as [ModuleId, typeof MODULE_META[ModuleId]][];

  return (
    <div style={{
      width: collapsed ? 36 : 280,
      minWidth: collapsed ? 36 : 280,
      transition: 'width 0.2s ease, min-width 0.2s ease',
      borderLeft: `1px solid ${C.border}`,
      background: C.panel,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          padding: '8px', border: 'none', background: 'none', cursor: 'pointer',
          color: C.purple, fontSize: '0.75rem', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: `1px solid ${C.borderFaint}`,
          width: '100%',
        }}
      >
        {!collapsed && <span style={{ fontWeight: 600 }}>📄 תקציר מחקר</span>}
        <span style={{ fontSize: '1rem' }}>{collapsed ? '◀' : '▶'}</span>
      </button>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {modules.map(([id, meta]) => {
            const section = sections.find(s => s.module_id === id);
            const content = section?.content;
            const hasContent = content && Object.keys(content).length > 0;

            return (
              <div key={id} style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: '0.72rem', fontWeight: 600, color: C.purple,
                  display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
                }}>
                  <span>{meta.icon}</span>
                  <span>{language === 'he' ? meta.labelHe : meta.label}</span>
                </div>
                {hasContent ? (
                  <div style={{ fontSize: '0.7rem', color: C.text, lineHeight: 1.5 }}>
                    {Object.entries(content as Record<string, unknown>).map(([key, val]) => {
                      if (!val) return null;
                      const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
                      return (
                        <div key={key} style={{ marginBottom: 2 }}>
                          <span style={{ color: C.textMuted }}>{key}: </span>
                          <span>{displayVal}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.68rem', color: C.textMuted, fontStyle: 'italic' }}>
                    טרם הוזן
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Module tabs strip ────────────────────────────────────────────────────────
function ModuleTabs({
  active,
  onChange,
  touchedModules,
  deferredCounts,
  language,
}: {
  active: ModuleId;
  onChange: (m: ModuleId) => void;
  touchedModules: Set<string>;
  deferredCounts: Record<string, number>;
  language: 'he' | 'en';
}) {
  const modules = Object.entries(MODULE_META) as [ModuleId, typeof MODULE_META[ModuleId]][];
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.panel, overflowX: 'auto' }}>
      {modules.map(([id, meta]) => {
        const count = deferredCounts[id] || 0;
        return (
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
              position: 'relative',
            }}
          >
            <span>{meta.icon}</span>
            <span>{language === 'he' ? meta.labelHe : meta.label}</span>
            {touchedModules.has(id) && !count && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: C.purple, position: 'absolute',
                top: 8, right: 8,
              }} />
            )}
            {count > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: C.amber, color: '#fff',
                fontSize: '0.6rem', fontWeight: 700,
                borderRadius: '50%', width: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Task Sidebar ─────────────────────────────────────────────────────────────
function TaskSidebar({
  projectId,
  language,
  activeModule,
  moduleMessages,
}: {
  projectId: number;
  language: 'he' | 'en';
  activeModule: ModuleId;
  moduleMessages: ChatMessage[];
}) {
  const [tasks, setTasks]         = useState<ResearchTask[]>([]);
  const [loading, setLoading]     = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [adding, setAdding]       = useState(false);
  const [newTitle, setNewTitle]   = useState('');
  const [newDue, setNewDue]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDue, setEditDue]     = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/research/tasks?project_id=${projectId}`);
      const data = await res.json() as { tasks?: ResearchTask[] };
      if (data.tasks) setTasks(data.tasks);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/research/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, title: newTitle.trim(), due_date: newDue || undefined, source_module: activeModule }),
      });
      const data = await res.json() as { task?: ResearchTask };
      if (data.task) setTasks(prev => [...prev, data.task!]);
    } catch { /* ignore */ }
    setNewTitle('');
    setNewDue('');
    setAdding(false);
    setSaving(false);
  };

  const handleToggle = async (task: ResearchTask) => {
    const newStatus = task.status === 'pending' ? 'done' : 'pending';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt ?? undefined } : t));
    try {
      await fetch(`/api/research/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completed_at: completedAt }),
      });
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await fetch(`/api/research/tasks/${id}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  };

  const handleEditSave = async (id: number) => {
    if (!editTitle.trim()) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title: editTitle.trim(), due_date: editDue || undefined } : t));
    setEditId(null);
    try {
      await fetch(`/api/research/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), due_date: editDue || null }),
      });
    } catch { /* ignore */ }
  };

  const handleAiSuggest = async () => {
    setSuggesting(true);
    try {
      const recentMessages = moduleMessages.slice(-20);
      const res = await fetch('/api/research/tasks/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, language, sourceModule: activeModule, recentMessages }),
      });
      const data = await res.json() as { tasks?: ResearchTask[]; error?: string };
      if (!res.ok) {
        console.error('[AI suggest tasks] server error:', res.status, data.error);
      } else if (data.tasks?.length) {
        setTasks(prev => [...prev, ...data.tasks!]);
      }
    } catch (e) {
      console.error('[AI suggest tasks] fetch error:', e);
    }
    setSuggesting(false);
  };

  const moduleTasks = tasks.filter(t => t.source_module === activeModule);
  const pending = moduleTasks.filter(t => t.status === 'pending');
  const done    = moduleTasks.filter(t => t.status === 'done');

  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderRight: `1px solid ${C.border}`,
      background: C.sidebar,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
      direction: 'rtl',
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.borderFaint}` }}>
        <div style={{ color: C.purpleLight, fontWeight: 700, fontSize: '0.8rem', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ משימות</span>
          <span style={{ color: C.textMuted, fontWeight: 400, fontSize: '0.72rem' }}>
            {pending.length} פתוחות
          </span>
        </div>

        {/* AI suggest button */}
        <button
          onClick={handleAiSuggest}
          disabled={suggesting}
          style={{
            width: '100%', padding: '6px 0', borderRadius: 7,
            border: `1px solid rgba(124,58,237,0.3)`,
            background: suggesting ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.06)',
            color: '#7c3aed',
            fontSize: '0.73rem', cursor: suggesting ? 'wait' : 'pointer',
            fontFamily: 'inherit', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            opacity: suggesting ? 0.7 : 1,
          }}
        >
          {suggesting ? '⏳ מייצר משימות...' : '✨ הצע משימות AI'}
        </button>

        {/* Add task */}
        {adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="תיאור המשימה..."
              style={{
                background: '#f3f4f6', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '7px 10px', color: C.text, fontSize: '0.78rem',
                fontFamily: 'inherit', outline: 'none', direction: 'rtl',
              }}
            />
            <input
              type="date"
              value={newDue}
              onChange={e => setNewDue(e.target.value)}
              style={{
                background: '#f3f4f6', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '5px 10px', color: C.textMuted, fontSize: '0.73rem',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: 'none', background: C.purple, color: '#fff', fontSize: '0.73rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {saving ? '...' : 'שמור'}
              </button>
              <button onClick={() => setAdding(false)} style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: '0.73rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              width: '100%', padding: '6px 0', borderRadius: 7,
              border: `1px dashed ${C.border}`, background: 'none',
              color: C.textMuted, fontSize: '0.73rem', cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            + הוסף משימה
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {loading && (
          <div style={{ color: C.textMuted, fontSize: '0.73rem', textAlign: 'center', paddingTop: 16 }}>טוען...</div>
        )}

        {!loading && tasks.length === 0 && (
          <div style={{ color: C.textMuted, fontSize: '0.73rem', padding: '16px 10px', textAlign: 'center', lineHeight: 1.6 }}>
            אין משימות עדיין.<br />לחץ ✨ לקבלת הצעות מ-AI.
          </div>
        )}

        {/* Pending tasks */}
        {pending.map(task => (
          <div key={task.id} style={{
            padding: '8px 8px', borderRadius: 7, marginBottom: 4,
            background: task.is_ai_suggested ? 'rgba(124,58,237,0.04)' : 'transparent',
            border: task.is_ai_suggested ? '1px solid rgba(124,58,237,0.15)' : '1px solid transparent',
          }}>
            {editId === task.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(task.id); if (e.key === 'Escape') setEditId(null); }}
                    style={{
                      flex: 1, background: '#f3f4f6', border: `1px solid ${C.border}`,
                      borderRadius: 5, padding: '4px 8px', color: C.text, fontSize: '0.75rem',
                      fontFamily: 'inherit', outline: 'none', direction: 'rtl',
                    }}
                  />
                  <button onClick={() => handleEditSave(task.id)} style={{ background: C.purple, border: 'none', borderRadius: 4, color: '#fff', fontSize: '0.68rem', padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                </div>
                <input
                  type="date"
                  value={editDue}
                  onChange={e => setEditDue(e.target.value)}
                  style={{
                    background: '#f3f4f6', border: `1px solid ${C.border}`,
                    borderRadius: 5, padding: '3px 8px', color: C.textMuted, fontSize: '0.7rem',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleToggle(task)}
                  style={{ marginTop: 2, cursor: 'pointer', accentColor: C.purple, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontSize: '0.78rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {task.is_ai_suggested && <span style={{ color: '#7c3aed', fontSize: '0.65rem', marginLeft: 4 }}>✨</span>}
                    {task.title}
                  </div>
                  {task.due_date && (
                    <div style={{ color: C.textMuted, fontSize: '0.65rem', marginTop: 2 }}>
                      📅 {task.due_date.slice(0, 10)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={() => { setEditId(task.id); setEditTitle(task.title); setEditDue(task.due_date?.slice(0, 10) ?? ''); }}
                    style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: '0.7rem', cursor: 'pointer', padding: '0 2px' }}
                    title="ערוך"
                  >✎</button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', padding: '0 2px' }}
                    title="מחק"
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Done tasks */}
        {done.length > 0 && (
          <>
            <div style={{ color: C.textMuted, fontSize: '0.68rem', padding: '8px 8px 4px', borderTop: `1px solid ${C.borderFaint}`, marginTop: 6 }}>
              הושלמו ({done.length})
            </div>
            {done.map(task => (
              <div key={task.id} style={{ padding: '6px 8px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => handleToggle(task)}
                  style={{ marginTop: 2, cursor: 'pointer', accentColor: C.green, flexShrink: 0 }}
                />
                <div style={{ color: C.textMuted, fontSize: '0.75rem', textDecoration: 'line-through', lineHeight: 1.4, flex: 1 }}>
                  {task.title}
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                  title="מחק"
                >✕</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Task Manager Panel (full-width Schedule module view) ─────────────────────
function TaskManagerPanel({
  projectId,
  language,
}: {
  projectId: number;
  language: 'he' | 'en';
}) {
  const [tasks, setTasks]       = useState<ResearchTask[]>([]);
  const [loading, setLoading]   = useState(false);
  const [sortMode, setSortMode] = useState<'date' | 'module'>('date');
  const [editId, setEditId]     = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDue, setEditDue]   = useState('');
  const [adding, setAdding]     = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue]     = useState('');
  const [doneOpen, setDoneOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/research/tasks?project_id=${projectId}`);
      const data = await res.json() as { tasks?: ResearchTask[] };
      if (data.tasks) setTasks(data.tasks);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggle = async (task: ResearchTask) => {
    const newStatus = task.status === 'pending' ? 'done' : 'pending';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt ?? undefined } : t));
    try {
      await fetch(`/api/research/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completed_at: completedAt }),
      });
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await fetch(`/api/research/tasks/${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
  };

  const handleEditSave = async (id: number) => {
    if (!editTitle.trim()) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title: editTitle.trim(), due_date: editDue || undefined } : t));
    setEditId(null);
    try {
      await fetch(`/api/research/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), due_date: editDue || null }),
      });
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch('/api/research/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, title: newTitle.trim(), due_date: newDue || undefined }),
      });
      const data = await res.json() as { task?: ResearchTask };
      if (data.task) setTasks(prev => [...prev, data.task!]);
    } catch { /* ignore */ }
    setNewTitle(''); setNewDue(''); setAdding(false);
  };

  const pending = tasks.filter(t => t.status === 'pending');
  const done    = tasks.filter(t => t.status === 'done');

  // Sort/group logic
  const sortedPending = [...pending].sort((a, b) => {
    const da = a.due_date ?? 'z';
    const db = b.due_date ?? 'z';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  type Group = { key: string; label: string; tasks: ResearchTask[] };
  const groups: Group[] = sortMode === 'module'
    ? (() => {
        const map = new Map<string, ResearchTask[]>();
        for (const t of sortedPending) {
          const key = t.source_module ?? '__general__';
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(t);
        }
        return Array.from(map.entries()).map(([key, items]) => {
          const meta = MODULE_META[key as ModuleId];
          const label = meta
            ? `${meta.icon} ${language === 'he' ? meta.labelHe : meta.label}`
            : (language === 'he' ? '📌 כללי' : '📌 General');
          return { key, label, tasks: items };
        });
      })()
    : [{ key: 'all', label: '', tasks: sortedPending }];

  const taskRow = (task: ResearchTask, showModuleBadge: boolean) => (
    <div key={task.id} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '9px 12px', borderRadius: 8, marginBottom: 3,
      background: task.is_ai_suggested ? 'rgba(124,58,237,0.04)' : '#fff',
      border: `1px solid ${task.is_ai_suggested ? 'rgba(124,58,237,0.15)' : C.borderFaint}`,
    }}>
      <input
        type="checkbox" checked={false} onChange={() => handleToggle(task)}
        style={{ marginTop: 3, cursor: 'pointer', accentColor: C.purple, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editId === task.id ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEditSave(task.id); if (e.key === 'Escape') setEditId(null); }}
                style={{
                  flex: 1, background: '#f3f4f6', border: `1px solid ${C.border}`,
                  borderRadius: 5, padding: '5px 10px', color: C.text, fontSize: '0.85rem',
                  fontFamily: 'inherit', outline: 'none', direction: 'rtl',
                }}
              />
              <button onClick={() => handleEditSave(task.id)} style={{ background: C.purple, border: 'none', borderRadius: 5, color: '#fff', fontSize: '0.78rem', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
              <button onClick={() => setEditId(null)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMuted, fontSize: '0.78rem', padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <input
              type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
              style={{
                background: '#f3f4f6', border: `1px solid ${C.border}`,
                borderRadius: 5, padding: '4px 10px', color: C.textMuted, fontSize: '0.8rem',
                fontFamily: 'inherit', outline: 'none', width: 160,
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: C.text, fontSize: '0.88rem', lineHeight: 1.4 }}>
              {task.is_ai_suggested && <span style={{ color: '#7c3aed', fontSize: '0.7rem', marginLeft: 4 }}>✨</span>}
              {task.title}
            </span>
            {task.due_date && (
              <span style={{ color: C.textMuted, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                📅 {task.due_date.slice(0, 10)}
              </span>
            )}
            {showModuleBadge && task.source_module && (() => {
              const meta = MODULE_META[task.source_module as ModuleId];
              const label = meta ? `${meta.icon} ${language === 'he' ? meta.labelHe : meta.label}` : task.source_module;
              return (
                <span style={{
                  background: 'rgba(124,58,237,0.08)', color: '#7c3aed',
                  borderRadius: 10, padding: '1px 8px', fontSize: '0.68rem', whiteSpace: 'nowrap',
                }}>{label}</span>
              );
            })()}
          </div>
        )}
      </div>
      {editId !== task.id && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => { setEditId(task.id); setEditTitle(task.title); setEditDue(task.due_date?.slice(0, 10) ?? ''); }}
            style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: '0.8rem', cursor: 'pointer', padding: '2px 4px' }}
            title={language === 'he' ? 'ערוך' : 'Edit'}
          >✎</button>
          <button
            onClick={() => handleDelete(task.id)}
            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', padding: '2px 4px' }}
            title={language === 'he' ? 'מחק' : 'Delete'}
          >✕</button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, direction: 'rtl', minHeight: 0, overflowY: 'auto' }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${C.borderFaint}`,
        background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, color: C.purple, fontSize: '0.95rem' }}>
          📋 {language === 'he' ? 'לוח משימות' : 'Task Board'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setSortMode(m => m === 'date' ? 'module' : 'date')}
            style={{
              padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.border}`,
              background: '#fff', color: C.purple, fontSize: '0.75rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {sortMode === 'date'
              ? (language === 'he' ? '📅 מיון: תאריך' : '📅 Sort: Date')
              : (language === 'he' ? '🗂 קיבוץ: מודול' : '🗂 Group: Module')}
          </button>
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: '5px 12px', borderRadius: 7, border: 'none',
              background: C.purple, color: '#fff', fontSize: '0.75rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + {language === 'he' ? 'הוסף' : 'Add'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
        {/* Add task form */}
        {adding && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <input
              autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              placeholder={language === 'he' ? 'תיאור המשימה...' : 'Task description...'}
              style={{
                flex: 1, minWidth: 200, background: '#fff', border: `1px solid ${C.border}`,
                borderRadius: 7, padding: '7px 12px', color: C.text, fontSize: '0.88rem',
                fontFamily: 'inherit', outline: 'none', direction: 'rtl',
              }}
            />
            <input
              type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              style={{
                background: '#fff', border: `1px solid ${C.border}`,
                borderRadius: 7, padding: '7px 12px', color: C.textMuted, fontSize: '0.85rem',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button onClick={handleAdd} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: C.purple, color: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
              {language === 'he' ? 'שמור' : 'Save'}
            </button>
            <button onClick={() => setAdding(false)} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        )}

        {loading && (
          <div style={{ color: C.textMuted, fontSize: '0.85rem', textAlign: 'center', paddingTop: 40 }}>
            {language === 'he' ? 'טוען...' : 'Loading...'}
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div style={{ color: C.textMuted, fontSize: '0.88rem', textAlign: 'center', paddingTop: 60, lineHeight: 1.8 }}>
            {language === 'he' ? 'אין משימות עדיין.\nהשתמש בכפתור ✨ הצע משימות AI בסרגל הצד כדי להתחיל.' : 'No tasks yet.\nUse the ✨ AI Suggest button in the sidebar to get started.'}
          </div>
        )}

        {/* Pending tasks */}
        {sortMode === 'date' ? (
          groups[0]?.tasks.map(t => taskRow(t, true))
        ) : (
          groups.map(group => (
            <div key={group.key} style={{ marginBottom: 20 }}>
              <div style={{
                color: C.purple, fontWeight: 700, fontSize: '0.8rem',
                padding: '4px 0 8px', borderBottom: `1px solid ${C.borderFaint}`, marginBottom: 8,
              }}>
                {group.label} <span style={{ fontWeight: 400, color: C.textMuted }}>({group.tasks.length})</span>
              </div>
              {group.tasks.map(t => taskRow(t, false))}
            </div>
          ))
        )}

        {/* Done tasks */}
        {done.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setDoneOpen(o => !o)}
              style={{
                background: 'none', border: 'none', color: C.textMuted,
                fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
                padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {doneOpen ? '▾' : '▸'} {language === 'he' ? `הושלמו (${done.length})` : `Done (${done.length})`}
            </button>
            {doneOpen && done.map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, marginBottom: 3, opacity: 0.6 }}>
                <input
                  type="checkbox" checked={true} onChange={() => handleToggle(task)}
                  style={{ cursor: 'pointer', accentColor: C.green, flexShrink: 0 }}
                />
                <span style={{ color: C.textMuted, fontSize: '0.85rem', textDecoration: 'line-through', flex: 1 }}>{task.title}</span>
                {task.due_date && <span style={{ color: C.textMuted, fontSize: '0.73rem' }}>📅 {task.due_date.slice(0, 10)}</span>}
                <button onClick={() => handleDelete(task.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', padding: '0 4px' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Streaming chat ───────────────────────────────────────────────────────────
function ResearchChat({
  moduleId,
  projectId,
  projectTitle,
  initialMessages,
  onMessagesChange,
  language,
  onLanguageChange,
  gender,
  onGenderChange,
  deferredQuestions = [],
}: {
  moduleId: ModuleId;
  projectId: number;
  projectTitle: string;
  initialMessages: ChatMessage[];
  onMessagesChange: (msgs: ChatMessage[]) => void;
  language: 'he' | 'en';
  onLanguageChange: (l: 'he' | 'en') => void;
  gender: 'm' | 'f';
  onGenderChange: (g: 'm' | 'f') => void;
  deferredQuestions: DeferredQuestion[];
}) {
  const [messages, setMessages]   = useState<ChatMessage[]>(initialMessages);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError]         = useState('');
  const [exporting, setExporting] = useState<'docx' | 'xlsx' | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  const meta = MODULE_META[moduleId];

  // Sync messages when initialMessages change (module switch)
  useEffect(() => {
    setMessages(initialMessages);
    setError('');
  }, [initialMessages]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = useCallback(async (role: string, content: string) => {
    if (!projectId) return;
    try {
      await fetch('/api/research/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, module_id: moduleId, role, content }),
      });
    } catch { /* ignore */ }
  }, [projectId, moduleId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setError('');

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    onMessagesChange(nextMessages);
    setInput('');
    setStreaming(true);

    await saveMessage('user', text.trim());

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const abort = new AbortController();
    abortRef.current = abort;

    let assistantContent = '';

    try {
      const res = await fetch('/api/research/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({ projectId, moduleId, messages: nextMessages, language, gender }),
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
              assistantContent += chunk.text;
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

      // Save assistant reply to DB
      if (assistantContent) {
        await saveMessage('assistant', assistantContent);
        const finalMsgs = [...nextMessages, { role: 'assistant' as const, content: assistantContent }];
        onMessagesChange(finalMsgs);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setMessages(prev => prev.filter((_, i) => i < prev.length - 1));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, moduleId, language, streaming, saveMessage, onMessagesChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleExportTxt = () => {
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

  const handleExportProtocol = async (format: 'docx' | 'xlsx') => {
    if (!messages.length || exporting) return;
    setExporting(format);
    setError('');
    try {
      const res = await fetch('/api/research/export-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, format }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'שגיאת ייצוא');
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const ext  = format === 'docx' ? 'docx' : 'xlsx';
      a.href = url; a.download = `protocol-${Date.now()}.${ext}`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, direction: language === 'he' ? 'rtl' : 'ltr' }}>
      {/* Toolbar */}
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
          <button
            onClick={() => onLanguageChange(language === 'he' ? 'en' : 'he')}
            style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {language === 'he' ? '🇮🇱 עברית' : '🇺🇸 English'}
          </button>
          {language === 'he' && (
            <button
              onClick={() => onGenderChange(gender === 'm' ? 'f' : 'm')}
              style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {gender === 'm' ? 'זכר' : 'נקבה'}
            </button>
          )}
          <button
            onClick={() => { setMessages([]); onMessagesChange([]); }}
            disabled={!messages.length}
            style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: '0.75rem', cursor: messages.length ? 'pointer' : 'default', opacity: messages.length ? 1 : 0.4, fontFamily: 'inherit' }}
          >
            נקה
          </button>
          <button
            onClick={handleExportTxt}
            disabled={!messages.length}
            style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: '0.75rem', cursor: messages.length ? 'pointer' : 'default', opacity: messages.length ? 1 : 0.4, fontFamily: 'inherit' }}
          >
            📄 ייצוא
          </button>
          {moduleId === 'protocol' && (<>
            <button
              onClick={() => handleExportProtocol('docx')}
              disabled={!messages.length || !!exporting}
              style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: exporting === 'docx' ? 'rgba(75,46,106,0.12)' : 'none', color: C.purple, fontSize: '0.75rem', cursor: messages.length && !exporting ? 'pointer' : 'default', opacity: messages.length && !exporting ? 1 : 0.45, fontFamily: 'inherit', fontWeight: 600 }}
            >
              {exporting === 'docx' ? '⏳ מכין...' : '📝 Word'}
            </button>
            <button
              onClick={() => handleExportProtocol('xlsx')}
              disabled={!messages.length || !!exporting}
              style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: exporting === 'xlsx' ? 'rgba(75,46,106,0.12)' : 'none', color: C.green, fontSize: '0.75rem', cursor: messages.length && !exporting ? 'pointer' : 'default', opacity: messages.length && !exporting ? 1 : 0.45, fontFamily: 'inherit', fontWeight: 600 }}
            >
              {exporting === 'xlsx' ? '⏳ מכין...' : '📊 Excel'}
            </button>
          </>)}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: C.textMuted }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{meta.icon}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>
              {language === 'he' ? meta.labelHe : meta.label}
            </div>
            <div style={{ fontSize: '0.82rem', maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>{meta.description}</div>

            {/* Show deferred questions as primary starters if available */}
            {deferredQuestions.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: '0.75rem', color: C.purple, fontWeight: 600, marginBottom: 10 }}>
                  {language === 'he' ? '📬 שאלות ממודולים אחרים:' : '📬 Questions from other modules:'}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {deferredQuestions.map((q) => {
                    const sourceMeta = MODULE_META[q.source_module as ModuleId];
                    return (
                      <button
                        key={q.id}
                        onClick={() => sendMessage(q.question)}
                        style={{
                          padding: '10px 14px', borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: 'rgba(75,46,106,0.08)', color: C.purple,
                          fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
                          maxWidth: 280, textAlign: 'start', lineHeight: 1.5,
                          direction: language === 'he' ? 'rtl' : 'ltr',
                        }}
                      >
                        <span style={{ fontSize: '0.68rem', color: C.textMuted, display: 'block', marginBottom: 4 }}>
                          {sourceMeta?.icon} {language === 'he' ? sourceMeta?.labelHe : sourceMeta?.label}
                        </span>
                        {q.question}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Default starters when no deferred questions */}
            {deferredQuestions.length === 0 && (
              <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {getStarterPrompts(moduleId, language).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'rgba(75,46,106,0.06)', color: C.purple, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', maxWidth: 220, textAlign: 'center', lineHeight: 1.4 }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
            <div style={{
              maxWidth: '78%', padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
              background: msg.role === 'user' ? '#f3f4f6' : 'rgba(75,46,106,0.08)',
              border: `1px solid ${msg.role === 'user' ? C.borderFaint : C.border}`,
              color: C.text, fontSize: '0.875rem', lineHeight: 1.7,
              whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
              wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
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

      {/* Input */}
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
              flex: 1, resize: 'none', background: '#f8f9fa',
              border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px',
              color: C.text, fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
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

      <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </div>
  );
}

function getStarterPrompts(moduleId: ModuleId, language: 'he' | 'en'): string[] {
  const he: Record<ModuleId, string[]> = {
    'ideation':      ['שמתי לב לדפוס קליני מעניין בחולות עם סוכרת הריון', 'אני רוצה לחקור גורמי סיכון ל-PPH', 'יש לי רעיון למחקר על לידה מכשירנית'],
    'data-explorer': ['אילו משתנים קיימים בנושא מצג עכוז?', 'האם יש נתוני Apgar בבסיס הנתונים?', 'חפש משתנים הקשורים ל-GDM'],
    'lit-search':    ['בנה מחרוזת PubMed לנושא VBAC ו-BMI', 'סנן עבורי רשימת תקצירים', 'מה ידוע על ניבוי PPH?'],
    'stats':         ['מה הבדיקה המתאימה להשוואת שתי קבוצות?', 'עזור לי לחשב גודל מדגם למחקר', 'צור תכנית ניתוח סטטיסטי ל-IRB'],
    'protocol':      ['כתוב פרוטוקול למחקר רטרוספקטיבי — אדביק פלטים מהמודולים הקודמים', 'כתוב פרוטוקול RCT מלא', 'מה המבנה הנכון לפרוטוקול IRB בהדסה?'],
    'manuscript':    ['כתוב תקציר מובנה למחקר הקוהורט שלי', 'עזור לי לכתוב את סעיף השיטות', 'ניסחתי תגובה למבקרים — ערוך אותה'],
    'schedule':      ['צור לוח זמנים למחקר על לידה מוקדמת', 'אני בשלב הגשה ל-IRB — מה הצעדים הבאים?', 'עדכן את לוח הזמנים שלי'],
  };
  const en: Record<ModuleId, string[]> = {
    'ideation':      ['I noticed a pattern in GDM patients I want to investigate', 'I want to study risk factors for PPH', 'I have an idea for an instrumental delivery study'],
    'data-explorer': ['What variables are available for breech presentation?', 'Is Apgar score data available?', 'Search for GDM-related variables'],
    'lit-search':    ['Build a PubMed search string for VBAC and BMI', 'Help me screen a list of abstracts', 'What is known about PPH prediction?'],
    'stats':         ['What test should I use to compare two groups?', 'Help me calculate sample size for my study', 'Generate a statistical analysis plan for IRB'],
    'protocol':      ['Write a retrospective study protocol — I will paste outputs from previous modules', 'Write a full RCT protocol', 'What is the correct structure for a Hadassah IRB protocol?'],
    'manuscript':    ['Write a structured abstract for my cohort study', 'Help me write the Methods section', 'Edit my response to reviewers'],
    'schedule':      ['Create a timeline for a preterm labor study', "I'm at IRB submission — what are the next steps?", 'Update my research schedule'],
  };
  return (language === 'he' ? he : en)[moduleId] ?? [];
}

// ─── Main workspace ────────────────────────────────────────────────────────────
export default function ResearchWorkspace({ projectId }: { projectId: number }) {
  const [activeModule, setActiveModule]   = useState<ModuleId>('ideation');
  const [project, setProject]             = useState<Project | null>(null);
  const [touchedModules, setTouchedModules] = useState<Set<string>>(new Set());
  const [language, setLanguage]           = useState<'he' | 'en'>('he');
  const [gender, setGender]               = useState<'m' | 'f'>('m');

  // Per-module message cache
  const [moduleMessages, setModuleMessages] = useState<Partial<Record<ModuleId, ChatMessage[]>>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Brief & deferred questions
  const [briefSections, setBriefSections] = useState<BriefSection[]>([]);
  const [allDeferredQuestions, setAllDeferredQuestions] = useState<DeferredQuestion[]>([]);
  const [briefPanelCollapsed, setBriefPanelCollapsed] = useState(true);
  const lastIntegratedBriefHash = useRef<string>('');
  const hasUserInteracted = useRef(false);

  // Load project info
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/research/projects');
        const data = await res.json() as { projects?: Project[] };
        if (data.projects) {
          const found = data.projects.find(p => p.id === projectId);
          if (found) setProject(found);
        }
      } catch { /* ignore */ }
    })();
  }, [projectId]);

  // Load touched modules
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/research/module-touches?project_id=${projectId}`);
        const data = await res.json() as { touches?: { module_id: string }[] };
        if (data.touches) {
          setTouchedModules(new Set(data.touches.map(t => t.module_id)));
        }
      } catch { /* ignore */ }
    })();
  }, [projectId]);

  // Load brief sections
  const fetchBrief = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/brief?project_id=${projectId}`);
      const data = await res.json() as { sections?: BriefSection[] };
      if (data.sections) setBriefSections(data.sections);
    } catch { /* ignore */ }
  }, [projectId]);

  // Load all deferred questions
  const fetchDeferredQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/deferred-questions?project_id=${projectId}&status=pending`);
      const data = await res.json() as { questions?: DeferredQuestion[] };
      if (data.questions) setAllDeferredQuestions(data.questions);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { fetchBrief(); }, [fetchBrief, activeModule]);
  useEffect(() => { fetchDeferredQuestions(); }, [fetchDeferredQuestions, activeModule]);

  // Run integrator on module switch (only if brief changed since last run)
  useEffect(() => {
    if (briefSections.length === 0) return;
    if (!hasUserInteracted.current) return;
    const briefHash = JSON.stringify(briefSections);
    if (briefHash === lastIntegratedBriefHash.current) return;
    lastIntegratedBriefHash.current = briefHash;
    (async () => {
      try {
        const res = await fetch('/api/research/integrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, targetModuleId: activeModule }),
        });
        const data = await res.json() as { questions?: DeferredQuestion[] };
        if (data.questions && data.questions.length > 0) {
          fetchDeferredQuestions();
        }
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, projectId, briefSections]);

  // Compute per-module deferred question counts
  const deferredCounts: Record<string, number> = {};
  for (const q of allDeferredQuestions) {
    deferredCounts[q.target_module] = (deferredCounts[q.target_module] || 0) + 1;
  }

  const currentModuleQuestions = allDeferredQuestions.filter(q => q.target_module === activeModule);

  // Load messages for current module
  useEffect(() => {
    if (moduleMessages[activeModule] !== undefined) return; // already cached
    (async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/research/messages?project_id=${projectId}&module_id=${activeModule}`);
        const data = await res.json() as { messages?: DbMessage[] };
        if (data.messages) {
          const msgs: ChatMessage[] = data.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
          setModuleMessages(prev => ({ ...prev, [activeModule]: msgs }));
        } else {
          setModuleMessages(prev => ({ ...prev, [activeModule]: [] }));
        }
      } catch {
        setModuleMessages(prev => ({ ...prev, [activeModule]: [] }));
      }
      setLoadingMessages(false);
    })();
  }, [activeModule, projectId, moduleMessages]);

  const handleModuleChange = (m: ModuleId) => {
    setActiveModule(m);
  };

  const handleMessagesChange = (msgs: ChatMessage[]) => {
    hasUserInteracted.current = true;
    setModuleMessages(prev => ({ ...prev, [activeModule]: msgs }));
    setTouchedModules(prev => new Set([...prev, activeModule]));
    fetchBrief();
    fetchDeferredQuestions();
  };


  const currentMessages = moduleMessages[activeModule] ?? [];

  return (
    <div style={{
      height: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      direction: 'rtl',
    }}>
      {/* Back to dashboard */}
      <div style={{
        padding: '6px 16px', background: C.panel,
        borderBottom: `1px solid ${C.borderFaint}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link
          href="/tools/research"
          style={{ color: C.textMuted, fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← לוח מחקר
        </Link>
        {project && (
          <>
            <span style={{ color: C.borderFaint }}>|</span>
            <span style={{ color: C.text, fontSize: '0.82rem', fontWeight: 600 }}>{project.title}</span>
          </>
        )}
      </div>

      {/* Module tabs */}
      <ModuleTabs active={activeModule} onChange={handleModuleChange} touchedModules={touchedModules} deferredCounts={deferredCounts} language={language} />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {activeModule === 'schedule' ? (
          <TaskManagerPanel projectId={projectId} language={language} />
        ) : loadingMessages ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: '0.85rem' }}>
            טוען...
          </div>
        ) : (
          <ResearchChat
            key={`${projectId}-${activeModule}`}
            moduleId={activeModule}
            projectId={projectId}
            projectTitle={project?.title ?? ''}
            initialMessages={currentMessages}
            onMessagesChange={handleMessagesChange}
            language={language}
            onLanguageChange={setLanguage}
            gender={gender}
            onGenderChange={setGender}
            deferredQuestions={currentModuleQuestions}
          />
        )}

        {/* Task sidebar — module-filtered, hidden in schedule view */}
        {activeModule !== 'schedule' && (
          <TaskSidebar
            projectId={projectId}
            language={language}
            activeModule={activeModule}
            moduleMessages={currentMessages}
          />
        )}

        {/* Research brief panel */}
        <BriefPanel
          sections={briefSections}
          collapsed={briefPanelCollapsed}
          onToggle={() => setBriefPanelCollapsed(prev => !prev)}
          language={language}
        />
      </div>
    </div>
  );
}
