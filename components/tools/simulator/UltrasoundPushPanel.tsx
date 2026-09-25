'use client';

import { useSimTheme } from '@/components/tools/simulator/SimThemeProvider';
import type { UltrasoundImage } from '@/lib/simulatorTypes';

// Live ultrasound push — instructor shows any scenario ultrasound image live,
// independent of the active card. Modeled on LabsPushPanel.tsx.

interface Props {
  isOpen: boolean;
  images: UltrasoundImage[];
  activeImageId: string | null;
  onPush: (imageId: string | null) => void;
  onClose: () => void;
}

export default function UltrasoundPushPanel({ isOpen, images, activeImageId, onPush, onClose }: Props) {
  const { theme } = useSimTheme();

  if (!isOpen) return null;

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
          width: '100%', maxWidth: 720,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.borderSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: theme.lilac, fontWeight: 700, fontSize: '1.05rem' }}>
              🩻 שליחת הדמיית אולטרסאונד
            </div>
            <div style={{ color: theme.textDim, fontSize: '0.85rem', marginTop: 2 }}>
              בחרו תמונה לשליחה לכל המסכים, או נקו את התמונה הפעילה
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {images.map(img => {
              const active = img.id === activeImageId;
              return (
                <button
                  key={img.id}
                  onClick={() => { onPush(img.id); onClose(); }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: 8, borderRadius: 10,
                    border: active ? `2px solid ${theme.accent}` : `1px solid ${theme.borderSoft}`,
                    background: active ? theme.chipBg : theme.surface,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.label}
                    style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }}
                  />
                  <span style={{ color: active ? theme.lilac : theme.text, fontSize: '0.85rem', fontWeight: 600 }}>
                    {img.label}{img.type === 'aop' ? ' (AOP)' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${theme.borderSoft}`,
          display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button
            onClick={() => { onPush(null); onClose(); }}
            style={{
              padding: '10px 22px', borderRadius: 10,
              border: `1px solid ${theme.borderSoft}`,
              background: 'rgba(239,68,68,0.10)',
              color: '#dc2626', fontSize: '0.95rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🚫 נקה תמונה פעילה
          </button>
        </div>
      </div>
    </div>
  );
}
