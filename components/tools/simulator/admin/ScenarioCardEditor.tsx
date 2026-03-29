'use client';

import { useState, useCallback } from 'react';
import type {
  CTGParams,
  VitalSigns,
  CardLabs,
  FHRVariability,
  DecelerationType,
  ContractionIntensity,
  CTGSpecial,
} from '@/lib/simulatorTypes';
import { CTG_PRESETS } from '@/lib/ctgPresets';

// ── Local types (mirror page.tsx's ScenarioCard / Scenario) ──────────────────

export interface EditorCard {
  card_number: number;
  title: string;
  clinical_description: string;
  structured_data: {
    ctg?: CTGParams;
    vitals?: VitalSigns;
    labs?: CardLabs;
    abnormal_fields?: string[];
    [key: string]: unknown;
  };
}

export interface EditorScenario {
  id: number;
  name: string;
  case_story?: string;
  cards: EditorCard[];
}

interface Props {
  scenario: EditorScenario;
  onSave: (updated: EditorScenario) => void;
  onClose: () => void;
}

type CardSubTab = 'text' | 'ctg' | 'vitals' | 'labs';

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(139,92,246,0.3)',
  borderRadius: 6,
  padding: '6px 9px',
  color: '#f1f5f9',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  color: '#a78bfa',
  fontSize: '0.68rem',
  fontWeight: 600,
  display: 'block',
  marginBottom: 3,
};

const sectionHead: React.CSSProperties = {
  color: '#7c3aed',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 8,
  marginTop: 14,
  borderBottom: '1px solid rgba(139,92,246,0.2)',
  paddingBottom: 4,
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function NumInput({
  label, value, onChange, step = 1, min, max,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <FieldBox label={label}>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? ''}
        onChange={e => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        style={{ ...inputBase, width: '100%' }}
      />
    </FieldBox>
  );
}

function SelectInput<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <FieldBox label={label}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        style={{ ...inputBase, cursor: 'pointer' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldBox>
  );
}

// ── Sub-tab panels ────────────────────────────────────────────────────────────

function TextPanel({ card, onChange }: {
  card: EditorCard;
  onChange: (patch: Partial<EditorCard>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FieldBox label="כותרת הכרטיס">
        <input
          type="text"
          value={card.title}
          onChange={e => onChange({ title: e.target.value })}
          style={inputBase}
        />
      </FieldBox>
      <FieldBox label="תיאור קליני (מה הצוות רואה)">
        <textarea
          value={card.clinical_description}
          onChange={e => onChange({ clinical_description: e.target.value })}
          rows={5}
          style={{ ...inputBase, resize: 'vertical' }}
        />
      </FieldBox>
    </div>
  );
}

const DEFAULT_CTG: CTGParams = {
  fhr_baseline: 140,
  fhr_variability: 'normal',
  accelerations: 'present',
  decelerations: 'none',
  contraction_frequency: 3,
  contraction_intensity: 'moderate',
  special: 'none',
};

function CTGPanel({ card, onChange }: {
  card: EditorCard;
  onChange: (patch: Partial<EditorCard>) => void;
}) {
  const ctg = card.structured_data.ctg ?? DEFAULT_CTG;
  const hasCTG = !!card.structured_data.ctg;

  const updateCTG = (patch: Partial<CTGParams>) => {
    onChange({
      structured_data: {
        ...card.structured_data,
        ctg: { ...ctg, ...patch },
      },
    });
  };

  const clearCTG = () => {
    const { ctg: _ctg, ...rest } = card.structured_data;
    onChange({ structured_data: rest });
  };

  const enableCTG = () => {
    onChange({ structured_data: { ...card.structured_data, ctg: DEFAULT_CTG } });
  };

  return (
    <div>
      {/* Toggle CTG on/off */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <label style={{ color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={hasCTG}
            onChange={e => e.target.checked ? enableCTG() : clearCTG()}
            style={{ width: 14, height: 14, accentColor: '#7c3aed' }}
          />
          הצג CTG בכרטיס זה
        </label>
      </div>

      {hasCTG && (
        <>
          {/* Preset quick-buttons */}
          <div style={sectionHead}>פריסטים מהירים</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {Object.entries(CTG_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => updateCTG(preset.ctg)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.73rem',
                  border: '1px solid rgba(139,92,246,0.4)',
                  background: 'rgba(124,58,237,0.1)', color: '#c4b5fd',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {preset.labelHe}
              </button>
            ))}
          </div>

          {/* Manual fields */}
          <div style={sectionHead}>פרמטרים ידניים</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <NumInput label="FHR Baseline (bpm)" value={ctg.fhr_baseline} onChange={v => updateCTG({ fhr_baseline: v ?? 140 })} min={50} max={220} />

            <SelectInput<FHRVariability>
              label="Variability"
              value={ctg.fhr_variability}
              options={[
                { value: 'normal',    label: 'Normal' },
                { value: 'reduced',   label: 'Reduced' },
                { value: 'minimal',   label: 'Minimal' },
                { value: 'absent',    label: 'Absent' },
                { value: 'saltatory', label: 'Saltatory' },
              ]}
              onChange={v => updateCTG({ fhr_variability: v })}
            />

            <SelectInput<'present' | 'absent'>
              label="Accelerations"
              value={ctg.accelerations}
              options={[
                { value: 'present', label: 'Present' },
                { value: 'absent',  label: 'Absent' },
              ]}
              onChange={v => updateCTG({ accelerations: v })}
            />

            <SelectInput<DecelerationType>
              label="Decelerations"
              value={ctg.decelerations}
              options={[
                { value: 'none',              label: 'None' },
                { value: 'early',             label: 'Early' },
                { value: 'variable_mild',     label: 'Variable Mild' },
                { value: 'variable_moderate', label: 'Variable Moderate' },
                { value: 'variable_severe',   label: 'Variable Severe' },
                { value: 'late',              label: 'Late' },
                { value: 'prolonged',         label: 'Prolonged' },
              ]}
              onChange={v => updateCTG({ decelerations: v })}
            />

            {ctg.decelerations !== 'none' && (
              <NumInput label="Decel Depth (bpm)" value={ctg.deceleration_depth} onChange={v => updateCTG({ deceleration_depth: v })} min={0} max={120} />
            )}

            <NumInput label="Contractions / 10min" value={ctg.contraction_frequency} onChange={v => updateCTG({ contraction_frequency: v ?? 3 })} min={0} max={10} />

            <SelectInput<ContractionIntensity>
              label="Contraction Intensity"
              value={ctg.contraction_intensity}
              options={[
                { value: 'mild',     label: 'Mild' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'strong',   label: 'Strong' },
              ]}
              onChange={v => updateCTG({ contraction_intensity: v })}
            />

            <SelectInput<CTGSpecial>
              label="Special Pattern"
              value={ctg.special ?? 'none'}
              options={[
                { value: 'none',        label: 'None' },
                { value: 'bradycardia', label: 'Bradycardia' },
                { value: 'tachycardia', label: 'Tachycardia' },
                { value: 'sinusoidal',  label: 'Sinusoidal' },
              ]}
              onChange={v => updateCTG({ special: v })}
            />

            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <label style={{ color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!ctg.postpartum}
                  onChange={e => updateCTG({ postpartum: e.target.checked })}
                  style={{ width: 14, height: 14, accentColor: '#7c3aed' }}
                />
                Postpartum (no FHR)
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const DEFAULT_VITALS: VitalSigns = {
  hr: 88, bp_systolic: 120, bp_diastolic: 76, spo2: 99, temp: 37.0,
};

function VitalsPanel({ card, onChange }: {
  card: EditorCard;
  onChange: (patch: Partial<EditorCard>) => void;
}) {
  const vitals = card.structured_data.vitals ?? DEFAULT_VITALS;

  const update = (patch: Partial<VitalSigns>) => {
    onChange({ structured_data: { ...card.structured_data, vitals: { ...vitals, ...patch } } });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      <NumInput label="HR (bpm)"         value={vitals.hr}           onChange={v => update({ hr: v ?? 80 })}           min={30} max={220} />
      <NumInput label="BP Systolic"      value={vitals.bp_systolic}  onChange={v => update({ bp_systolic: v ?? 120 })} min={50} max={250} />
      <NumInput label="BP Diastolic"     value={vitals.bp_diastolic} onChange={v => update({ bp_diastolic: v ?? 70 })} min={30} max={150} />
      <NumInput label="SpO₂ (%)"         value={vitals.spo2}         onChange={v => update({ spo2: v ?? 98 })}         min={50} max={100} />
      <NumInput label="Temp (°C)"        value={vitals.temp}         onChange={v => update({ temp: v ?? 37.0 })}       step={0.1} min={34} max={42} />
      <NumInput label="RR (breaths/min)" value={vitals.rr}           onChange={v => update({ rr: v })}                min={0}  max={60} />
    </div>
  );
}

function LabsPanel({ card, onChange }: {
  card: EditorCard;
  onChange: (patch: Partial<EditorCard>) => void;
}) {
  const labs = card.structured_data.labs ?? {};

  const updateLabs = (patch: Partial<CardLabs>) => {
    onChange({ structured_data: { ...card.structured_data, labs: { ...labs, ...patch } } });
  };

  const cbc = labs.cbc ?? {};
  const chem = labs.chemistry ?? {};
  const coag = labs.coagulation ?? {};

  const setCBC   = (k: keyof typeof cbc,   v: number | undefined) => updateLabs({ cbc:         { ...cbc,  [k]: v } });
  const setChem  = (k: keyof typeof chem,  v: number | undefined) => updateLabs({ chemistry:   { ...chem, [k]: v } });
  const setCoag  = (k: keyof typeof coag,  v: number | undefined) => updateLabs({ coagulation: { ...coag, [k]: v } });

  return (
    <div>
      <div style={sectionHead}>CBC — ספירת דם</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        <NumInput label="WBC"  value={cbc.wbc}  onChange={v => setCBC('wbc',  v)} step={0.1} />
        <NumInput label="RBC"  value={cbc.rbc}  onChange={v => setCBC('rbc',  v)} step={0.01} />
        <NumInput label="HGB"  value={cbc.hgb}  onChange={v => setCBC('hgb',  v)} step={0.1} />
        <NumInput label="HCT"  value={cbc.hct}  onChange={v => setCBC('hct',  v)} step={0.1} />
        <NumInput label="PLT"  value={cbc.plt}  onChange={v => setCBC('plt',  v)} />
        <NumInput label="MCV"  value={cbc.mcv}  onChange={v => setCBC('mcv',  v)} step={0.1} />
        <NumInput label="MCH"  value={cbc.mch}  onChange={v => setCBC('mch',  v)} step={0.1} />
        <NumInput label="MCHC" value={cbc.mchc} onChange={v => setCBC('mchc', v)} step={0.1} />
        <NumInput label="MPV"  value={cbc.mpv}  onChange={v => setCBC('mpv',  v)} step={0.1} />
        <NumInput label="RDW"  value={cbc.rdw}  onChange={v => setCBC('rdw',  v)} step={0.1} />
      </div>

      <div style={sectionHead}>כימיה</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        <NumInput label="NA"    value={chem.na}    onChange={v => setChem('na',    v)} />
        <NumInput label="K"     value={chem.k}     onChange={v => setChem('k',     v)} step={0.1} />
        <NumInput label="CL"    value={chem.cl}    onChange={v => setChem('cl',    v)} />
        <NumInput label="GLU"   value={chem.glu}   onChange={v => setChem('glu',   v)} />
        <NumInput label="BUN"   value={chem.bun}   onChange={v => setChem('bun',   v)} step={0.1} />
        <NumInput label="CRE"   value={chem.cre}   onChange={v => setChem('cre',   v)} step={0.01} />
        <NumInput label="CA"    value={chem.ca}    onChange={v => setChem('ca',    v)} step={0.1} />
        <NumInput label="P"     value={chem.p}     onChange={v => setChem('p',     v)} step={0.1} />
        <NumInput label="ALB"   value={chem.alb}   onChange={v => setChem('alb',   v)} step={0.1} />
        <NumInput label="ALT"   value={chem.alt}   onChange={v => setChem('alt',   v)} />
        <NumInput label="AST"   value={chem.ast}   onChange={v => setChem('ast',   v)} />
        <NumInput label="ALK.P" value={chem.alk_p} onChange={v => setChem('alk_p', v)} />
        <NumInput label="GGTP"  value={chem.ggtp}  onChange={v => setChem('ggtp',  v)} />
        <NumInput label="T.BIL" value={chem.t_bil} onChange={v => setChem('t_bil', v)} step={0.01} />
        <NumInput label="LDH"   value={chem.ldh}   onChange={v => setChem('ldh',   v)} />
        <NumInput label="UR.AC" value={chem.ur_ac} onChange={v => setChem('ur_ac', v)} step={0.1} />
        <NumInput label="MG"    value={chem.mg}    onChange={v => setChem('mg',    v)} step={0.1} />
      </div>

      <div style={sectionHead}>קרישה</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        <NumInput label="PT%"   value={coag.pt_pct}  onChange={v => setCoag('pt_pct',  v)} step={0.1} />
        <NumInput label="INR"   value={coag.inr}     onChange={v => setCoag('inr',     v)} step={0.01} />
        <NumInput label="PTT"   value={coag.ptt}     onChange={v => setCoag('ptt',     v)} step={0.1} />
        <NumInput label="FIB"   value={coag.fib}     onChange={v => setCoag('fib',     v)} />
        <NumInput label="DIMER" value={coag.d_dimer} onChange={v => setCoag('d_dimer', v)} step={0.01} />
        <NumInput label="TT"    value={coag.tt}      onChange={v => setCoag('tt',      v)} step={0.1} />
        <NumInput label="BT"    value={coag.bt}      onChange={v => setCoag('bt',      v)} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScenarioCardEditor({ scenario, onSave, onClose }: Props) {
  // Deep-clone cards so we can edit without mutating the original
  const [cards, setCards] = useState<EditorCard[]>(
    () => scenario.cards.map(c => ({
      ...c,
      structured_data: c.structured_data ? JSON.parse(JSON.stringify(c.structured_data)) : {},
    }))
  );
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [activeSubTab, setActiveSubTab]   = useState<CardSubTab>('text');
  const [saving, setSaving]   = useState(false);
  const [saveNote, setSaveNote] = useState('');

  const activeCard = cards[activeCardIdx];

  const updateCard = useCallback((patch: Partial<EditorCard>) => {
    setCards(prev => prev.map((c, i) => i === activeCardIdx ? { ...c, ...patch } : c));
  }, [activeCardIdx]);

  const handleSave = async () => {
    setSaving(true);
    setSaveNote('');
    try {
      const res = await fetch(`/api/simulator/scenarios/${scenario.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cards }),
      });
      const data = await res.json() as { ok?: boolean; mock?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSaveNote(`שגיאה: ${data.error ?? 'לא ידועה'}`);
        setSaving(false);
        return;
      }
      if (data.mock) {
        setSaveNote('השינויים נשמרו בזיכרון בלבד (אין חיבור ל-DB)');
      }
      onSave({ ...scenario, cards });
    } catch (e) {
      setSaveNote(`שגיאה: ${String(e)}`);
      setSaving(false);
    }
  };

  const subTabs: { key: CardSubTab; label: string }[] = [
    { key: 'text',   label: '📋 תיאור' },
    { key: 'ctg',    label: '💓 CTG' },
    { key: 'vitals', label: '🩺 ויטלים' },
    { key: 'labs',   label: '🧪 מעבדה' },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          background: '#12122a',
          border: '1px solid rgba(139,92,246,0.4)',
          borderRadius: 16,
          width: '100%', maxWidth: 780,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(139,92,246,0.25)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '0.95rem' }}>
              ✎ עריכת תרחיש
            </div>
            <div style={{ color: '#7c3aed', fontSize: '0.78rem', marginTop: 2 }}>
              {scenario.name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}
          >✕</button>
        </div>

        {/* Card selector tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          overflowX: 'auto', flexShrink: 0,
        }}>
          {cards.map((c, i) => (
            <button
              key={c.card_number}
              onClick={() => setActiveCardIdx(i)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem',
                border:      i === activeCardIdx ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                background:  i === activeCardIdx ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                color:       i === activeCardIdx ? '#c4b5fd' : '#9ca3af',
                fontWeight:  i === activeCardIdx ? 700 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}
            >
              כרטיס {c.card_number}
            </button>
          ))}
        </div>

        {/* Sub-tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}>
          {subTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key)}
              style={{
                padding: '5px 14px', borderRadius: 8, fontSize: '0.76rem',
                border:      activeSubTab === t.key ? '1px solid rgba(139,92,246,0.5)' : '1px solid transparent',
                background:  activeSubTab === t.key ? 'rgba(124,58,237,0.14)' : 'transparent',
                color:       activeSubTab === t.key ? '#c4b5fd' : '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeSubTab === 'text'   && <TextPanel   card={activeCard} onChange={updateCard} />}
          {activeSubTab === 'ctg'    && <CTGPanel    card={activeCard} onChange={updateCard} />}
          {activeSubTab === 'vitals' && <VitalsPanel card={activeCard} onChange={updateCard} />}
          {activeSubTab === 'labs'   && <LabsPanel   card={activeCard} onChange={updateCard} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 10, alignItems: 'center',
          flexShrink: 0,
        }}>
          {saveNote && (
            <div style={{
              flex: 1, fontSize: '0.75rem', color: saveNote.startsWith('שגיאה') ? '#f87171' : '#fbbf24',
              textAlign: 'right',
            }}>
              {saveNote}
            </div>
          )}
          <div style={{ flex: saveNote ? 0 : 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: '9px 22px', borderRadius: 8,
              border: '1px solid rgba(156,163,175,0.3)',
              background: 'rgba(255,255,255,0.04)',
              color: '#9ca3af', fontSize: '0.88rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 22px', borderRadius: 8,
              border: 'none',
              background: saving ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
              color: '#fff', fontSize: '0.88rem', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? '⏳ שומר...' : '💾 שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  );
}
