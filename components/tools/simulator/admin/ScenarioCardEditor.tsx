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
import LabFieldsEditor from '@/components/tools/simulator/LabFieldsEditor';
import { useSimTheme } from '@/components/tools/simulator/SimThemeProvider';
import type { SimTheme } from '@/lib/simTheme';

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
  expected_actions?: string;
  cards: EditorCard[];
}

interface Props {
  scenario: EditorScenario;
  onSave: (updated: EditorScenario) => void;
  onClose: () => void;
}

type CardSubTab = 'text' | 'ctg' | 'vitals' | 'labs';

// ── Themed style helpers ──────────────────────────────────────────────────────

function inputBase(theme: SimTheme): React.CSSProperties {
  return {
    background: theme.inputBg,
    border: `1px solid ${theme.borderSoft}`,
    borderRadius: 6,
    padding: '8px 10px',
    color: theme.textHi,
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
}

function labelStyle(theme: SimTheme): React.CSSProperties {
  return {
    color: theme.label,
    fontSize: '0.8rem',
    fontWeight: 600,
    display: 'block',
    marginBottom: 4,
  };
}

function sectionHead(theme: SimTheme): React.CSSProperties {
  return {
    color: theme.accent,
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 14,
    borderBottom: `1px solid ${theme.borderSoft}`,
    paddingBottom: 4,
  };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useSimTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle(theme)}>{label}</label>
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
  const { theme } = useSimTheme();
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
        style={inputBase(theme)}
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
  const { theme } = useSimTheme();
  return (
    <FieldBox label={label}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        style={{ ...inputBase(theme), cursor: 'pointer' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldBox>
  );
}

// ── Scenario-level panel ──────────────────────────────────────────────────────

function ScenarioPanel({ name, caseStory, expectedActions, onChange }: {
  name: string;
  caseStory: string;
  expectedActions: string;
  onChange: (patch: { name?: string; caseStory?: string; expectedActions?: string }) => void;
}) {
  const { theme } = useSimTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FieldBox label="שם התרחיש">
        <input
          type="text"
          value={name}
          onChange={e => onChange({ name: e.target.value })}
          style={inputBase(theme)}
        />
      </FieldBox>
      <FieldBox label="וינייטת פתיחה — מוצגת למתמחים כחלון קופץ בתחילת הסימולציה">
        <textarea
          value={caseStory}
          onChange={e => onChange({ caseStory: e.target.value })}
          rows={7}
          style={{ ...inputBase(theme), resize: 'vertical', lineHeight: 1.7 }}
        />
      </FieldBox>
      <FieldBox label="פעולות מצופות (מופרדות ב־·)">
        <textarea
          value={expectedActions}
          onChange={e => onChange({ expectedActions: e.target.value })}
          rows={3}
          style={{ ...inputBase(theme), resize: 'vertical', lineHeight: 1.7 }}
        />
      </FieldBox>
    </div>
  );
}

// ── Sub-tab panels ────────────────────────────────────────────────────────────

function TextPanel({ card, onChange }: {
  card: EditorCard;
  onChange: (patch: Partial<EditorCard>) => void;
}) {
  const { theme } = useSimTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FieldBox label="כותרת הכרטיס">
        <input
          type="text"
          value={card.title}
          onChange={e => onChange({ title: e.target.value })}
          style={inputBase(theme)}
        />
      </FieldBox>
      <FieldBox label="תיאור קליני (מה הצוות רואה)">
        <textarea
          value={card.clinical_description}
          onChange={e => onChange({ clinical_description: e.target.value })}
          rows={6}
          style={{ ...inputBase(theme), resize: 'vertical', lineHeight: 1.7 }}
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
  const { theme } = useSimTheme();
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
        <label style={{ color: theme.textDim, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={hasCTG}
            onChange={e => e.target.checked ? enableCTG() : clearCTG()}
            style={{ width: 15, height: 15, accentColor: theme.accent }}
          />
          הצג CTG בכרטיס זה
        </label>
      </div>

      {hasCTG && (
        <>
          {/* Preset quick-buttons */}
          <div style={sectionHead(theme)}>פריסטים מהירים</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {Object.entries(CTG_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => updateCTG(preset.ctg)}
                style={{
                  padding: '5px 13px', borderRadius: 20, fontSize: '0.85rem',
                  border: `1px solid ${theme.borderSoft}`,
                  background: theme.accentSoft, color: theme.lilac,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {preset.labelHe}
              </button>
            ))}
          </div>

          {/* Manual fields */}
          <div style={sectionHead(theme)}>פרמטרים ידניים</div>
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
              <label style={{ color: theme.textDim, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!ctg.postpartum}
                  onChange={e => updateCTG({ postpartum: e.target.checked })}
                  style={{ width: 15, height: 15, accentColor: theme.accent }}
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

// ── Main component ────────────────────────────────────────────────────────────

// Keep card titles' "כרטיס N" prefix in sync after add/delete/reorder
function renumberCards(cards: EditorCard[]): EditorCard[] {
  return cards.map((c, i) => ({
    ...c,
    card_number: i + 1,
    title: c.title.replace(/^כרטיס \d+/, `כרטיס ${i + 1}`),
  }));
}

export default function ScenarioCardEditor({ scenario, onSave, onClose }: Props) {
  const { theme } = useSimTheme();

  // Deep-clone cards so we can edit without mutating the original
  const [cards, setCards] = useState<EditorCard[]>(
    () => scenario.cards.map(c => ({
      ...c,
      structured_data: c.structured_data ? JSON.parse(JSON.stringify(c.structured_data)) : {},
    }))
  );
  const [name, setName]                       = useState(scenario.name);
  const [caseStory, setCaseStory]             = useState(scenario.case_story ?? '');
  const [expectedActions, setExpectedActions] = useState(scenario.expected_actions ?? '');

  // -1 = scenario-level tab; 0..n-1 = card index
  const [activeCardIdx, setActiveCardIdx] = useState(-1);
  const [activeSubTab, setActiveSubTab]   = useState<CardSubTab>('text');
  const [saving, setSaving]   = useState(false);
  const [saveNote, setSaveNote] = useState('');

  const activeCard = activeCardIdx >= 0 ? cards[activeCardIdx] : null;

  const updateCard = useCallback((patch: Partial<EditorCard>) => {
    setCards(prev => prev.map((c, i) => i === activeCardIdx ? { ...c, ...patch } : c));
  }, [activeCardIdx]);

  const addCard = () => {
    setCards(prev => {
      const last = prev[prev.length - 1];
      const cloned: EditorCard = {
        card_number: prev.length + 1,
        title: `כרטיס ${prev.length + 1} — `,
        clinical_description: '',
        structured_data: last ? JSON.parse(JSON.stringify(last.structured_data)) : {},
      };
      return [...prev, cloned];
    });
    setActiveCardIdx(cards.length);
    setActiveSubTab('text');
  };

  const deleteCard = () => {
    if (activeCardIdx < 0 || cards.length <= 1) return;
    if (!window.confirm(`למחוק את כרטיס ${activeCardIdx + 1}?`)) return;
    setCards(prev => renumberCards(prev.filter((_, i) => i !== activeCardIdx)));
    setActiveCardIdx(idx => Math.max(0, idx - 1));
  };

  const moveCard = (dir: -1 | 1) => {
    if (activeCardIdx < 0) return;
    const target = activeCardIdx + dir;
    if (target < 0 || target >= cards.length) return;
    setCards(prev => {
      const next = [...prev];
      [next[activeCardIdx], next[target]] = [next[target], next[activeCardIdx]];
      return renumberCards(next);
    });
    setActiveCardIdx(target);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveNote('');
    try {
      const res = await fetch(`/api/simulator/scenarios/${scenario.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          case_story: caseStory,
          expected_actions: expectedActions,
          cards,
        }),
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
      onSave({ ...scenario, name, case_story: caseStory, expected_actions: expectedActions, cards });
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

  const cardTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: '0.88rem',
    border:      active ? `1.5px solid ${theme.accent}` : `1px solid ${theme.borderSoft}`,
    background:  active ? theme.chipBg : 'transparent',
    color:       active ? theme.lilac : theme.textDim,
    fontWeight:  active ? 700 : 400,
    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  });

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
              ✎ עריכת תרחיש
            </div>
            <div style={{ color: theme.accent, fontSize: '0.88rem', marginTop: 2 }}>
              {name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}
          >✕</button>
        </div>

        {/* Scenario tab + card selector tabs + card actions */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 20px', alignItems: 'center',
          borderBottom: `1px solid ${theme.borderSoft}`,
          overflowX: 'auto', flexShrink: 0,
        }}>
          <button onClick={() => setActiveCardIdx(-1)} style={cardTabStyle(activeCardIdx === -1)}>
            🎬 תרחיש
          </button>
          {cards.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveCardIdx(i)}
              style={cardTabStyle(i === activeCardIdx)}
            >
              כרטיס {c.card_number}
            </button>
          ))}
          <button
            onClick={addCard}
            title="הוסף כרטיס"
            style={{ ...cardTabStyle(false), fontWeight: 700, color: theme.accent }}
          >
            ＋ הוסף
          </button>
          {activeCardIdx >= 0 && (
            <div style={{ display: 'flex', gap: 4, marginInlineStart: 'auto' }}>
              <button onClick={() => moveCard(-1)} disabled={activeCardIdx === 0} title="הזז מוקדם יותר"
                style={{ ...cardTabStyle(false), opacity: activeCardIdx === 0 ? 0.35 : 1, padding: '6px 10px' }}>▶</button>
              <button onClick={() => moveCard(1)} disabled={activeCardIdx === cards.length - 1} title="הזז מאוחר יותר"
                style={{ ...cardTabStyle(false), opacity: activeCardIdx === cards.length - 1 ? 0.35 : 1, padding: '6px 10px' }}>◀</button>
              <button onClick={deleteCard} disabled={cards.length <= 1} title="מחק כרטיס"
                style={{ ...cardTabStyle(false), color: theme.danger, opacity: cards.length <= 1 ? 0.35 : 1, padding: '6px 10px' }}>🗑</button>
            </div>
          )}
        </div>

        {/* Sub-tabs (cards only) */}
        {activeCard && (
          <div style={{
            display: 'flex', gap: 4, padding: '8px 20px',
            borderBottom: `1px solid ${theme.borderSoft}`,
            flexShrink: 0,
          }}>
            {subTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveSubTab(t.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: '0.88rem',
                  border:      activeSubTab === t.key ? `1px solid ${theme.border}` : '1px solid transparent',
                  background:  activeSubTab === t.key ? theme.chipBg : 'transparent',
                  color:       activeSubTab === t.key ? theme.lilac : theme.textDim,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {!activeCard && (
            <ScenarioPanel
              name={name}
              caseStory={caseStory}
              expectedActions={expectedActions}
              onChange={p => {
                if (p.name !== undefined) setName(p.name);
                if (p.caseStory !== undefined) setCaseStory(p.caseStory);
                if (p.expectedActions !== undefined) setExpectedActions(p.expectedActions);
              }}
            />
          )}
          {activeCard && activeSubTab === 'text'   && <TextPanel   card={activeCard} onChange={updateCard} />}
          {activeCard && activeSubTab === 'ctg'    && <CTGPanel    card={activeCard} onChange={updateCard} />}
          {activeCard && activeSubTab === 'vitals' && <VitalsPanel card={activeCard} onChange={updateCard} />}
          {activeCard && activeSubTab === 'labs'   && (
            <LabFieldsEditor
              key={activeCardIdx}
              labs={activeCard.structured_data.labs ?? {}}
              abnormalFields={activeCard.structured_data.abnormal_fields ?? []}
              onChange={(labs, abnormal_fields) => updateCard({
                structured_data: { ...activeCard.structured_data, labs, abnormal_fields },
              })}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${theme.borderSoft}`,
          display: 'flex', gap: 10, alignItems: 'center',
          flexShrink: 0,
        }}>
          {saveNote && (
            <div style={{
              flex: 1, fontSize: '0.85rem', color: saveNote.startsWith('שגיאה') ? theme.danger : '#b45309',
              textAlign: 'right',
            }}>
              {saveNote}
            </div>
          )}
          <div style={{ flex: saveNote ? 0 : 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px', borderRadius: 8,
              border: `1px solid ${theme.borderSoft}`,
              background: 'transparent',
              color: theme.textDim, fontSize: '0.95rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px', borderRadius: 8,
              border: 'none',
              background: saving ? '#6b7280' : `linear-gradient(135deg, ${theme.brand}, ${theme.accent})`,
              color: '#fff', fontSize: '0.95rem', fontWeight: 700,
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
