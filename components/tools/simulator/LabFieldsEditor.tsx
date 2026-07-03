'use client';

import { useMemo, useState } from 'react';
import type { CardLabs } from '@/lib/simulatorTypes';
import { computeAbnormalFields } from '@/lib/labNormalRanges';
import { useSimTheme } from '@/components/tools/simulator/SimThemeProvider';

// Shared lab-values editor: full CBC/chemistry/coagulation/other grids with
// automatic abnormal flagging (NORMAL_RANGES) + per-field manual override.
// Used by ScenarioCardEditor (setup) and LabsPushPanel (live push).

interface Props {
  labs: CardLabs;
  abnormalFields: string[];
  onChange: (labs: CardLabs, abnormalFields: string[]) => void;
}

type GroupKey = 'cbc' | 'chemistry' | 'coagulation' | 'other';

interface FieldDef { key: string; label: string; step?: number }

const CBC_FIELDS: FieldDef[] = [
  { key: 'wbc', label: 'WBC', step: 0.1 }, { key: 'rbc', label: 'RBC', step: 0.01 },
  { key: 'hgb', label: 'HGB', step: 0.1 }, { key: 'hct', label: 'HCT', step: 0.1 },
  { key: 'plt', label: 'PLT' },            { key: 'mcv', label: 'MCV', step: 0.1 },
  { key: 'mch', label: 'MCH', step: 0.1 }, { key: 'mchc', label: 'MCHC', step: 0.1 },
  { key: 'mpv', label: 'MPV', step: 0.1 }, { key: 'rdw', label: 'RDW', step: 0.1 },
];

const CHEM_FIELDS: FieldDef[] = [
  { key: 'na', label: 'NA' },                { key: 'k', label: 'K', step: 0.1 },
  { key: 'cl', label: 'CL' },                { key: 'glu', label: 'GLU' },
  { key: 'bun', label: 'BUN', step: 0.1 },   { key: 'cre', label: 'CRE', step: 0.01 },
  { key: 'ca', label: 'CA', step: 0.1 },     { key: 'p', label: 'P', step: 0.1 },
  { key: 'alb', label: 'ALB', step: 0.1 },   { key: 'tp', label: 'TP', step: 0.1 },
  { key: 'alt', label: 'ALT' },              { key: 'ast', label: 'AST' },
  { key: 'alk_p', label: 'ALK.P' },          { key: 'ggtp', label: 'GGTP' },
  { key: 't_bil', label: 'T.BIL', step: 0.01 }, { key: 'd_bil', label: 'D.BIL', step: 0.01 },
  { key: 'ldh', label: 'LDH' },              { key: 'ur_ac', label: 'UR.AC', step: 0.1 },
  { key: 'mg', label: 'MG', step: 0.1 },
];

const COAG_FIELDS: FieldDef[] = [
  { key: 'pt_pct', label: 'PT%', step: 0.1 }, { key: 'inr', label: 'INR', step: 0.01 },
  { key: 'ptt', label: 'PTT', step: 0.1 },    { key: 'fib', label: 'FIB' },
  { key: 'd_dimer', label: 'DIMER', step: 0.01 }, { key: 'tt', label: 'TT', step: 0.1 },
  { key: 'bt', label: 'BT' },
];

const OTHER_FIELDS: FieldDef[] = [
  { key: 'crp', label: 'CRP', step: 0.1 },
  { key: 'protein_creatinine_ratio', label: 'PROT/CRE RATIO' },
];

export default function LabFieldsEditor({ labs, abnormalFields, onChange }: Props) {
  const { theme } = useSimTheme();

  // Manual overrides relative to the auto-computed flags. Initialized from the
  // difference between the incoming abnormal_fields and what auto-flagging
  // would produce, so hand-authored flags survive editing untouched fields.
  const [manualOn, setManualOn] = useState<Set<string>>(() => {
    const auto = new Set(computeAbnormalFields(labs));
    return new Set(abnormalFields.filter(f => !auto.has(f)));
  });
  const [manualOff, setManualOff] = useState<Set<string>>(() => {
    const current = new Set(abnormalFields);
    return new Set(computeAbnormalFields(labs).filter(f => !current.has(f)));
  });

  const effectiveFlags = useMemo(() => new Set(abnormalFields), [abnormalFields]);

  const computeEffective = (nextLabs: CardLabs, on: Set<string>, off: Set<string>): string[] => {
    const auto = new Set(computeAbnormalFields(nextLabs));
    on.forEach(f => auto.add(f));
    off.forEach(f => auto.delete(f));
    return [...auto];
  };

  const setField = (group: GroupKey, key: string, value: number | string | undefined) => {
    const nextGroup = { ...(labs[group] ?? {}), [key]: value } as Record<string, unknown>;
    if (value === undefined) delete nextGroup[key];
    const nextLabs = { ...labs, [group]: nextGroup } as CardLabs;
    onChange(nextLabs, computeEffective(nextLabs, manualOn, manualOff));
  };

  const toggleFlag = (key: string) => {
    const on = new Set(manualOn);
    const off = new Set(manualOff);
    if (effectiveFlags.has(key)) {
      on.delete(key);
      off.add(key);
    } else {
      off.delete(key);
      on.add(key);
    }
    setManualOn(on);
    setManualOff(off);
    onChange(labs, computeEffective(labs, on, off));
  };

  const sectionHead: React.CSSProperties = {
    color: theme.accent, fontSize: '0.85rem', fontWeight: 700,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    marginBottom: 8, marginTop: 14,
    borderBottom: `1px solid ${theme.borderSoft}`, paddingBottom: 4,
  };

  const renderField = (group: GroupKey, f: FieldDef) => {
    const groupObj = (labs[group] ?? {}) as Record<string, number | string | undefined>;
    const raw = groupObj[f.key];
    const value = typeof raw === 'number' ? raw : undefined;
    const flagged = effectiveFlags.has(f.key);
    return (
      <div key={f.key} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <label style={{ color: flagged ? theme.danger : theme.label, fontSize: '0.75rem', fontWeight: 600 }}>
            {f.label}
          </label>
          <button
            type="button"
            onClick={() => toggleFlag(f.key)}
            title={flagged ? 'בטל סימון כחריג' : 'סמן כחריג'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
              fontSize: '0.75rem', lineHeight: 1,
              color: flagged ? theme.danger : theme.textDim,
              opacity: flagged ? 1 : 0.45,
            }}
          >⚑</button>
        </div>
        <input
          type="number"
          step={f.step ?? 1}
          value={value ?? ''}
          onChange={e => {
            const v = e.target.value;
            setField(group, f.key, v === '' ? undefined : Number(v));
          }}
          style={{
            background: theme.inputBg,
            border: `1.5px solid ${flagged ? theme.danger : theme.borderSoft}`,
            borderRadius: 6, padding: '7px 9px',
            color: flagged ? theme.danger : theme.textHi,
            fontWeight: flagged ? 700 : 400,
            fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none',
            width: '100%', boxSizing: 'border-box',
          }}
        />
      </div>
    );
  };

  return (
    <div>
      <div style={{ ...sectionHead, marginTop: 0 }}>CBC — ספירת דם</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {CBC_FIELDS.map(f => renderField('cbc', f))}
      </div>

      <div style={sectionHead}>כימיה</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {CHEM_FIELDS.map(f => renderField('chemistry', f))}
      </div>

      <div style={sectionHead}>קרישה</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {COAG_FIELDS.map(f => renderField('coagulation', f))}
      </div>

      <div style={sectionHead}>בדיקות נוספות</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {OTHER_FIELDS.map(f => renderField('other', f))}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ color: theme.label, fontSize: '0.75rem', fontWeight: 600, marginBottom: 3 }}>
            סוג דם
          </label>
          <input
            type="text"
            value={labs.other?.blood_type ?? ''}
            onChange={e => setField('other', 'blood_type', e.target.value || undefined)}
            placeholder="O+"
            style={{
              background: theme.inputBg,
              border: `1.5px solid ${theme.borderSoft}`,
              borderRadius: 6, padding: '7px 9px',
              color: theme.textHi, fontSize: '0.95rem', fontFamily: 'inherit',
              outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: '0.75rem', color: theme.textDim, lineHeight: 1.6 }}>
        ערכים מחוץ לטווח התקין מסומנים אוטומטית באדום. לחיצה על ⚑ מחליפה סימון ידנית.
      </div>
    </div>
  );
}
