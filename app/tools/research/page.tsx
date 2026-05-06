'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MODULE_META } from '@/lib/research/types';
import type { ModuleId, Project } from '@/lib/research/types';

// Colors
const C = {
  bg:          '#f8f9fa',
  purple:      '#4B2E6A',
  purpleLight: 'rgba(75,46,106,0.08)',
  border:      'rgba(75,46,106,0.12)',
  text:        '#1a1a2e',
  textMuted:   '#6b7280',
  green:       '#16a34a',
  amber:       '#d97706',
  blue:        '#2563eb',
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: 'טיוטה',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  active:         { label: 'פעיל',         color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  'irb-submitted':{ label: 'הוגש ל-IRB', color: '#d97706', bg: 'rgba(217,119,6,0.08)'  },
  completed:      { label: 'הושלם',       color: '#16a34a', bg: 'rgba(22,163,74,0.08)'  },
  archived:       { label: 'ארכיון',      color: '#9ca3af', bg: 'rgba(156,163,175,0.08)'},
};

const MODULE_ORDER: ModuleId[] = [
  'ideation', 'data-explorer', 'lit-search', 'stats', 'protocol', 'manuscript', 'schedule',
];

interface DashboardProject extends Project {
  touches: string[];
  pending_tasks: number;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

function ModuleStrip({ touches }: { touches: string[] }) {
  const touchSet = new Set(touches);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {MODULE_ORDER.map(id => {
        const meta = MODULE_META[id];
        const touched = touchSet.has(id);
        return (
          <div
            key={id}
            title={meta.labelHe}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{
              fontSize: '0.9rem',
              opacity: touched ? 1 : 0.3,
              filter: touched ? 'none' : 'grayscale(1)',
            }}>
              {meta.icon}
            </span>
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: touched ? C.purple : 'transparent',
            }} />
          </div>
        );
      })}
    </div>
  );
}

function NewProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string) => Promise<void>;
}) {
  const [title, setTitle]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onCreate(title.trim());
    setTitle('');
    setLoading(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        direction: 'rtl',
      }}>
        <h2 style={{ margin: '0 0 20px', color: C.purple, fontSize: '1.1rem', fontWeight: 700 }}>
          פרויקט מחקר חדש
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: C.textMuted, fontSize: '0.78rem', display: 'block', marginBottom: 6 }}>
              שם הפרויקט
            </label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="לדוג׳: השפעת GDM על תוצאות לידה..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#f8f9fa', border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '10px 14px',
                color: C.text, fontSize: '0.9rem',
                fontFamily: 'inherit', outline: 'none', direction: 'rtl',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 8,
                border: `1px solid ${C.border}`, background: 'none',
                color: C.textMuted, fontSize: '0.875rem',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: loading || !title.trim() ? '#d1d5db' : `linear-gradient(135deg, #4B2E6A, #7c3aed)`,
                color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                cursor: loading || !title.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'יוצר...' : 'צור פרויקט'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  project,
  onConfirm,
  onCancel,
}: {
  project: DashboardProject;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        direction: 'rtl',
      }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 12 }}>🗑️</div>
        <h2 style={{ margin: '0 0 8px', color: C.text, fontSize: '1rem', fontWeight: 700, textAlign: 'center' }}>
          מחיקת פרויקט
        </h2>
        <p style={{ margin: '0 0 20px', color: C.textMuted, fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.6 }}>
          האם למחוק את <strong style={{ color: C.text }}>&quot;{project.title}&quot;</strong>?<br />
          פעולה זו תמחק את כל השיחות, המשימות והנתונים של הפרויקט ולא ניתן לבטלה.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'none',
              color: C.textMuted, fontSize: '0.875rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: '#ef4444', color: '#fff',
              fontWeight: 700, fontSize: '0.875rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            מחק לצמיתות
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  onDelete,
}: {
  project: DashboardProject;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const status = STATUS_LABELS[project.status] ?? STATUS_LABELS.draft;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '20px 18px',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.15s, transform 0.1s',
        display: 'flex', flexDirection: 'column', gap: 12,
        direction: 'rtl',
        position: 'relative',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(75,46,106,0.12)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Title + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h3 style={{ margin: 0, color: C.text, fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.4, flex: 1 }}>
          {project.title}
        </h3>
        <span style={{
          background: status.bg, color: status.color,
          fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px',
          borderRadius: 6, flexShrink: 0,
        }}>
          {status.label}
        </span>
      </div>

      {/* Module progress strip */}
      <ModuleStrip touches={project.touches} />

      {/* Footer: tasks + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          color: project.pending_tasks > 0 ? C.amber : C.textMuted,
          fontSize: '0.73rem', fontWeight: project.pending_tasks > 0 ? 600 : 400,
        }}>
          {project.pending_tasks > 0
            ? `${project.pending_tasks} משימות פתוחות`
            : 'אין משימות פתוחות'}
        </span>
        <span style={{ color: C.textMuted, fontSize: '0.7rem' }}>
          {formatDate(project.updated_at)}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          style={{
            flex: 1,
            padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.border}`,
            background: C.purpleLight, color: C.purple,
            fontSize: '0.78rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          פתח ←
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: '6px 10px', borderRadius: 7,
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.05)', color: '#ef4444',
            fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
          }}
          title="מחק פרויקט"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default function ResearchDashboard() {
  const router = useRouter();
  const [projects, setProjects]         = useState<DashboardProject[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [username, setUsername]         = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);

  useEffect(() => {
    try {
      const raw = document.cookie.split('; ').find(c => c.startsWith('sim_meta='));
      if (raw) {
        const val = decodeURIComponent(raw.split('=').slice(1).join('='));
        const meta = JSON.parse(val) as { username?: string };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (meta.username) setUsername(meta.username);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/research/dashboard');
        const data = await res.json() as { projects?: DashboardProject[] };
        if (data.projects) setProjects(data.projects);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleDelete = async (project: DashboardProject) => {
    try {
      await fetch(`/api/research/projects/${project.id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch { /* ignore */ }
    setDeleteTarget(null);
  };

  const handleCreate = async (title: string) => {
    try {
      const res = await fetch('/api/research/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = await res.json() as { project?: Project };
      if (data.project) {
        router.push(`/tools/research/${data.project.id}`);
      }
    } catch { /* ignore */ }
  };

  return (
    <div style={{
      minHeight: 'calc(100dvh - 40px)',
      background: C.bg,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: C.text,
      direction: 'rtl',
      padding: '28px 24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: C.purple }}>
            {username ? `שלום, ${username}!` : 'מחקר'} 🔬
          </h1>
          <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: '0.82rem' }}>
            פרויקטי המחקר שלך
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, #4B2E6A, #7c3aed)`,
            color: '#fff', fontWeight: 700, fontSize: '0.875rem',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + פרויקט חדש
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', paddingTop: 60, color: C.textMuted }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: '0.88rem' }}>טוען פרויקטים...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 80, color: C.textMuted }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔬</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>
            עדיין אין פרויקטים — צור את הראשון!
          </div>
          <div style={{ fontSize: '0.85rem', marginBottom: 28, lineHeight: 1.7 }}>
            כל פרויקט מחקר כולל שבעה מודולים: גיבוש רעיון, ניתוח נתונים, ספרות, סטטיסטיקה, פרוטוקול, מאמר ולוח זמנים.
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none',
              background: `linear-gradient(135deg, #4B2E6A, #7c3aed)`,
              color: '#fff', fontSize: '1.8rem',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(75,46,106,0.3)',
            }}
          >
            +
          </button>
        </div>
      )}

      {/* Projects grid */}
      {!loading && projects.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 18,
        }}>
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => router.push(`/tools/research/${p.id}`)}
              onDelete={e => { e.stopPropagation(); setDeleteTarget(p); }}
            />
          ))}
        </div>
      )}

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
