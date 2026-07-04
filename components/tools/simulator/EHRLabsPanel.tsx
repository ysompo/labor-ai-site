'use client';

import { useState } from 'react';
import type { CardLabs } from '@/lib/simulatorTypes';

// ── Public types ──────────────────────────────────────────────────────────────
export interface LabRow {
  id: string;
  timestamp: string;          // "DD/MM/YY HH:MM"
  material: 'דם' | 'שתן';
  labs: CardLabs;
  abnormal_fields: string[];  // keys that should appear red + underlined
}

interface Props {
  rows: LabRow[];
}

// ── Column definitions ────────────────────────────────────────────────────────
interface ColDef {
  key: string;
  label: string;
  get: (labs: CardLabs) => number | undefined;
  digits: number; // decimal places to display
}

const CBC_COLS: ColDef[] = [
  { key: 'wbc',   label: 'WBC',   get: l => l.cbc?.wbc,   digits: 1 },
  { key: 'rbc',   label: 'RBC',   get: l => l.cbc?.rbc,   digits: 2 },
  { key: 'hgb',   label: 'HGB',   get: l => l.cbc?.hgb,   digits: 1 },
  { key: 'hct',   label: 'HCT',   get: l => l.cbc?.hct,   digits: 1 },
  { key: 'mcv',   label: 'MCV',   get: l => l.cbc?.mcv,   digits: 1 },
  { key: 'mch',   label: 'MCH',   get: l => l.cbc?.mch,   digits: 1 },
  { key: 'mchc',  label: 'MCHC',  get: l => l.cbc?.mchc,  digits: 1 },
  { key: 'plt',   label: 'PLT',   get: l => l.cbc?.plt,   digits: 0 },
  { key: 'mpv',   label: 'MPV',   get: l => l.cbc?.mpv,   digits: 1 },
  { key: 'rdw',   label: 'RDW',   get: l => l.cbc?.rdw,   digits: 1 },
];

const CHEM1_COLS: ColDef[] = [
  { key: 'na',  label: 'NA',  get: l => l.chemistry?.na,  digits: 0 },
  { key: 'k',   label: 'K',   get: l => l.chemistry?.k,   digits: 1 },
  { key: 'cl',  label: 'CL',  get: l => l.chemistry?.cl,  digits: 0 },
  { key: 'glu', label: 'GLU', get: l => l.chemistry?.glu, digits: 0 },
  { key: 'bun', label: 'BUN', get: l => l.chemistry?.bun, digits: 1 },
  { key: 'cre', label: 'CRE', get: l => l.chemistry?.cre, digits: 2 },
  { key: 'ca',  label: 'CA',  get: l => l.chemistry?.ca,  digits: 1 },
  { key: 'p',   label: 'P',   get: l => l.chemistry?.p,   digits: 1 },
  { key: 'tp',  label: 'TP',  get: l => l.chemistry?.tp,  digits: 1 },
  { key: 'alb', label: 'ALB', get: l => l.chemistry?.alb, digits: 1 },
  { key: 'alt', label: 'ALT', get: l => l.chemistry?.alt, digits: 0 },
  { key: 'ast', label: 'AST', get: l => l.chemistry?.ast, digits: 0 },
];

const CHEM2_COLS: ColDef[] = [
  { key: 'alk_p', label: 'ALK.P', get: l => l.chemistry?.alk_p, digits: 0 },
  { key: 'ggtp',  label: 'GGTP',  get: l => l.chemistry?.ggtp,  digits: 0 },
  { key: 't_bil', label: 'T.BIL', get: l => l.chemistry?.t_bil, digits: 2 },
  { key: 'd_bil', label: 'D.BIL', get: l => l.chemistry?.d_bil, digits: 2 },
  { key: 'ldh',   label: 'LDH',   get: l => l.chemistry?.ldh,   digits: 0 },
  { key: 'ur_ac', label: 'UR.AC', get: l => l.chemistry?.ur_ac, digits: 1 },
  { key: 'mg',    label: 'MG',    get: l => l.chemistry?.mg,    digits: 1 },
];

const COAG_COLS: ColDef[] = [
  { key: 'pt_pct',  label: 'PT%',   get: l => l.coagulation?.pt_pct,  digits: 1 },
  { key: 'inr',     label: 'INR',   get: l => l.coagulation?.inr,     digits: 2 },
  { key: 'ptt',     label: 'PTT',   get: l => l.coagulation?.ptt,     digits: 1 },
  { key: 'd_dimer', label: 'DIMER', get: l => l.coagulation?.d_dimer, digits: 2 },
  { key: 'fib',     label: 'FIB',   get: l => l.coagulation?.fib,     digits: 0 },
  { key: 'tt',      label: 'TT',    get: l => l.coagulation?.tt,      digits: 1 },
  { key: 'bt',      label: 'BT',    get: l => l.coagulation?.bt,      digits: 0 },
];

// ── Shared table styles ───────────────────────────────────────────────────────
const TH: React.CSSProperties = {
  padding: '6px 12px',
  color: '#1e40af',
  fontWeight: 700,
  fontSize: '0.95rem',
  borderBottom: '2px solid #c7d2fe',
  borderLeft: '1px solid #e5e7eb',
  textAlign: 'center',
  background: '#f0f4ff',
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
};

const TH_META: React.CSSProperties = {
  ...TH,
  textAlign: 'right',
  color: '#374151',
  background: '#f0f0f0',
};

const TD: React.CSSProperties = {
  padding: '6px 12px',
  textAlign: 'center',
  borderLeft: '1px solid #ebebeb',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '1.05rem',
  fontFamily: "'Courier New', monospace",
  whiteSpace: 'nowrap',
};

const TD_META: React.CSSProperties = {
  ...TD,
  fontFamily: 'Arial, sans-serif',
  textAlign: 'right',
  color: '#111',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(value: number | undefined, digits: number): string {
  if (value === undefined || value === null) return '';
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
}

function cellStyle(key: string, abnormalFields: string[]): React.CSSProperties {
  const isAbnormal = abnormalFields.includes(key);
  return {
    ...TD,
    color:          isAbnormal ? '#dc2626' : '#111',
    textDecoration: isAbnormal ? 'underline' : 'none',
    fontWeight:     isAbnormal ? 600 : 400,
  };
}

// ── Section title ─────────────────────────────────────────────────────────────
function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
      <span style={{
        display: 'inline-block',
        border: '2px solid #111',
        borderRadius: 40,
        padding: '3px 28px',
        fontWeight: 700,
        fontSize: '1.15rem',
        color: '#111',
        fontFamily: 'Arial, sans-serif',
        letterSpacing: '0.02em',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Generic lab table ─────────────────────────────────────────────────────────
function LabTable({ title, cols, rows }: { title: string; cols: ColDef[]; rows: LabRow[] }) {
  return (
    <div>
      <SectionTitle label={title} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
          <thead>
            <tr>
              <th style={TH_META}>תאריך שעה</th>
              <th style={{ ...TH_META, textAlign: 'center' }}>חומר</th>
              {cols.map(col => <th key={col.key} style={TH}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.length + 2}
                  style={{ textAlign: 'center', padding: '14px', color: '#9ca3af', fontSize: '1rem' }}
                >
                  אין תוצאות
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f7f7f7' }}>
                  <td style={TD_META}>{row.timestamp}</td>
                  <td style={{ ...TD_META, textAlign: 'center' }}>{row.material}</td>
                  {cols.map(col => (
                    <td key={col.key} style={cellStyle(col.key, row.abnormal_fields)}>
                      {fmt(col.get(row.labs), col.digits)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Chemistry panel (two sub-tables) ─────────────────────────────────────────
function ChemPanel({ rows }: { rows: LabRow[] }) {
  // Only show chem2 table if any row has at least one chem2 value
  const hasChem2 = rows.some(r =>
    r.labs.chemistry?.alk_p !== undefined ||
    r.labs.chemistry?.ldh   !== undefined ||
    r.labs.chemistry?.t_bil !== undefined
  );

  return (
    <div>
      <LabTable title="ביוכימיה" cols={CHEM1_COLS} rows={rows} />
      {hasChem2 && (
        <div style={{ marginTop: 8, borderTop: '1px dashed #e5e7eb' }}>
          <LabTable title="ביוכימיה" cols={CHEM2_COLS} rows={rows} />
        </div>
      )}
    </div>
  );
}

// ── Other tests panel (CRP, PROTEIN/CREATININE) ───────────────────────────────
function OtherPanel({ rows }: { rows: LabRow[] }) {
  // Flatten into individual test rows
  interface TestRow {
    timestamp: string;
    material: string;
    testName: string;
    result: string;
    units: string;
    reference: string;
    isAbnormal: boolean;
  }

  const testRows: TestRow[] = [];

  rows.forEach(row => {
    if (row.labs.other?.crp !== undefined) {
      testRows.push({
        timestamp:  row.timestamp,
        material:   row.material,
        testName:   'CRP',
        result:     row.labs.other.crp.toFixed(2),
        units:      'MG/DL',
        reference:  '0 – 0.5',
        isAbnormal: row.abnormal_fields.includes('crp'),
      });
    }
    if (row.labs.other?.protein_creatinine_ratio !== undefined) {
      testRows.push({
        timestamp:  row.timestamp,
        material:   'שתן',
        testName:   'PROTEIN/CREATININE RATIO',
        result:     String(row.labs.other.protein_creatinine_ratio),
        units:      'mg/g',
        reference:  '0–150 mild · 150–500 moderate · >500 severe',
        isAbnormal: row.abnormal_fields.includes('protein_creatinine_ratio'),
      });
    }
  });

  const headerStyle: React.CSSProperties = { ...TH_META, textAlign: 'center' };

  return (
    <div>
      <SectionTitle label="בדיקות נוספות" />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
          <thead>
            <tr>
              <th style={TH_META}>תאריך</th>
              <th style={headerStyle}>חומר</th>
              <th style={headerStyle}>שם בדיקה</th>
              <th style={headerStyle}>תוצאה</th>
              <th style={headerStyle}>יחידות</th>
              <th style={headerStyle}>ע. ייחוס</th>
              <th style={headerStyle}>הערות</th>
            </tr>
          </thead>
          <tbody>
            {testRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 14, color: '#9ca3af', fontSize: '1rem' }}>
                  אין תוצאות
                </td>
              </tr>
            ) : (
              testRows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7f7f7' }}>
                  <td style={TD_META}>{r.timestamp}</td>
                  <td style={{ ...TD_META, textAlign: 'center' }}>{r.material}</td>
                  <td style={{ ...TD_META, textAlign: 'center', fontWeight: 700 }}>{r.testName}</td>
                  <td style={{
                    ...TD,
                    textAlign: 'center',
                    color: r.isAbnormal ? '#dc2626' : '#111',
                    textDecoration: r.isAbnormal ? 'underline' : 'none',
                    fontWeight: r.isAbnormal ? 700 : 400,
                  }}>
                    {r.result}
                  </td>
                  <td style={{ ...TD, textAlign: 'center', color: '#6b7280' }}>{r.units}</td>
                  <td style={{ ...TD, textAlign: 'right', color: '#1e40af', fontSize: '0.85rem', direction: 'ltr' }}>{r.reference}</td>
                  <td style={{ ...TD, textAlign: 'right' }} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type TabKey = 'cbc' | 'chem' | 'coag' | 'other';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'cbc',   label: 'ספירה' },
  { key: 'chem',  label: 'ביוכימיה' },
  { key: 'coag',  label: 'מנגנון קרישה' },
  { key: 'other', label: 'בדיקות נוספות' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function EHRLabsPanel({ rows }: Props) {
  const [tab, setTab] = useState<TabKey>('cbc');

  return (
    <div
      style={{
        background: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 12px',
          background: '#f3f4f6',
          borderBottom: '1px solid #d1d5db',
          flexShrink: 0,
        }}
      >
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 18px',
              borderRadius: 20,
              border:      tab === t.key ? '1.5px solid #1e40af' : '1px solid #d1d5db',
              background:  tab === t.key ? '#dbeafe' : '#fff',
              color:       tab === t.key ? '#1e40af' : '#6b7280',
              fontWeight:  tab === t.key ? 700 : 400,
              fontSize:    '1rem',
              cursor:      'pointer',
              transition:  'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {tab === 'cbc'   && <LabTable title="ספירה"          cols={CBC_COLS}  rows={rows} />}
        {tab === 'chem'  && <ChemPanel rows={rows} />}
        {tab === 'coag'  && <LabTable title="מנגנון קרישה"  cols={COAG_COLS} rows={rows} />}
        {tab === 'other' && <OtherPanel rows={rows} />}
      </div>
    </div>
  );
}
