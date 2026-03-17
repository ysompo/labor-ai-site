'use client';

import { useState } from 'react';
import type { LiveOverrideParams, FHRVariability, DecelerationType } from '@/lib/simulatorTypes';

interface Props {
  isOpen: boolean;
  currentFHR: number;
  currentVariability: FHRVariability;
  currentAccelerations: 'present' | 'absent';
  currentDecelerations: DecelerationType;
  currentContractionFreq: number;
  currentBP: { systolic: number; diastolic: number };
  currentSpo2: number;
  onApply: (override: LiveOverrideParams) => void;
  onClose: () => void;
}

const VARIABILITY_OPTIONS: { value: FHRVariability; label: string; sub: string; color: string }[] = [
  { value: 'absent',   label: 'נעדרת',    sub: '<5',    color: '#dc2626' },
  { value: 'minimal',  label: 'מינימלית', sub: '5–10',  color: '#d97706' },
  { value: 'normal',   label: 'תקינה',    sub: '11–25', color: '#16a34a' },
  { value: 'saltatory',label: 'מוגברת',   sub: '>25',   color: '#7c3aed' },
  { value: 'reduced',  label: 'מופחתת',   sub: '',      color: '#f59e0b' },
];

const DECEL_OPTIONS: { value: DecelerationType; label: string; color: string }[] = [
  { value: 'none',              label: 'ללא',             color: '#16a34a' },
  { value: 'early',             label: 'מוקדמות',         color: '#3b82f6' },
  { value: 'variable_mild',     label: 'משתנות קל',       color: '#f59e0b' },
  { value: 'variable_moderate', label: 'משתנות בינוני',   color: '#f97316' },
  { value: 'variable_severe',   label: 'משתנות קשות',     color: '#dc2626' },
  { value: 'late',              label: 'מאוחרות',          color: '#dc2626' },
  { value: 'prolonged',         label: 'ממושכות',          color: '#7f1d1d' },
];

const CONTRACTION_OPTIONS = [
  { label: 'ללא פ"ר',      freq: 0 },
  { label: 'לא סדירה',     freq: 2 },
  { label: 'פ"ר צפופה',    freq: 5 },
  { label: 'טכיסיסטוליה', freq: 6 },
] as const;

export default function LiveOverridePanel({
  isOpen,
  currentFHR,
  currentVariability,
  currentAccelerations,
  currentDecelerations,
  currentContractionFreq,
  currentBP,
  currentSpo2,
  onApply,
  onClose,
}: Props) {
  const [fhr,         setFhr]         = useState(currentFHR);
  const [variability, setVariability] = useState<FHRVariability>(currentVariability);
  const [accels,      setAccels]      = useState<'present' | 'absent'>(currentAccelerations);
  const [decels,      setDecels]      = useState<DecelerationType>(currentDecelerations);
  const [contrFreq,   setContrFreq]   = useState(currentContractionFreq);
  const [bpSystolic,  setBpSystolic]  = useState(currentBP.systolic);
  const [spo2,        setSpo2]        = useState(currentSpo2);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({ fhr_baseline: fhr, fhr_variability: variability, accelerations: accels, decelerations: decels, contraction_frequency: contrFreq, bp_systolic: bpSystolic, spo2 });
    onClose();
  };

  const sectionLabel: React.CSSProperties = {
    color: '#6b7280', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 10, marginTop: 18,
    borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 14,
  };

  const fieldLabel: React.CSSProperties = {
    color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  };

  const sliderStyle: React.CSSProperties = {
    width: '100%', accentColor: '#7c3aed', cursor: 'pointer', marginBottom: 14,
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{ background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 16, padding: '20px 24px', width: '100%', maxWidth: 540, color: '#f1f5f9', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', maxHeight: '90dvh', overflowY: 'auto' }}
      >
        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#a78bfa' }}>⚡ עקיפת ערכים</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem', fontFamily: 'inherit' }}>✕</button>
        </div>

        {/* ── CTG section ──────────────────────────────────── */}
        <div style={sectionLabel}>CTG — ניטור עוברי</div>

        {/* Baseline FHR */}
        <div style={fieldLabel}>
          <span>בסיס FHR</span>
          <span style={{ fontFamily: 'monospace', fontSize: '1rem', color: fhr < 110 ? '#dc2626' : fhr > 160 ? '#f97316' : '#22c55e' }}>
            {fhr} bpm
          </span>
        </div>
        <input type="range" min={60} max={200} step={5} value={fhr} onChange={e => setFhr(Number(e.target.value))} style={sliderStyle} />

        {/* Variability */}
        <div style={{ ...fieldLabel, marginBottom: 10 }}>
          <span>ואריאביליות</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {VARIABILITY_OPTIONS.map(opt => {
            const active = variability === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setVariability(opt.value)}
                style={{
                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '0.78rem', fontWeight: active ? 700 : 500,
                  border: active ? `1.5px solid ${opt.color}` : '1px solid rgba(255,255,255,0.1)',
                  background: active ? `${opt.color}22` : 'rgba(255,255,255,0.04)',
                  color: active ? opt.color : '#9ca3af',
                  flex: '1 0 auto',
                }}
              >
                {opt.label}
                {opt.sub && <span style={{ fontSize: '0.65rem', opacity: 0.75, marginRight: 4 }}>({opt.sub})</span>}
              </button>
            );
          })}
        </div>

        {/* Accelerations */}
        <div style={{ ...fieldLabel, marginBottom: 10 }}>
          <span>האצות (Accelerations)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['present', 'absent'] as const).map(val => {
            const active = accels === val;
            const color  = val === 'present' ? '#16a34a' : '#dc2626';
            const label  = val === 'present' ? '✓ קיימות' : '✗ נעדרות';
            return (
              <button
                key={val}
                onClick={() => setAccels(val)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '0.85rem', fontWeight: 700,
                  border: active ? `1.5px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
                  background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                  color: active ? color : '#6b7280',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Decelerations */}
        <div style={{ ...fieldLabel, marginBottom: 10 }}>
          <span>דיצלרציות (Decelerations)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 6 }}>
          {DECEL_OPTIONS.map(opt => {
            const active = decels === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setDecels(opt.value)}
                style={{
                  padding: '9px 6px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '0.78rem', fontWeight: active ? 700 : 500, textAlign: 'center',
                  border: active ? `1.5px solid ${opt.color}` : '1px solid rgba(255,255,255,0.1)',
                  background: active ? `${opt.color}22` : 'rgba(255,255,255,0.04)',
                  color: active ? opt.color : '#9ca3af',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Contraction frequency */}
        <div style={{ ...fieldLabel, marginBottom: 10, marginTop: 14 }}>
          <span>תדירות פ&quot;ר (TOCO)</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {CONTRACTION_OPTIONS.map(opt => {
            const active = contrFreq === opt.freq;
            return (
              <button
                key={opt.freq}
                onClick={() => setContrFreq(opt.freq)}
                style={{
                  flex: '1 0 auto', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '0.78rem', fontWeight: active ? 700 : 500, textAlign: 'center',
                  border: active ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                  background: active ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#c4b5fd' : '#9ca3af',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* ── Maternal section ─────────────────────────────── */}
        <div style={sectionLabel}>אם — ערכים מטרנליים</div>

        {/* BP */}
        <div style={fieldLabel}>
          <span>לחץ דם סיסטולי</span>
          <span style={{ fontFamily: 'monospace', fontSize: '1rem', color: bpSystolic >= 160 ? '#dc2626' : '#f1f5f9' }}>{bpSystolic} mmHg</span>
        </div>
        <input type="range" min={60} max={220} step={5} value={bpSystolic} onChange={e => setBpSystolic(Number(e.target.value))} style={sliderStyle} />

        {/* SpO2 */}
        <div style={fieldLabel}>
          <span>רוויון חמצן (SpO₂)</span>
          <span style={{ fontFamily: 'monospace', fontSize: '1rem', color: spo2 < 94 ? '#dc2626' : '#06b6d4' }}>{spo2}%</span>
        </div>
        <input type="range" min={70} max={100} step={1} value={spo2} onChange={e => setSpo2(Number(e.target.value))} style={sliderStyle} />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={handleApply}
            style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            החל שינויים
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid rgba(156,163,175,0.3)', background: 'rgba(255,255,255,0.04)', color: '#9ca3af', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
