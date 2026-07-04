'use client';

import { useState, useEffect } from 'react';
import { useSimTheme } from './SimThemeProvider';
import type {
  CTGParams, VitalSigns, LiveOverrideParams,
  FHRVariability, DecelerationType, CTGSpecial, ContractionIntensity,
} from '@/lib/simulatorTypes';

interface Props {
  isOpen:    boolean;
  ctgParams: CTGParams;
  vitals:    VitalSigns;
  onUpdate:  (params: Partial<LiveOverrideParams>, mode: 'retroactive' | 'prospective') => void;
  onClose:   () => void;
}

const VARIABILITY_OPTIONS: { value: FHRVariability; label: string; color: string }[] = [
  { value: 'normal',  label: 'תקינה',  color: '#16a34a' },
  { value: 'reduced', label: 'מופחתת', color: '#f59e0b' },
  { value: 'absent',  label: 'נעדרת',  color: '#dc2626' },
];

const DECEL_OPTIONS: { value: DecelerationType; label: string; color: string }[] = [
  { value: 'none',              label: 'ללא',             color: '#16a34a' },
  { value: 'variable_mild',     label: 'משתנות קלות',     color: '#f59e0b' },
  { value: 'variable_moderate', label: 'משתנות בינוניות', color: '#f97316' },
  { value: 'variable_severe',   label: 'משתנות חמורות',   color: '#dc2626' },
  { value: 'early',             label: 'מוקדמות',         color: '#3b82f6' },
  { value: 'late',              label: 'מאוחרות',         color: '#b91c1c' },
  { value: 'prolonged',         label: 'ממושכות',         color: '#7f1d1d' },
];

const SPECIAL_OPTIONS: { value: CTGSpecial; label: string; color: string }[] = [
  { value: 'none',        label: 'ללא',         color: '#6b7280' },
  { value: 'tachycardia', label: 'טכיקרדיה',    color: '#f97316' },
  { value: 'bradycardia', label: 'ברדיקרדיה',   color: '#dc2626' },
  { value: 'sinusoidal',  label: 'סינוסואידלי', color: '#7c3aed' },
];

const FREQ_OPTIONS = [
  { label: 'ללא פ"ר',      freq: 0  },
  { label: 'לא סדירה',     freq: 3  },
  { label: 'פ"ר צפופה',    freq: 6  },
  { label: 'טכיסיסטוליה', freq: 12 },
] as const;

const INTENSITY_OPTIONS: { value: ContractionIntensity; label: string }[] = [
  { value: 'mild',     label: 'קלה'     },
  { value: 'moderate', label: 'בינונית' },
  { value: 'strong',   label: 'חזקה'    },
];

const YLD_MILD   = { bp_systolic: 135, bp_diastolic:  95 };
const YLD_SEVERE = { bp_systolic: 160, bp_diastolic: 115 };

export default function LiveOverridePanel({ isOpen, ctgParams, vitals, onUpdate, onClose }: Props) {
  const { theme } = useSimTheme();
  const [fhr,       setFhr]       = useState(ctgParams.fhr_baseline);
  const [varb,      setVarb]      = useState<FHRVariability>(ctgParams.fhr_variability);
  const [accels,    setAccels]    = useState<'present' | 'absent'>(ctgParams.accelerations);
  const [decels,    setDecels]    = useState<DecelerationType>(ctgParams.decelerations);
  const [special,   setSpecial]   = useState<CTGSpecial>(ctgParams.special ?? 'none');
  const [freq,      setFreq]      = useState(ctgParams.contraction_frequency);
  const [intensity, setIntensity] = useState<ContractionIntensity>(ctgParams.contraction_intensity);
  const [hr,        setHr]        = useState(vitals.hr);
  const [sbp,       setSbp]       = useState(vitals.bp_systolic);
  const [dbp,       setDbp]       = useState(vitals.bp_diastolic);
  const [spo2,      setSpo2]      = useState(vitals.spo2);
  const [temp,      setTemp]      = useState(vitals.temp);

  // Re-sync local state when panel opens
  useEffect(() => {
    if (!isOpen) return;
    setFhr(ctgParams.fhr_baseline);
    setVarb(ctgParams.fhr_variability);
    setAccels(ctgParams.accelerations);
    setDecels(ctgParams.decelerations);
    setSpecial(ctgParams.special ?? 'none');
    setFreq(ctgParams.contraction_frequency);
    setIntensity(ctgParams.contraction_intensity);
    setHr(vitals.hr);
    setSbp(vitals.bp_systolic);
    setDbp(vitals.bp_diastolic);
    setSpo2(vitals.spo2);
    setTemp(vitals.temp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Style helpers ────────────────────────────────────────────────────────────
  const sec: React.CSSProperties = {
    color: theme.textDim, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 10, marginTop: 18,
    borderTop: `1px solid ${theme.borderSoft}`, paddingTop: 14,
  };
  const lbl: React.CSSProperties = {
    color: theme.label, fontSize: '0.75rem', fontWeight: 600,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  };
  const slider: React.CSSProperties = {
    width: '100%', accentColor: '#7c3aed', cursor: 'pointer', marginBottom: 14,
  };
  const chip = (active: boolean, color: string): React.CSSProperties => ({
    padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '0.78rem', fontWeight: active ? 700 : 500, textAlign: 'center',
    border: active ? `1.5px solid ${color}` : `1px solid ${theme.borderSoft}`,
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    color: active ? color : '#9ca3af',
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{ background: theme.surfaceRaised, border: `1px solid ${theme.borderSoft}`, borderRadius: 16, padding: '20px 24px', width: '100%', maxWidth: 540, color: theme.textHi, boxShadow: '0 25px 60px rgba(0,0,0,0.6)', maxHeight: '90dvh', overflowY: 'auto' }}
      >
        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: theme.label }}>⚡ שנה מדדים וניטור</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1.2rem', fontFamily: 'inherit' }}>✕</button>
        </div>
        <p style={{ margin: '0 0 6px', color: theme.textDim, fontSize: '0.7rem' }}>הגדר ערכים ובחר אחת משתי האפשרויות</p>

        {/* ── CTG ──────────────────────────────────────────────── */}
        <div style={sec}>CTG — ניטור עוברי</div>

        {/* 1. FHR baseline */}
        <div style={lbl}>
          <span>בסיס FHR</span>
          <span style={{ fontFamily: 'monospace', color: fhr < 110 ? '#dc2626' : fhr > 160 ? '#f97316' : '#22c55e' }}>{fhr} bpm</span>
        </div>
        <input type="range" min={60} max={200} step={5} value={fhr} style={slider}
          onChange={e => setFhr(Number(e.target.value))} />

        {/* 2. Variability */}
        <div style={{ ...lbl, marginBottom: 10 }}><span>ואריאביליות</span></div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {VARIABILITY_OPTIONS.map(o => (
            <button key={o.value} style={{ ...chip(varb === o.value, o.color), flex: 1 }}
              onClick={() => setVarb(o.value)}>
              {o.label}
            </button>
          ))}
        </div>

        {/* 3. Accelerations */}
        <div style={{ ...lbl, marginBottom: 10 }}><span>האצות</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['present', 'absent'] as const).map(v => (
            <button key={v} style={{ ...chip(accels === v, v === 'present' ? '#16a34a' : '#dc2626'), flex: 1, padding: '10px 0', fontSize: '0.85rem', fontWeight: 700 }}
              onClick={() => setAccels(v)}>
              {v === 'present' ? '✓ קיימות' : '✗ נעדרות'}
            </button>
          ))}
        </div>

        {/* 4. Decelerations */}
        <div style={{ ...lbl, marginBottom: 10 }}><span>האטות</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
          {DECEL_OPTIONS.map(o => (
            <button key={o.value} style={{ ...chip(decels === o.value, o.color), padding: '9px 6px' }}
              onClick={() => setDecels(o.value)}>
              {o.label}
            </button>
          ))}
        </div>

        {/* 5. Special pattern */}
        <div style={{ ...lbl, marginBottom: 10 }}><span>דפוס מיוחד</span></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {SPECIAL_OPTIONS.map(o => (
            <button key={o.value} style={{ ...chip(special === o.value, o.color), flex: '1 0 auto' }}
              onClick={() => setSpecial(o.value)}>
              {o.label}
            </button>
          ))}
        </div>

        {/* 6. Contractions — frequency + intensity */}
        <div style={{ ...lbl, marginBottom: 10 }}><span>פעילות רחמית</span></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {FREQ_OPTIONS.map(o => (
            <button key={o.freq} style={{ ...chip(freq === o.freq, '#7c3aed'), flex: '1 0 auto' }}
              onClick={() => setFreq(o.freq)}>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {INTENSITY_OPTIONS.map(o => (
            <button key={o.value} style={{ ...chip(intensity === o.value, '#0ea5e9'), flex: 1 }}
              onClick={() => setIntensity(o.value)}>
              {o.label}
            </button>
          ))}
        </div>

        {/* ── Maternal ─────────────────────────────────────────── */}
        <div style={sec}>אם — ערכים מטרנליים</div>

        {/* 7. Maternal HR */}
        <div style={lbl}>
          <span>דופק אמהי</span>
          <span style={{ fontFamily: 'monospace', color: hr > 100 ? '#f97316' : hr < 60 ? '#f87171' : '#22c55e' }}>{hr} bpm</span>
        </div>
        <input type="range" min={40} max={160} step={5} value={hr} style={slider}
          onChange={e => setHr(Number(e.target.value))} />

        {/* 8. Blood pressure + HTN presets */}
        <div style={lbl}>
          <span>לחץ דם</span>
          <span style={{ fontFamily: 'monospace', color: sbp >= 160 || dbp >= 110 ? '#dc2626' : sbp >= 135 || dbp >= 90 ? '#f97316' : '#f1f5f9' }}>
            {sbp}/{dbp} mmHg
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            style={{ ...chip(sbp === YLD_MILD.bp_systolic && dbp === YLD_MILD.bp_diastolic, '#f97316'), flex: 1 }}
            onClick={() => { setSbp(YLD_MILD.bp_systolic); setDbp(YLD_MILD.bp_diastolic); }}>
            יל&quot;ד קל
          </button>
          <button
            style={{ ...chip(sbp === YLD_SEVERE.bp_systolic && dbp === YLD_SEVERE.bp_diastolic, '#dc2626'), flex: 1 }}
            onClick={() => { setSbp(YLD_SEVERE.bp_systolic); setDbp(YLD_SEVERE.bp_diastolic); }}>
            יל&quot;ד חמור
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ color: theme.textDim, fontSize: '0.68rem' }}>סיסטולי</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: sbp >= 160 ? '#dc2626' : sbp >= 135 ? '#f97316' : '#f1f5f9' }}>{sbp}</span>
            </div>
            <input type="range" min={60} max={220} step={5} value={sbp} style={{ ...slider, marginBottom: 0 }}
              onChange={e => {
                const newSbp = Number(e.target.value);
                const pulse  = sbp - dbp; // maintain pulse pressure
                setSbp(newSbp);
                setDbp(Math.max(40, Math.min(160, Math.round((newSbp - pulse) / 5) * 5)));
              }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ color: theme.textDim, fontSize: '0.68rem' }}>דיאסטולי</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: dbp >= 110 ? '#dc2626' : dbp >= 90 ? '#f97316' : '#f1f5f9' }}>{dbp}</span>
            </div>
            <input type="range" min={40} max={160} step={5} value={dbp} style={{ ...slider, marginBottom: 0 }}
              onChange={e => setDbp(Number(e.target.value))} />
          </div>
        </div>

        {/* 9. SpO2 */}
        <div style={lbl}>
          <span>רוויון חמצן (SpO₂)</span>
          <span style={{ fontFamily: 'monospace', color: spo2 < 94 ? '#dc2626' : '#06b6d4' }}>{spo2}%</span>
        </div>
        <input type="range" min={70} max={100} step={1} value={spo2} style={slider}
          onChange={e => setSpo2(Number(e.target.value))} />

        {/* 10. Temperature */}
        <div style={lbl}>
          <span>חום</span>
          <span style={{ fontFamily: 'monospace', color: temp >= 38 ? '#dc2626' : temp >= 37.5 ? '#f97316' : '#f1f5f9' }}>{temp.toFixed(1)} °C</span>
        </div>
        <input type="range" min={35} max={42} step={0.1} value={temp} style={slider}
          onChange={e => setTemp(Number(e.target.value))} />

        {/* Confirm buttons */}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => {
              onUpdate({
                fhr_baseline: fhr, fhr_variability: varb, accelerations: accels,
                decelerations: decels, special,
                contraction_frequency: freq, contraction_intensity: intensity,
                hr, bp_systolic: sbp, bp_diastolic: dbp, spo2, temp,
              }, 'retroactive');
              onClose();
            }}
            style={{ width: '100%', padding: '13px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4B2E6A,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            🔄 החלף תמונה קלינית
          </button>
          <div style={{ color: theme.textDim, fontSize: '0.68rem', textAlign: 'center', margin: '-2px 0' }}>
            כל ה-CTG הנראה עכשיו מוחלף מיידית — השינוי כולל את כל ההיסטוריה הנראית
          </div>
          <button
            onClick={() => {
              onUpdate({
                fhr_baseline: fhr, fhr_variability: varb, accelerations: accels,
                decelerations: decels, special,
                contraction_frequency: freq, contraction_intensity: intensity,
                hr, bp_systolic: sbp, bp_diastolic: dbp, spo2, temp,
              }, 'prospective');
              onClose();
            }}
            style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: `1px solid ${theme.borderSoft}`, background: theme.accentSoft, color: theme.lilac, fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ➡ שנה בהדרגה
          </button>
          <div style={{ color: theme.textDim, fontSize: '0.68rem', textAlign: 'center', margin: '-2px 0' }}>
            ההיסטוריה נשארת — השינוי חל רק על הדגימות החדשות מכאן ואילך
          </div>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: '1px solid rgba(156,163,175,0.15)', background: theme.surface, color: theme.textDim, fontWeight: 500, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
