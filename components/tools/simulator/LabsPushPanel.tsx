'use client';

import { useEffect, useState } from 'react';
import type { CardLabs, PushedLabRow } from '@/lib/simulatorTypes';
import LabFieldsEditor from '@/components/tools/simulator/LabFieldsEditor';
import { useSimTheme } from '@/components/tools/simulator/SimThemeProvider';

// Live labs push — instructor edits lab values mid-simulation and sends them
// as a new timestamped row to all trainee screens.

interface Props {
  isOpen: boolean;
  baseLabs: CardLabs;
  baseAbnormal: string[];
  simTimeSeconds: number;
  onPush: (row: PushedLabRow) => void;
  onClose: () => void;
}

export default function LabsPushPanel({ isOpen, baseLabs, baseAbnormal, simTimeSeconds, onPush, onClose }: Props) {
  const { theme } = useSimTheme();
  const [labs, setLabs] = useState<CardLabs>({});
  const [abnormal, setAbnormal] = useState<string[]>([]);
  const [material, setMaterial] = useState<'דם' | 'שתן'>('דם');
  // Re-key the editor so its manual-override state resets on every open
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setLabs(JSON.parse(JSON.stringify(baseLabs ?? {})));
    setAbnormal([...(baseAbnormal ?? [])]);
    setMaterial('דם');
    setEditorKey(k => k + 1);
    // Prefill only when the panel opens — not on every parent re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePush = () => {
    const now = new Date();
    const row: PushedLabRow = {
      id: `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
      sim_time_seconds: simTimeSeconds,
      material,
      labs,
      abnormal_fields: abnormal,
    };
    onPush(row);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: theme.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          background: theme.surfaceRaised,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          width: '100%', maxWidth: 840,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.borderSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: theme.lilac, fontWeight: 700, fontSize: '1.05rem' }}>
              🧪 שליחת תוצאות מעבדה
            </div>
            <div style={{ color: theme.textDim, fontSize: '0.85rem', marginTop: 2 }}>
              הערכים מולאו מראש מהתוצאות האחרונות — ערכו ושלחו לכל המסכים
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}
          >✕</button>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <LabFieldsEditor
            key={editorKey}
            labs={labs}
            abnormalFields={abnormal}
            onChange={(l, a) => { setLabs(l); setAbnormal(a); }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${theme.borderSoft}`,
          display: 'flex', gap: 10, alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: theme.textDim, fontSize: '0.85rem' }}>חומר:</span>
            {(['דם', 'שתן'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMaterial(m)}
                style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: '0.88rem',
                  border: material === m ? `1.5px solid ${theme.accent}` : `1px solid ${theme.borderSoft}`,
                  background: material === m ? theme.chipBg : 'transparent',
                  color: material === m ? theme.lilac : theme.textDim,
                  fontWeight: material === m ? 700 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={handlePush}
            style={{
              padding: '12px 28px', borderRadius: 10,
              border: 'none',
              background: `linear-gradient(135deg, ${theme.brand}, ${theme.accent})`,
              color: '#fff', fontSize: '1.05rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🧪 שלח תוצאות למסכים
          </button>
        </div>
      </div>
    </div>
  );
}
