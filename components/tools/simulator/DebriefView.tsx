'use client';

import { useState, useRef } from 'react';
import { useSimTheme } from './SimThemeProvider';

interface TimelineEvent {
  id: string;
  timeSeconds: number;
  type: 'start' | 'card' | 'override' | 'note' | 'end';
  label: string;
  detail?: string;
  color?: string;
}

interface VideoClip {
  id: string;
  deviceRole: string;
  startSeconds: number;
  endSeconds: number;
  blobUrl: string;
}

interface Props {
  sessionName: string;
  sessionDate: string;
  totalDuration: number;
  participants: string[];
  timeline: TimelineEvent[];
  videoClips: VideoClip[];
  notes: Array<{ id: string; simTime: number; author: string; content: string; phase: string }>;
  onAddDebriefNote: (timeSeconds: number, content: string) => void;
  onClose: () => void;
}

const EVENT_COLORS: Record<TimelineEvent['type'], string> = {
  start:    '#22c55e',
  card:     '#3b82f6',
  override: '#eab308',
  note:     '#a78bfa',
  end:      '#ef4444',
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function DebriefView({
  sessionName,
  sessionDate,
  totalDuration,
  participants,
  timeline,
  videoClips,
  notes,
  onAddDebriefNote,
  onClose,
}: Props) {
  const { theme } = useSimTheme();
  const [selectedClipId, setSelectedClipId] = useState<string>(videoClips[0]?.id ?? '');
  const [tooltip, setTooltip] = useState<{ event: TimelineEvent; x: number } | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [debriefNoteText, setDebriefNoteText] = useState('');
  const [showDebriefForm, setShowDebriefForm] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selectedClip = videoClips.find((c) => c.id === selectedClipId);

  const handleTimelineClick = (event: TimelineEvent) => {
    if (videoRef.current && selectedClip) {
      const offsetInClip = event.timeSeconds - selectedClip.startSeconds;
      if (offsetInClip >= 0 && offsetInClip <= selectedClip.endSeconds - selectedClip.startSeconds) {
        videoRef.current.currentTime = offsetInClip;
      }
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && selectedClip) {
      setPlayheadSeconds(selectedClip.startSeconds + videoRef.current.currentTime);
    }
  };

  const handleAddDebriefNote = () => {
    if (!debriefNoteText.trim()) return;
    onAddDebriefNote(playheadSeconds, debriefNoteText.trim());
    setDebriefNoteText('');
    setShowDebriefForm(false);
  };

  const sortedNotes = [...notes].sort((a, b) => a.simTime - b.simTime);

  const playheadPct = totalDuration > 0 ? (playheadSeconds / totalDuration) * 100 : 0;

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        background: theme.bg,
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e0a35, #2d1052)',
          borderBottom: `1px solid ${theme.borderSoft}`,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: theme.textHi, fontSize: '1.1rem', fontWeight: 700 }}>
            דיבריפינג — {sessionName}
          </h2>
          <div style={{ color: theme.textDim, fontSize: '0.78rem', marginTop: 4, display: 'flex', gap: 16 }}>
            <span>{sessionDate}</span>
            <span>משך: {formatTime(totalDuration)}</span>
            {participants.length > 0 && <span>משתתפים: {participants.join(', ')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="/tools/simulator/history"
            style={{
              background: theme.chipBg,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 8,
              color: theme.lilac,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 16px',
              textDecoration: 'none',
            }}
          >
            📋 היסטוריה
          </a>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '8px 20px',
              fontFamily: 'inherit',
            }}
          >
            המשך להערכה ←
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: `1px solid ${theme.borderSoft}`,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div style={{ color: theme.textDim, fontSize: '0.72rem', marginBottom: 8 }}>ציר זמן</div>
        <div
          style={{
            position: 'relative',
            height: 32,
            background: theme.surface,
            borderRadius: 6,
            border: `1px solid ${theme.borderSoft}`,
          }}
        >
          {/* Track bar */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: 2,
              background: theme.chipBg,
              transform: 'translateY(-50%)',
            }}
          />

          {/* Event markers */}
          {timeline.map((ev) => {
            const pct = totalDuration > 0 ? (ev.timeSeconds / totalDuration) * 100 : 0;
            const color = ev.color ?? EVENT_COLORS[ev.type] ?? '#9ca3af';
            return (
              <div
                key={ev.id}
                onClick={() => { handleTimelineClick(ev); setTooltip(tooltip?.event.id === ev.id ? null : { event: ev, x: pct }); }}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid #0d0d1f',
                  cursor: 'pointer',
                  zIndex: 2,
                  boxShadow: `0 0 6px ${color}`,
                }}
                title={ev.label}
              />
            );
          })}

          {/* Playhead */}
          <div
            style={{
              position: 'absolute',
              left: `${playheadPct}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#f1f5f9',
              transform: 'translateX(-50%)',
              zIndex: 3,
            }}
          />
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: `clamp(8px, ${tooltip.x}%, calc(100% - 180px))`,
              background: '#1e1e3a',
              border: `1px solid ${EVENT_COLORS[tooltip.event.type]}`,
              borderRadius: 8,
              padding: '8px 12px',
              zIndex: 10,
              maxWidth: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ color: theme.textHi, fontSize: '0.82rem', fontWeight: 700 }}>{tooltip.event.label}</div>
            {tooltip.event.detail && (
              <div style={{ color: theme.textDim, fontSize: '0.72rem', marginTop: 4 }}>{tooltip.event.detail}</div>
            )}
            <div style={{ color: theme.textDim, fontSize: '0.68rem', marginTop: 4, fontFamily: 'monospace' }}>
              {formatTime(tooltip.event.timeSeconds)}
            </div>
            <button
              onClick={() => setTooltip(null)}
              style={{
                position: 'absolute',
                top: 4,
                left: 6,
                background: 'none',
                border: 'none',
                color: theme.textDim,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'inherit',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── Main content: video + notes ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

        {/* Video panel */}
        <div
          style={{
            flex: '0 0 55%',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: `1px solid ${theme.borderSoft}`,
            overflow: 'hidden',
          }}
        >
          {/* Video player */}
          <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {selectedClip ? (
              <video
                ref={videoRef}
                src={selectedClip.blobUrl}
                controls
                onTimeUpdate={handleVideoTimeUpdate}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ color: theme.textDim, fontSize: '0.9rem' }}>אין הקלטות</div>
            )}
          </div>

          {/* Clip list */}
          {videoClips.length > 0 && (
            <div
              style={{
                flexShrink: 0,
                borderTop: `1px solid ${theme.borderSoft}`,
                padding: '8px 12px',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                background: theme.surface,
              }}
            >
              {videoClips.map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => setSelectedClipId(clip.id)}
                  style={{
                    background: selectedClipId === clip.id ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedClipId === clip.id ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6,
                    color: selectedClipId === clip.id ? '#c4b5fd' : '#9ca3af',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '5px 12px',
                    fontFamily: 'inherit',
                  }}
                >
                  📹 {clip.deviceRole} · {formatTime(clip.startSeconds)}–{formatTime(clip.endSeconds)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 16px',
              borderBottom: `1px solid ${theme.borderSoft}`,
              flexShrink: 0,
            }}
          >
            <span style={{ color: theme.label, fontWeight: 700, fontSize: '0.85rem' }}>הערות</span>
            <button
              onClick={() => setShowDebriefForm(!showDebriefForm)}
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
              + הוסף הערת דיבריפינג
            </button>
          </div>

          {showDebriefForm && (
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${theme.borderSoft}`, flexShrink: 0 }}>
              <div style={{ color: theme.textDim, fontSize: '0.7rem', marginBottom: 4, fontFamily: 'monospace' }}>
                בזמן: {formatTime(Math.floor(playheadSeconds))}
              </div>
              <textarea
                value={debriefNoteText}
                onChange={(e) => setDebriefNoteText(e.target.value)}
                placeholder="הכנס הערת דיבריפינג..."
                rows={3}
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAddDebriefNote}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '6px 16px',
                    fontFamily: 'inherit',
                  }}
                >
                  שמור
                </button>
                <button
                  onClick={() => { setShowDebriefForm(false); setDebriefNoteText(''); }}
                  style={{
                    background: theme.surface,
                    border: '1px solid rgba(156,163,175,0.25)',
                    borderRadius: 6,
                    color: theme.textDim,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    fontFamily: 'inherit',
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
            {sortedNotes.length === 0 ? (
              <div style={{ color: theme.textDim, fontSize: '0.82rem', textAlign: 'center', marginTop: 24 }}>
                אין הערות
              </div>
            ) : (
              sortedNotes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: `1px solid ${theme.borderSoft}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: theme.label, fontSize: '0.72rem', fontWeight: 600 }}>{note.author}</span>
                    <span style={{ color: theme.textDim, fontSize: '0.68rem', fontFamily: 'monospace' }}>
                      {formatTime(note.simTime)}
                    </span>
                  </div>
                  <div style={{ color: theme.text, fontSize: '0.82rem', lineHeight: 1.5 }}>{note.content}</div>
                  {note.phase === 'debrief' && (
                    <div style={{ color: '#4ade80', fontSize: '0.65rem', marginTop: 2 }}>דיבריפינג</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
