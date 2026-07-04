'use client';

import { useSimTheme } from './SimThemeProvider';

interface Props {
  currentCard: number;
  totalCards: number;
  isRunning: boolean;
  isMuted: boolean;
  isRecording: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onStop: () => void;
  onEndSim: () => void;
  onToggleMute: () => void;
  onToggleRecord: () => void;
  onOpenOverride: () => void;
  onOpenLabsPush?: () => void;
  onAddNote: () => void;
}

export default function InstructorControls({
  currentCard,
  totalCards,
  isRunning,
  isMuted,
  isRecording,
  onPrev,
  onNext,
  onStart,
  onStop,
  onEndSim,
  onToggleMute,
  onToggleRecord,
  onOpenOverride,
  onOpenLabsPush,
  onAddNote,
}: Props) {
  const { theme } = useSimTheme();

  const btnBase: React.CSSProperties = {
    border: `1px solid ${theme.borderSoft}`,
    borderRadius: 8,
    background: theme.accentSoft,
    color: theme.text,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const iconBtn: React.CSSProperties = {
    ...btnBase,
    padding: '9px 15px',
    fontSize: '0.95rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };

  return (
    <div
      dir="rtl"
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Card navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={onPrev}
          disabled={currentCard <= 1}
          style={{
            ...btnBase,
            padding: '8px 15px',
            fontSize: '0.95rem',
            fontWeight: 600,
            opacity: currentCard <= 1 ? 0.35 : 1,
            cursor: currentCard <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          ◀ הקודם
        </button>

        <span
          style={{
            color: theme.label,
            fontWeight: 700,
            fontSize: '1.05rem',
            minWidth: '7ch',
            textAlign: 'center',
          }}
        >
          כרטיס {currentCard}/{totalCards}
        </span>

        <button
          onClick={onNext}
          disabled={currentCard >= totalCards}
          style={{
            ...btnBase,
            padding: '8px 15px',
            fontSize: '0.95rem',
            fontWeight: 600,
            opacity: currentCard >= totalCards ? 0.35 : 1,
            cursor: currentCard >= totalCards ? 'not-allowed' : 'pointer',
          }}
        >
          הבא ▶
        </button>
      </div>

      {/* Start / Stop */}
      <button
        onClick={isRunning ? onStop : onStart}
        style={{
          ...btnBase,
          background: isRunning
            ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
            : 'linear-gradient(135deg, #16a34a, #15803d)',
          border: 'none',
          borderRadius: 8,
          padding: '11px 20px',
          fontSize: '1.05rem',
          fontWeight: 700,
          color: '#fff',
          width: '100%',
          justifyContent: 'center',
          letterSpacing: '0.03em',
        }}
      >
        {isRunning ? '⏸ עצור' : '▶ התחל סימולציה'}
      </button>

      {/* Icon action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onOpenOverride} style={iconBtn} title="שנה מדדים וניטור">
          ⚡ שנה מדדים וניטור
        </button>

        {onOpenLabsPush && (
          <button onClick={onOpenLabsPush} style={iconBtn} title="שלח תוצאות מעבדה חדשות לכל המסכים">
            🧪 מעבדה
          </button>
        )}

        <button onClick={onAddNote} style={iconBtn} title="הוסף הערה">
          📝 הערה
        </button>

        <button
          onClick={onToggleRecord}
          style={{
            ...iconBtn,
            background: isRecording ? 'rgba(239,68,68,0.15)' : iconBtn.background,
            border: isRecording ? '1px solid rgba(239,68,68,0.5)' : iconBtn.border,
            color: isRecording ? '#ef4444' : iconBtn.color,
          }}
          title={isRecording ? 'עצור הקלטה' : 'הקלט'}
        >
          {isRecording ? '⏺ מקליט' : '🔴 הקלט'}
        </button>

        <button
          onClick={onToggleMute}
          style={{
            ...iconBtn,
            background: isMuted ? 'rgba(234,179,8,0.15)' : iconBtn.background,
            border: isMuted ? '1px solid rgba(234,179,8,0.5)' : iconBtn.border,
            color: isMuted ? '#b45309' : iconBtn.color,
          }}
          title={isMuted ? 'בטל השתקה' : 'השתק'}
        >
          {isMuted ? '🔇 מושתק' : '🔊 קול'}
        </button>
      </div>

      {/* End simulation */}
      {isRunning && (
        <button
          onClick={onEndSim}
          style={{
            ...btnBase,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.45)',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: '#dc2626',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          ⏹ סיום סימולציה
        </button>
      )}
    </div>
  );
}
