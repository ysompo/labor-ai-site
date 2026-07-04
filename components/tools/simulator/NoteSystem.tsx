'use client';

import { useState, useEffect } from 'react';
import { useSimTheme } from './SimThemeProvider';

export interface NoteEntry {
  id: string;
  simTime: number;
  author: string;
  content: string;
  tagType?: string;
  isQuickTag: boolean;
}

interface Props {
  role: 'instructor' | 'midwife_supervisor';
  simTimeSeconds: number;
  isRunning: boolean;
  notes: NoteEntry[];
  notepadContent: string;
  onAddNote: (note: Omit<NoteEntry, 'id'>) => void;
  onNotepadChange: (content: string) => void;
  openFormTrigger?: number; // increment to open the form from outside
}

function formatSimTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const INSTRUCTOR_QUICK_TAGS = [
  { tag: 'missed_sign',    label: '⚠️ פספס סימן' },
  { tag: 'delay',          label: '⏱ עיכוב' },
  { tag: 'quick_id',       label: '✅ זיהוי מהיר' },
  { tag: 'announcement',   label: '📢 הכרזה' },
  { tag: 'no_read',        label: '🔇 לא קרא' },
  { tag: 'communication',  label: '💬 תקשורת' },
];

const MIDWIFE_QUICK_TAGS = [
  { tag: 'drug_knowledge', label: '💊 ידע תרופתי' },
  { tag: 'not_familiar',   label: '❌ לא הכירה' },
  { tag: 'equipment',      label: '✅ ציוד' },
  { tag: 'report',         label: '📢 דיווח' },
];

export default function NoteSystem({
  role,
  simTimeSeconds,
  isRunning,
  notes,
  notepadContent,
  onAddNote,
  onNotepadChange,
  openFormTrigger,
}: Props) {
  const { theme } = useSimTheme();
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openFormTrigger) setIsFormOpen(true);
  }, [openFormTrigger]);
  const [noteText, setNoteText] = useState('');

  const quickTags = role === 'instructor' ? INSTRUCTOR_QUICK_TAGS : MIDWIFE_QUICK_TAGS;

  const handleAddTextNote = () => {
    if (!noteText.trim()) return;
    onAddNote({
      simTime: simTimeSeconds,
      author: role === 'instructor' ? 'מ' : 'א',
      content: noteText.trim(),
      isQuickTag: false,
    });
    setNoteText('');
    setIsFormOpen(false);
  };

  const handleQuickTag = (tag: string, label: string) => {
    onAddNote({
      simTime: simTimeSeconds,
      author: role === 'instructor' ? 'מ' : 'א',
      content: label,
      tagType: tag,
      isQuickTag: true,
    });
  };

  const sortedNotes = [...notes].sort((a, b) => b.simTime - a.simTime);

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Timestamped Notes ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px 6px',
            borderBottom: `1px solid ${theme.borderSoft}`,
            flexShrink: 0,
          }}
        >
          <span style={{ color: theme.label, fontSize: '0.78rem', fontWeight: 700 }}>
            הערות מתויגות
          </span>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            style={{
              background: theme.chipBg,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 6,
              color: theme.text,
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 10px',
              fontFamily: 'inherit',
            }}
          >
            📝 הוסף הערה
          </button>
        </div>

        {/* Inline add-note form */}
        {isFormOpen && (
          <div
            style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${theme.borderSoft}`,
              background: theme.accentSoft,
              flexShrink: 0,
            }}
          >
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="הכנס הערה..."
              rows={2}
              dir="rtl"
              style={{
                width: '100%',
                background: theme.inputBg,
                border: `1px solid ${theme.borderSoft}`,
                borderRadius: 6,
                color: theme.textHi,
                fontSize: '0.8rem',
                padding: '6px 8px',
                resize: 'none',
                fontFamily: 'inherit',
                marginBottom: 8,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                onClick={handleAddTextNote}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '5px 14px',
                  fontFamily: 'inherit',
                }}
              >
                שמור
              </button>
              <button
                onClick={() => { setIsFormOpen(false); setNoteText(''); }}
                style={{
                  background: theme.inputBg,
                  border: '1px solid rgba(156,163,175,0.25)',
                  borderRadius: 6,
                  color: theme.textDim,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: '5px 10px',
                  fontFamily: 'inherit',
                }}
              >
                ביטול
              </button>
            </div>
            {/* Quick tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {quickTags.map(({ tag, label }) => (
                <button
                  key={tag}
                  onClick={() => { handleQuickTag(tag, label); setIsFormOpen(false); }}
                  style={{
                    background: theme.chipBg,
                    border: `1px solid ${theme.borderSoft}`,
                    borderRadius: 20,
                    color: theme.lilac,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {sortedNotes.length === 0 ? (
            <div style={{ color: theme.textDim, fontSize: '0.75rem', textAlign: 'center', padding: '16px 12px' }}>
              אין הערות עדיין
            </div>
          ) : (
            sortedNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '6px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    background: theme.chipBg,
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: theme.label,
                    flexShrink: 0,
                  }}
                >
                  {note.author}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: note.isQuickTag ? '#c4b5fd' : '#e2e8f0',
                      fontSize: '0.78rem',
                      wordBreak: 'break-word',
                    }}
                  >
                    {note.content}
                  </div>
                  <div style={{ color: theme.textDim, fontSize: '0.65rem', marginTop: 2, fontFamily: 'monospace' }}>
                    {formatSimTime(note.simTime)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Notepad ── */}
      <div
        style={{
          flexShrink: 0,
          borderTop: `1px solid ${theme.borderSoft}`,
          padding: '8px 12px',
        }}
      >
        <div style={{ color: theme.textDim, fontSize: '0.7rem', marginBottom: 4 }}>
          פנקס
        </div>
        <textarea
          value={notepadContent}
          onChange={(e) => onNotepadChange(e.target.value)}
          placeholder="רשומות חופשיות..."
          rows={3}
          dir="rtl"
          style={{
            width: '100%',
            background: theme.surface,
            border: `1px solid ${theme.borderSoft}`,
            borderRadius: 6,
            color: theme.text,
            fontSize: '0.78rem',
            padding: '6px 8px',
            resize: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}
