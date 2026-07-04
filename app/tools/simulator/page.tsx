'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { CTGParams, VitalSigns, PatientInfo, LiveOverrideParams, PushedLabRow } from '@/lib/simulatorTypes';
import { CTG_PRESETS } from '@/lib/ctgPresets';
import { SEEDED_SCENARIOS } from '@/lib/simulatorScenarios';
import type { LabRow } from '@/components/tools/simulator/EHRLabsPanel';
import PatientBanner from '@/components/tools/simulator/PatientBanner';
import VitalSignsDisplay from '@/components/tools/simulator/VitalSignsDisplay';
import InstructorControls from '@/components/tools/simulator/InstructorControls';
import { AudioEngine } from '@/components/tools/simulator/AudioEngine';
import { lsLoad, lsAdd } from '@/lib/localStaffStore';
import LiveOverridePanel from '@/components/tools/simulator/LiveOverridePanel';
import NoteSystem, { type NoteEntry } from '@/components/tools/simulator/NoteSystem';
import { useSimTheme, ThemeToggleButton } from '@/components/tools/simulator/SimThemeProvider';

const CTGMonitor        = dynamic(() => import('@/components/tools/simulator/CTGMonitor'),                         { ssr: false });
const EHRLabsPanel      = dynamic(() => import('@/components/tools/simulator/EHRLabsPanel'),                       { ssr: false });
const VideoRecorder     = dynamic(() => import('@/components/tools/simulator/VideoRecorder'),                      { ssr: false });
const DebriefView       = dynamic(() => import('@/components/tools/simulator/DebriefView'),                        { ssr: false });
const AssessmentForm    = dynamic(() => import('@/components/tools/simulator/AssessmentForm'),                     { ssr: false });
const ScenarioCardEditor = dynamic(() => import('@/components/tools/simulator/admin/ScenarioCardEditor'),          { ssr: false });
const LabsPushPanel      = dynamic(() => import('@/components/tools/simulator/LabsPushPanel'),                     { ssr: false });

// ── Local types ─────────────────────────────────────────────────────────────
interface VideoClip {
  id: string;
  deviceRole: string;
  startSeconds: number;
  endSeconds: number;
  blobUrl: string;
}

interface TimelineEvent {
  id: string;
  timeSeconds: number;
  type: 'start' | 'card' | 'override' | 'note' | 'end';
  label: string;
  detail?: string;
}

interface ScenarioCard {
  card_number: number;
  title: string;
  clinical_description: string;
  structured_data: {
    patient?: PatientInfo;
    ctg?: CTGParams;
    vitals?: VitalSigns;
    labs?: LabRow['labs'];
    abnormal_fields?: string[];
  };
}

interface Scenario {
  id: number;
  name: string;
  case_story: string;
  expected_actions?: string;
  cards: ScenarioCard[];
}

type SimPhase = 'setup' | 'running' | 'debrief' | 'assessment';

const DEFAULT_PATIENT: PatientInfo = {
  name: '—', age: 0, gravida: 0, para: 0,
  gestational_weeks: 0, gestational_days: 0,
};
const DEFAULT_CTG    = CTG_PRESETS.normal.ctg;
const DEFAULT_VITALS = CTG_PRESETS.normal.vitals;

// ── Setup screen ────────────────────────────────────────────────────────────
// ── Patient edit modal ───────────────────────────────────────────────────────
function PatientEditModal({ patient, onSave, onClose }: {
  patient: PatientInfo;
  onSave: (p: PatientInfo) => void;
  onClose: () => void;
}) {
  const { theme } = useSimTheme();
  const [form, setForm] = useState<PatientInfo>({ ...patient });

  const field = (label: string, key: keyof PatientInfo, type = 'text', min?: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ color: theme.label, fontSize: '0.7rem', fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        min={min}
        value={(form[key] as string | number) ?? ''}
        onChange={e => setForm(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        style={{ background: theme.inputBg, border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: '6px 8px', color: theme.textHi, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
      />
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div dir="rtl" style={{ background: theme.surfaceRaised, border: `1px solid ${theme.borderSoft}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, color: theme.textHi, boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: theme.label }}>✎ עדכון פרטי מטופלת</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1.1rem', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('שם', 'name')}
          {field('גיל', 'age', 'number', 0)}
          {field('גרבידה (G)', 'gravida', 'number', 0)}
          {field('פרה (P)', 'para', 'number', 0)}
          {field('שבועות הריון', 'gestational_weeks', 'number', 0)}
          {field('ימים', 'gestational_days', 'number', 0)}
          {field('סוג דם', 'blood_type')}
          {field('אלרגיות', 'allergies')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 12 }}>
          <label style={{ color: theme.label, fontSize: '0.7rem', fontWeight: 600 }}>היסטוריה</label>
          <textarea
            value={form.history ?? ''}
            onChange={e => setForm(prev => ({ ...prev, history: e.target.value }))}
            rows={2}
            style={{ background: theme.inputBg, border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: '6px 8px', color: theme.textHi, fontSize: '0.82rem', resize: 'none', fontFamily: 'inherit', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={() => onSave(form)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            שמור
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(156,163,175,0.3)', background: theme.surface, color: theme.textDim, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

interface StaffMember { id: number; name: string; role: string; email?: string; active?: boolean; }

const acInputStyle = (theme: import('@/lib/simTheme').SimTheme): React.CSSProperties => ({
  width: '100%', background: theme.inputBg,
  border: `1px solid ${theme.borderSoft}`, borderRadius: 7,
  padding: '8px 10px', color: theme.textHi, fontSize: '0.95rem',
  boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl', outline: 'none',
});

function ParticipantAutocomplete({ value, onChange, staff, role, placeholder, onStaffAdded }: {
  value: string;
  onChange: (v: string) => void;
  staff: StaffMember[];
  role: string;
  placeholder: string;
  onStaffAdded: (s: StaffMember) => void;
}) {
  const { theme } = useSimTheme();
  const [query, setQuery]       = useState(value);
  const [open, setOpen]         = useState(false);
  const [addMode, setAddMode]   = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving]     = useState(false);

  // Keep query in sync when parent resets value (e.g. handleLeaveConfirmed)
  useEffect(() => { setQuery(value); }, [value]);

  const filtered   = staff.filter(s => !query || s.name.includes(query));
  const isNew      = !!query.trim() && !staff.some(s => s.name === query.trim());

  const select = (name: string) => {
    setQuery(name); onChange(name); setOpen(false); setAddMode(false);
  };

  const handleAdd = async () => {
    const name = query.trim();
    if (!name) return;
    setSaving(true);
    const res  = await fetch('/api/simulator/staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, email: newEmail }),
    });
    const data = await res.json() as { staff?: StaffMember; mock?: boolean };
    if (data.staff) {
      // If DB is not configured, persist to localStorage so the roster page shows it
      if (data.mock) lsAdd({ name: data.staff.name, role: data.staff.role, email: data.staff.email ?? '', active: true });
      onStaffAdded(data.staff); onChange(name); setAddMode(false); setOpen(false); setNewEmail('');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        placeholder={placeholder}
        style={acInputStyle(theme)}
        autoComplete="off"
      />

      {/* Dropdown */}
      {open && !addMode && (filtered.length > 0 || isNew) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: theme.surfaceRaised, border: `1px solid ${theme.borderSoft}`,
          borderRadius: 7, marginTop: 2, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: 200, overflowY: 'auto',
        }}>
          {filtered.slice(0, 10).map(s => (
            <div
              key={s.id}
              onMouseDown={() => select(s.name)}
              style={{
                padding: '8px 12px', cursor: 'pointer', color: theme.textHi, fontSize: '0.85rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: `1px solid ${theme.borderSoft}`,
              }}
            >
              <span>{s.name}</span>
              {s.email && <span style={{ color: theme.textDim, fontSize: '0.68rem' }}>✉ {s.email}</span>}
            </div>
          ))}
          {isNew && (
            <div
              onMouseDown={() => { setAddMode(true); setOpen(false); }}
              style={{
                padding: '8px 12px', cursor: 'pointer', color: theme.label, fontSize: '0.8rem',
                borderTop: filtered.length > 0 ? `1px solid ${theme.borderSoft}` : undefined,
                background: theme.accentSoft,
              }}
            >
              ➕ הוסף &quot;{query.trim()}&quot; לרשימה
            </div>
          )}
        </div>
      )}

      {/* Inline "add to roster" email prompt */}
      {addMode && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="אימייל (אופציונלי)"
            style={{ ...acInputStyle(theme), flex: 1, fontSize: '0.85rem', padding: '6px 10px' }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddMode(false); }}
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{ background: theme.chipBg, border: `1px solid ${theme.borderSoft}`, borderRadius: 7, color: theme.lilac, fontSize: '0.8rem', cursor: 'pointer', padding: '0 12px', fontFamily: 'inherit' }}
          >
            {saving ? '...' : 'הוסף'}
          </button>
          <button
            onClick={() => setAddMode(false)}
            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: '0 6px', fontSize: '0.9rem' }}
          >✕</button>
        </div>
      )}
    </div>
  );
}

function SetupScreen({
  scenarios, selectedScenario, onSelectScenario,
  residentName, onResidentName,
  midwifeName, onMidwifeName,
  seniorDoctor, onSeniorDoctor,
  chargeMidwife, onChargeMidwife,
  observers, onObserversChange,
  onEmailsChange,
  onStart, creating,
  isAdmin, onEditScenario,
}: {
  scenarios: Scenario[];
  selectedScenario: Scenario | null;
  onSelectScenario: (s: Scenario) => void;
  residentName: string;  onResidentName:  (v: string) => void;
  midwifeName: string;   onMidwifeName:   (v: string) => void;
  seniorDoctor: string;  onSeniorDoctor:  (v: string) => void;
  chargeMidwife: string; onChargeMidwife: (v: string) => void;
  observers: string[];   onObserversChange: (v: string[]) => void;
  onEmailsChange: (emails: string[]) => void;
  onStart: () => void;
  creating: boolean;
  isAdmin?: boolean;
  onEditScenario?: (s: Scenario) => void;
}) {
  const { theme } = useSimTheme();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const handleStaffAdded = useCallback((s: StaffMember) => {
    setStaffList(prev => [...prev, s]);
  }, []);

  useEffect(() => {
    fetch('/api/simulator/staff')
      .then(r => r.json())
      .then((d: { staff?: StaffMember[]; mock?: boolean }) => {
        if (d.mock) {
          // DB not configured — use localStorage roster
          setStaffList(lsLoad().filter(s => s.active !== false));
        } else {
          setStaffList(d.staff ?? []);
        }
      })
      .catch(() => {});
  }, []);

  // Bubble up emails whenever any participant selection changes
  useEffect(() => {
    const names = [residentName, midwifeName, seniorDoctor, chargeMidwife, ...observers].filter(Boolean);
    const emails = names
      .map(name => staffList.find(s => s.name === name)?.email)
      .filter((e): e is string => !!e && e.includes('@'));
    onEmailsChange(emails);
  }, [residentName, midwifeName, seniorDoctor, chargeMidwife, observers, staffList, onEmailsChange]);

  const residents      = staffList.filter(s => s.role.includes('מתמחה'));
  const midwives       = staffList.filter(s => s.role.includes('מיילדת') && !s.role.includes('אחראית'));
  const seniorDoctors  = staffList.filter(s => s.role.includes('בכיר') || s.role.includes('מומחה') || s.role.includes('רופא'));
  const chargeMidwives = staffList.filter(s => s.role.includes('אחראית'));

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: theme.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", overflowY: 'auto' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Link href="/" style={{ color: theme.success, fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>← חזרה לעמוד הבית</Link>
            <h1 style={{ color: theme.textHi, fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>🏥 הגדרת סימולציה</h1>
            <p style={{ color: theme.textDim, fontSize: '0.9rem', margin: '6px 0 0' }}>Labor-AI Lab · Hadassah Mount Scopus</p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/tools/simulator/history" style={{ color: theme.label, fontSize: '0.9rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>📋 היסטוריה</Link>
            <Link href="/tools/simulator/roster" style={{ color: theme.success, fontSize: '0.9rem', textDecoration: 'none' }}>👥 רשימה</Link>
            <Link href="/admin/users" style={{ color: theme.accent, fontSize: '0.9rem', textDecoration: 'none' }}>⚙ ניהול →</Link>
            <ThemeToggleButton />
          </div>
        </div>

        <div className="sim-setup-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* Scenario list */}
          <div>
            <div style={{ color: theme.label, fontSize: '0.95rem', fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>בחירת תרחיש</div>
            {scenarios.length === 0 ? (
              <div style={{ color: theme.textDim, fontSize: '0.95rem', padding: 20, textAlign: 'center' }}>⏳ טוען תרחישים...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scenarios.map(s => {
                  const active = selectedScenario?.id === s.id;
                  return (
                    <div key={s.id} style={{ position: 'relative' }}>
                      <button
                        onClick={() => onSelectScenario(s)}
                        style={{
                          width: '100%', textAlign: 'right',
                          padding: '16px 48px 16px 18px',
                          borderRadius: 10, cursor: 'pointer',
                          border:      active ? `1.5px solid ${theme.accent}` : `1px solid ${theme.borderSoft}`,
                          background:  active ? theme.chipBg : theme.surface,
                          color:       active ? theme.lilac : theme.text,
                          fontFamily: 'inherit', direction: 'rtl',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>{s.name}</div>
                        <div style={{ fontSize: '0.92rem', color: theme.textDim, lineHeight: 1.6 }}>
                          {s.case_story?.slice(0, 170)}{s.case_story?.length > 170 ? '...' : ''}
                        </div>
                        {active && s.expected_actions && (
                          <div style={{ marginTop: 8, fontSize: '0.85rem', color: theme.accent, borderTop: `1px solid ${theme.borderSoft}`, paddingTop: 6 }}>
                            ✅ {s.expected_actions.slice(0, 120)}
                          </div>
                        )}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onEditScenario?.(s); }}
                        title="ערוך כרטיסי תרחיש"
                        style={{
                          position: 'absolute', top: 8, left: 8,
                          width: 34, height: 34, borderRadius: 8,
                          border: `1px solid ${theme.borderSoft}`,
                          background: theme.chipBg,
                          color: theme.label, fontSize: '0.9rem',
                          cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          lineHeight: 1,
                        }}
                      >
                        ✎
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: form + start */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Participants */}
            <div style={{ background: theme.surface, border: `1px solid ${theme.borderSoft}`, borderRadius: 12, padding: 16 }}>
              <div style={{ color: theme.label, fontSize: '0.78rem', fontWeight: 700, marginBottom: 12 }}>משתתפים</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ color: theme.textDim, fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>מתמחה</label>
                  <ParticipantAutocomplete
                    value={residentName}
                    onChange={onResidentName}
                    staff={residents.length ? residents : staffList}
                    role="מתמחה"
                    placeholder="— בחר או הקלד שם —"
                    onStaffAdded={handleStaffAdded}
                  />
                </div>
                <div>
                  <label style={{ color: theme.textDim, fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>מיילדת</label>
                  <ParticipantAutocomplete
                    value={midwifeName}
                    onChange={onMidwifeName}
                    staff={midwives.length ? midwives : staffList}
                    role="מיילדת"
                    placeholder="— בחר או הקלד שם —"
                    onStaffAdded={handleStaffAdded}
                  />
                </div>
                <div>
                  <label style={{ color: theme.textDim, fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>רופא מומחה</label>
                  <ParticipantAutocomplete
                    value={seniorDoctor}
                    onChange={onSeniorDoctor}
                    staff={seniorDoctors.length ? seniorDoctors : staffList}
                    role="רופא בכיר"
                    placeholder="— בחר או הקלד שם —"
                    onStaffAdded={handleStaffAdded}
                  />
                </div>
                <div>
                  <label style={{ color: theme.textDim, fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>מיילדת אחראית</label>
                  <ParticipantAutocomplete
                    value={chargeMidwife}
                    onChange={onChargeMidwife}
                    staff={chargeMidwives.length ? chargeMidwives : staffList}
                    role="מיילדת אחראית"
                    placeholder="— בחר או הקלד שם —"
                    onStaffAdded={handleStaffAdded}
                  />
                </div>
              </div>

              {/* Observers */}
              <div style={{ marginTop: 14, borderTop: `1px solid ${theme.borderSoft}`, paddingTop: 12 }}>
                <div style={{ color: theme.textDim, fontSize: '0.72rem', marginBottom: 8 }}>
                  נוכחים (ללא הערכה)
                </div>
                {observers.map((name, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <ParticipantAutocomplete
                        value={name}
                        onChange={v => { const next = [...observers]; next[i] = v; onObserversChange(next); }}
                        staff={staffList}
                        role="משקיף"
                        placeholder={`— משקיף ${i + 1} —`}
                        onStaffAdded={handleStaffAdded}
                      />
                    </div>
                    <button
                      onClick={() => onObserversChange(observers.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1rem', padding: '0 4px', alignSelf: 'center' }}
                    >✕</button>
                  </div>
                ))}
                <button
                  onClick={() => onObserversChange([...observers, ''])}
                  style={{ background: theme.surface, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 7, color: theme.textDim, fontSize: '0.75rem', cursor: 'pointer', padding: '6px 12px', width: '100%', fontFamily: 'inherit' }}
                >
                  + הוסף משקיף
                </button>
              </div>
            </div>

            {/* Selected scenario summary */}
            {selectedScenario && (
              <div style={{ background: theme.accentSoft, border: `1px solid ${theme.borderSoft}`, borderRadius: 10, padding: '10px 12px', fontSize: '0.72rem', color: theme.textDim }}>
                <div style={{ color: theme.lilac, fontWeight: 700, marginBottom: 4 }}>{selectedScenario.name}</div>
                <div>{selectedScenario.cards.length} כרטיסים</div>
              </div>
            )}

            {/* Join ongoing session */}
            <Link
              href="/tools/simulator/participant"
              style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                background: theme.chipBg, border: `1px solid ${theme.borderSoft}`,
                borderRadius: 10, padding: '11px 0', fontSize: '0.88rem', fontWeight: 700,
                color: theme.lilac, fontFamily: 'inherit',
              }}
            >
              📱 הצטרף לסימולציה פעילה
            </Link>

            {/* Start button */}
            <button
              onClick={onStart}
              disabled={!selectedScenario || creating}
              style={{
                background: !selectedScenario || creating ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '14px 0', fontSize: '1rem', fontWeight: 700,
                cursor: !selectedScenario || creating ? 'not-allowed' : 'pointer',
                opacity: !selectedScenario || creating ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              {creating ? '⏳ יוצר סשן...' : '▶ התחל סימולציה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main simulator inner component ──────────────────────────────────────────
function SimulatorPageInner({ urlCode, urlRole }: { urlCode: string | null; urlRole: string }) {
  const { theme } = useSimTheme();
  const isMidwife = urlRole === 'midwife_instructor';
  const router = useRouter();

  // Phase
  const [phase, setPhase]   = useState<SimPhase>(urlCode ? 'running' : 'setup');
  const [sessionCode, setSessionCode] = useState<string>(urlCode ?? '');

  // Admin state (read from sim_meta cookie)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      const raw = document.cookie.split(';').find(c => c.trim().startsWith('sim_meta='));
      if (raw) {
        const meta = JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('='))) as { isAdmin?: boolean };
        setIsAdmin(!!meta.isAdmin);
      }
    } catch { /* ignore */ }
  }, []);

  // Scenarios
  // Pre-populate with seeded scenarios so the list shows immediately on slow devices (iPad).
  // The useEffect below will overwrite with DB data if available.
  const [scenarios, setScenarios] = useState<Scenario[]>(
    () => SEEDED_SCENARIOS.map((s, i) => ({ id: i + 1, ...s } as unknown as Scenario))
  );
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  // Scenario card editor (admin only)
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const handleScenarioSaved = useCallback((updated: Scenario) => {
    setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedScenario(prev => prev?.id === updated.id ? updated : prev);
    setEditingScenario(null);
  }, []);
  const [currentCard, setCurrentCard]       = useState(1);

  // JS diagnostic (temporary — shows user agent on setup screen to confirm hydration)
  const [jsDbg, setJsDbg] = useState('...');
  useEffect(() => {
    setJsDbg(navigator.userAgent.slice(0, 80));
  }, []);

  // Simulation state
  const [isRunning, setIsRunning]   = useState(false);
  const [simTime, setSimTime]       = useState(0);
  const [ctgParams, setCtgParams]   = useState<CTGParams>(DEFAULT_CTG);
  const [hasCTG, setHasCTG]         = useState(true);
  const [vitals, setVitals]         = useState<VitalSigns>(DEFAULT_VITALS);
  const [patient, setPatient]       = useState<PatientInfo>(DEFAULT_PATIENT);
  const [currentFHR, setCurrentFHR] = useState(DEFAULT_CTG.fhr_baseline);
  const [labRows, setLabRows]       = useState<LabRow[]>([]);
  const [isMuted, setIsMuted]       = useState(true); // instructor/midwife default: muted

  // Panels / overlays
  const [overrideOpen, setOverrideOpen]     = useState(false);
  const [labsPushOpen, setLabsPushOpen]     = useState(false);
  const [ctgResetKey, setCtgResetKey]         = useState(0);
  const [ctgRetroactiveKey, setCtgRetroactiveKey] = useState(0);
  const [patientEditOpen, setPatientEditOpen]   = useState(false);
  const [confirmEndOpen, setConfirmEndOpen]     = useState(false);
  const [qrOpen, setQrOpen]                 = useState<null | 'trainee' | 'midwife'>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [videoClips, setVideoClips]         = useState<VideoClip[]>([]);

  // Notes
  const [notes, setNotes]               = useState<NoteEntry[]>([]);
  const [notepadContent, setNotepadContent] = useState('');
  const [noteFormTrigger, setNoteFormTrigger] = useState(0);

  // Timeline for debrief
  const [timeline, setTimeline]         = useState<TimelineEvent[]>([]);

  // Assessment
  const [showAssessment, setShowAssessment] = useState(false);


  // Portrait mode detection for Android
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setPortrait(window.innerWidth < window.innerHeight);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // Setup form
  const [residentName, setResidentName]       = useState('');
  const [midwifeName, setMidwifeName]         = useState('');
  const [seniorDoctor, setSeniorDoctor]       = useState('');
  const [chargeMidwife, setChargeMidwife]     = useState('');
  const [observers, setObservers]             = useState<string[]>([]);
  const [participantEmails, setParticipantEmails] = useState<string[]>([]);
  const [creating, setCreating]               = useState(false);

  // Refs
  const timerRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const pusherRef              = useRef<import('@/components/tools/simulator/PusherSync').PusherSync | null>(null);
  const audioEngineRef         = useRef<AudioEngine | null>(null);
  const simTimeRef             = useRef(0);
  const currentCardRef     = useRef(0);
  const isRunningRef       = useRef(false);
  const selectedScenarioRef  = useRef<typeof selectedScenario>(null);
  const ctgParamsRef         = useRef<CTGParams>(DEFAULT_CTG);
  const vitalsRef            = useRef<VitalSigns>(DEFAULT_VITALS);
  // Live-pushed lab rows — carried in every snapshot so late joiners replay them
  const pushedLabsRef        = useRef<PushedLabRow[]>([]);
  const seenPushIds          = useRef<Set<string>>(new Set());
  // Simulation speed — clinical seconds per real second (live-adjustable)
  const [simSpeed, setSimSpeedState] = useState(5);
  const simSpeedRef          = useRef(5);

  // Keep refs in sync — used in heartbeat/request-state so they always have current values
  useEffect(() => { simTimeRef.current = simTime; }, [simTime]);
  useEffect(() => { currentCardRef.current = currentCard; }, [currentCard]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { selectedScenarioRef.current = selectedScenario; }, [selectedScenario]);
  useEffect(() => { ctgParamsRef.current = ctgParams; }, [ctgParams]);
  useEffect(() => { vitalsRef.current = vitals; }, [vitals]);

  // ── Audio engine (instructor/midwife hear CTG; default muted) ───────────────
  const ensureAudio = useCallback(async (): Promise<AudioEngine> => {
    if (audioEngineRef.current) return audioEngineRef.current;
    const engine = new AudioEngine();
    await engine.initialize();
    audioEngineRef.current = engine;
    return engine;
  }, []);

  // Start/stop beeping whenever running or muted state changes
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    if (isRunning && !isMuted) {
      engine.startBeeping();
    } else {
      engine.stopBeeping();
    }
  }, [isRunning, isMuted]);

  // Dispose on unmount
  useEffect(() => {
    return () => { audioEngineRef.current?.dispose(); };
  }, []);

  // ── Navigation guard (refresh / back button) ───────────────────────────────
  // Block accidental navigation while a simulation is running.

  // Block refresh / tab-close with native browser dialog
  useEffect(() => {
    if (phase !== 'running' || !isRunning) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase, isRunning]);

  // Block browser back button — push a guard entry, intercept popstate
  useEffect(() => {
    if (phase !== 'running' || !isRunning) return;
    const guardUrl = window.location.href;
    window.history.pushState(null, '', guardUrl); // push guard entry
    const onPopState = () => {
      window.history.pushState(null, '', guardUrl); // restore URL
      if (isRunningRef.current) setLeaveConfirmOpen(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [phase, isRunning]);

  // ── localStorage helper — synchronous, always current ────────────────────
  const saveRestore = useCallback((patch: Partial<{ code: string; scenarioId: number; isRunning: boolean; currentCard: number; simTime: number }>) => {
    try {
      const prev = JSON.parse(localStorage.getItem('sim_restore') ?? '{}') as Record<string, unknown>;
      localStorage.setItem('sim_restore', JSON.stringify({ ...prev, ...patch }));
    } catch { /* ignore */ }
  }, []);

  // ── Load scenarios ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/simulator/scenarios')
      .then(r => r.json())
      .then(d => setScenarios(d.scenarios ?? []))
      .catch(() => {});
  }, []);

  // ── React to URL code disappearing (back button / Next.js navigation) ──────
  // Show confirm instead of immediately destroying the session.
  // Require sessionCode too — avoids false trigger during the race between
  // setPhase('running') and the async URL update from router.push.
  useEffect(() => {
    if (!urlCode && sessionCode && phase === 'running' && isRunning) {
      setLeaveConfirmOpen(true);
    }
  }, [urlCode, sessionCode, phase, isRunning]);

  // ── Restore state after page refresh (urlCode present, scenario not loaded) ─
  useEffect(() => {
    if (!urlCode || selectedScenario) return;
    let cancelled = false;

    // 1. Try localStorage first — works without DB, same device
    try {
      const raw = localStorage.getItem('sim_restore');
      if (raw) {
        const stored = JSON.parse(raw) as { code?: string; scenarioId?: number; isRunning?: boolean; currentCard?: number; simTime?: number };
        if (stored.code === urlCode && stored.scenarioId) {
          const found = scenarios.find(s => s.id === stored.scenarioId) ?? null;
          if (found) {
            const cardNum = stored.currentCard ?? 1;
            setSelectedScenario(found);
            if (cardNum > 1) setCurrentCard(cardNum);
            if (stored.simTime) setSimTime(stored.simTime);
            if (stored.isRunning) { setIsRunning(true); setPhase('running'); }
            // Restore CTG params from the scenario card so the trace uses correct parameters
            const card = found.cards.find((c: { card_number: number }) => c.card_number === cardNum);
            const sd = (card as { structured_data?: { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo } | null } | undefined)?.structured_data;
            if (sd?.ctg)    { setCtgParams(sd.ctg); setHasCTG(true); }
            if (sd?.vitals) setVitals(sd.vitals);
            if (sd?.patient) setPatient(prev => ({ ...prev, ...sd.patient }));
            // Retroactively regenerate the CTG trace with the restored params
            setCtgRetroactiveKey(k => k + 1);
            
            return; // localStorage was enough
          }
        }
      }
    } catch { /* localStorage unavailable */ }

    // 2. Fallback: try DB (works when POSTGRES_URL is configured)
    
    (async () => {
      try {
        const sRes = await fetch(`/api/simulator/sessions/${urlCode}`);
        if (!sRes.ok || cancelled) { return; }
        const sData = await sRes.json() as {
          session?: {
            scenario_id?: number; status?: string; sim_time_seconds?: number;
            current_state?: { cardNumber?: number; structuredData?: { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo; } | null; } | null;
          }
        };
        const session = sData.session;
        if (!session?.scenario_id || cancelled) { return; }
        
        const found = scenarios.find(s => s.id === session.scenario_id) ?? null;
        if (found && !cancelled) setSelectedScenario(found);
        const snap = session.current_state;
        if (snap && (snap.cardNumber ?? 0) > 0 && !cancelled) {
          setCurrentCard(snap.cardNumber!);
          const d = snap.structuredData;
          if (d?.ctg) { setCtgParams(d.ctg); setHasCTG(true); }
          if (d?.vitals) setVitals(d.vitals);
          if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
        }
        if (session.sim_time_seconds && !cancelled) setSimTime(session.sim_time_seconds);
        if (session.status === 'running' && !cancelled) { setIsRunning(true); setPhase('running'); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, scenarios]);

  // ── Wall-clock timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setSimTime(t => t + simSpeedRef.current), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // Extra fields carried on every state-snapshot: live-pushed labs history
  // (late joiners replay it) + the opening vignette for the trainee popup.
  const snapshotExtras = useCallback(() => ({
    pushedLabs:   pushedLabsRef.current,
    caseStory:    selectedScenarioRef.current?.case_story ?? '',
    scenarioName: selectedScenarioRef.current?.name ?? '',
    simSpeed:     simSpeedRef.current,
  }), []);

  // Live simulation-speed change — broadcast so every device's clock and CTG
  // advance at the same rate. Snapshots carry simSpeed for late joiners.
  const handleSpeedChange = useCallback((speed: number) => {
    simSpeedRef.current = speed;
    setSimSpeedState(speed);
    pusherRef.current?.publish({ type: 'speed-change', simSpeed: speed });
    const sc = sessionCode;
    if (sc) {
      const scenario = selectedScenarioRef.current;
      const cardNum  = currentCardRef.current;
      const card = scenario?.cards.find(c => c.card_number === cardNum);
      const baseSD = card ? { ...(card.structured_data ?? {}), clinical_description: card.clinical_description ?? '', card_title: card.title } : {};
      const sd = { ...baseSD, ctg: ctgParamsRef.current, vitals: vitalsRef.current };
      fetch(`/api/sim-state/${sc}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'state-snapshot', cardNumber: cardNum, structuredData: sd, isRunning: isRunningRef.current, simTimeSeconds: simTimeRef.current, wallClockMs: Date.now(), ...snapshotExtras() }),
      }).catch(() => {});
    }
  }, [sessionCode, snapshotExtras]);

  // ── Heartbeat: broadcast full state every 5s so late joiners catch up ─────
  useEffect(() => {
    if (!isRunning || !sessionCode) return;
    const broadcast = () => {
      const scenario = selectedScenarioRef.current;
      const cardNum  = currentCardRef.current;
      const card = scenario?.cards.find(c => c.card_number === cardNum);
      const baseStructuredData = card
        ? (card.structured_data
            ? { ...card.structured_data, clinical_description: card.clinical_description ?? '', card_title: card.title }
            : { clinical_description: card.clinical_description ?? '', card_title: card.title })
        : null;
      // Always use the live evaluator state for CTG + vitals so polling clients
      // (iPad vanilla JS) receive every override, not just the static card data.
      const structuredData = {
        ...(baseStructuredData ?? {}),
        ctg:    ctgParamsRef.current,
        vitals: vitalsRef.current,
      };
      const snapshot = {
        type: 'state-snapshot' as const,
        cardNumber: cardNum,
        structuredData,
        isRunning: isRunningRef.current,
        simTimeSeconds: simTimeRef.current,
        wallClockMs: Date.now(),
        ...snapshotExtras(),
      };
      pusherRef.current?.publish(snapshot);
      // Write to DB-backed sim-state (works across serverless instances)
      fetch(`/api/sim-state/${sessionCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      }).catch(() => {});
    };
    let heartbeatCount = 0;
    const broadcastAndSave = () => {
      broadcast();
      heartbeatCount++;
      // Every ~30s: persist sim time so refresh restores accurate position
      if (heartbeatCount % 6 === 0) {
        saveRestore({ simTime: simTimeRef.current });
        fetch(`/api/simulator/sessions/${sessionCode}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-role': 'instructor' },
          body: JSON.stringify({ sim_time_seconds: simTimeRef.current }),
        }).catch(() => {});
      }
    };
    broadcast(); // immediate on start/resume
    const id = setInterval(broadcastAndSave, 5000);
    return () => clearInterval(id);
  }, [isRunning, sessionCode, saveRestore, snapshotExtras]);

  // ── FHR → audio ───────────────────────────────────────────────────────────

  // ── Pusher init when session code appears ─────────────────────────────────
  useEffect(() => {
    if (!sessionCode) return;
    let unsub: (() => void) | undefined;

    import('@/components/tools/simulator/PusherSync').then(({ PusherSync }) => {
      const sync = new PusherSync(sessionCode);
      pusherRef.current = sync;

      unsub = sync.subscribe(event => {
        if (event.type === 'timer-control') {
          if (event.action === 'start' || event.action === 'resume') {
            setIsRunning(true);
          } else {
            setIsRunning(false);
          }
        }
        if (event.type === 'card-advance') {
          const d = event.structuredData as ScenarioCard['structured_data'] | null;
          if (d?.ctg) { setCtgParams(d.ctg); setHasCTG(true); } else setHasCTG(false);
          if (d?.vitals) setVitals(d.vitals);
          if (d?.patient) setPatient(d.patient);
          if (d?.labs) {
            const row: LabRow = {
              id:              `card_${event.cardNumber}_${Date.now()}`,
              timestamp:       new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
              material:        'דם',
              labs:            d.labs,
              abnormal_fields: d.abnormal_fields ?? [],
            };
            setLabRows(prev => [...prev, row]);
          }
        }
        if (event.type === 'live-override') {
          // handled locally by handleOverride — no-op here (Pusher echoes are ignored)
        }
        if (event.type === 'speed-change') {
          simSpeedRef.current = event.simSpeed;
          setSimSpeedState(event.simSpeed);
        }
        if (event.type === 'labs-push') {
          // Covers the midwife-observer instance; the sending instructor is deduped
          const row = event.row;
          if (!seenPushIds.current.has(row.id)) {
            seenPushIds.current.add(row.id);
            setLabRows(prev => [...prev, {
              id: row.id,
              timestamp: row.timestamp,
              material: row.material ?? 'דם',
              labs: row.labs,
              abnormal_fields: row.abnormal_fields,
            }]);
          }
        }
        if (event.type === 'note-added') {
          const n: NoteEntry = {
            id:       `sync_${Date.now()}_${Math.random()}`,
            simTime:  event.simTime,
            author:   event.author,
            content:  event.text,
            tagType:  event.tagType,
            isQuickTag: event.isQuickTag,
          };
          setNotes(prev => [...prev, n]);
        }
        if (event.type === 'session-end') {
          setIsRunning(false);
          setPhase('debrief');
        }
        if (event.type === 'state-snapshot' && isMidwife) {
          const d = event.structuredData as ScenarioCard['structured_data'] & { clinical_description?: string; card_title?: string } | null;
          if (d?.ctg) { setCtgParams(d.ctg); setHasCTG(true); } else if (d) setHasCTG(false);
          if (d?.vitals) setVitals(d.vitals);
          if (d?.patient) setPatient(prev => ({ ...prev, ...d!.patient }));
          // Replay live-pushed lab rows (observer joins late / missed the event)
          for (const row of event.pushedLabs ?? []) {
            if (!row?.id || seenPushIds.current.has(row.id)) continue;
            seenPushIds.current.add(row.id);
            setLabRows(prev => [...prev, { id: row.id, timestamp: row.timestamp, material: row.material ?? 'דם', labs: row.labs, abnormal_fields: row.abnormal_fields }]);
          }
          if ((event.cardNumber ?? 0) > 0) setCurrentCard(event.cardNumber);
          if (event.simSpeed) {
            simSpeedRef.current = event.simSpeed;
            setSimSpeedState(event.simSpeed);
          }
          const latencySimSecs = event.wallClockMs
            ? Math.round((Date.now() - event.wallClockMs) * simSpeedRef.current / 1000)
            : 0;
          setSimTime(event.simTimeSeconds + latencySimSecs);
          if (event.isRunning) {
            setIsRunning(true);
            setPhase('running');
          } else {
            setIsRunning(false);
          }
        }
        if (event.type === 'request-state') {
          const scenario = selectedScenarioRef.current;
          const cardNum  = currentCardRef.current;
          const card = scenario?.cards.find(c => c.card_number === cardNum);
          const baseSD = card
            ? (card.structured_data
                ? { ...card.structured_data, clinical_description: card.clinical_description ?? '', card_title: card.title }
                : { clinical_description: card.clinical_description ?? '', card_title: card.title })
            : null;
          const structuredData = {
            ...(baseSD ?? {}),
            ctg:    ctgParamsRef.current,
            vitals: vitalsRef.current,
          };
          const snapshot = {
            type: 'state-snapshot' as const,
            cardNumber: cardNum,
            structuredData,
            isRunning: isRunningRef.current,
            simTimeSeconds: simTimeRef.current,
            ...snapshotExtras(),
          };
          pusherRef.current?.publish(snapshot);
          // Also write to sim-state so the polling fallback gets it
          // (guards against Pusher WebSocket issues on Safari/iPad)
          const sc = sessionCode;
          if (sc) {
            fetch(`/api/sim-state/${sc}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(snapshot),
            }).catch(() => {});
          }
        }
      });

      const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
      sync.connect(key, process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap2')
        .then(() => {
          if (isMidwife) {
            // Request current state from instructor immediately, then retry every 8s
            const sendRequest = () => pusherRef.current?.publish({ type: 'request-state' });
            setTimeout(sendRequest, 800);
          }
        })
        .catch(console.error);
    });

    return () => {
      unsub?.();
      pusherRef.current?.disconnect();
      pusherRef.current = null;
    };
  }, [sessionCode, snapshotExtras]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addTimeline = useCallback((type: TimelineEvent['type'], label: string, detail?: string) => {
    setTimeline(prev => [...prev, { id: `${type}_${Date.now()}`, timeSeconds: simTimeRef.current, type, label, detail }]);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    await ensureAudio(); // initialize AudioContext in user-gesture context
    setIsRunning(true);
    saveRestore({ isRunning: true });
    addTimeline('start', 'התחלת סימולציה');
    pusherRef.current?.publish({ type: 'timer-control', action: 'start', simTimeSeconds: simTimeRef.current, wallClockMs: Date.now() });
    if (sessionCode) {
      const scenario = selectedScenarioRef.current;
      const cardNum  = currentCardRef.current;
      const card = scenario?.cards.find(c => c.card_number === cardNum);
      const structuredData = card
        ? (card.structured_data
            ? { ...card.structured_data, clinical_description: card.clinical_description ?? '', card_title: card.title }
            : { clinical_description: card.clinical_description ?? '', card_title: card.title })
        : null;
      fetch(`/api/simulator/sessions/${sessionCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-role': 'instructor' },
        body: JSON.stringify({
          status: 'running',
          current_state: { cardNumber: cardNum, structuredData },
          sim_time_seconds: 0,
        }),
      }).catch(() => {});
    }
  }, [addTimeline, sessionCode, saveRestore, ensureAudio]);

  const handleStop = useCallback(() => {
    // Update ref synchronously BEFORE setIsRunning so if the heartbeat interval
    // fires in the React re-render window it reads false and writes isRunning:false.
    isRunningRef.current = false;
    setIsRunning(false);
    saveRestore({ isRunning: false });
    // Notify all participant devices that the simulation has ended
    pusherRef.current?.publish({ type: 'session-end' });
    if (sessionCode) {
      const scenario = selectedScenarioRef.current;
      const cardNum  = currentCardRef.current;
      const card = scenario?.cards.find(c => c.card_number === cardNum);
      const sd = card ? { ...(card.structured_data ?? {}), clinical_description: card.clinical_description ?? '', card_title: card.title, ctg: ctgParamsRef.current, vitals: vitalsRef.current } : null;
      fetch(`/api/sim-state/${sessionCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'state-snapshot', cardNumber: cardNum, structuredData: sd, isRunning: false, isEnded: true, simTimeSeconds: simTimeRef.current, wallClockMs: Date.now(), ...snapshotExtras() }),
      }).catch(() => {});
    }
  }, [saveRestore, sessionCode, snapshotExtras]);

  const handleEndSim = useCallback(() => {
    setIsRunning(false);
    addTimeline('end', 'סיום סימולציה');
    pusherRef.current?.publish({ type: 'session-end' });
    try { localStorage.removeItem('sim_restore'); } catch { /* ignore */ }
    if (sessionCode) {
      fetch(`/api/simulator/sessions/${sessionCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-role': 'instructor' },
        body: JSON.stringify({ status: 'completed' }),
      }).catch(() => {});
      // Write isEnded:true to sim-state so polling HTML clients (iPad) show the end screen
      fetch(`/api/sim-state/${sessionCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'state-snapshot', isRunning: false, isEnded: true, simTimeSeconds: simTimeRef.current }),
      }).catch(() => {});
      // Send self-assessment email to resident(s) — residents only
      if (residentName.trim()) {
        fetch('/api/simulator/self-assessment/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sessionCode, residentName: residentName.trim(), scenarioName: selectedScenario?.name }),
        }).catch(() => {});
      }
    }
    setPhase('debrief');
    router.replace('/tools/simulator');
  }, [addTimeline, sessionCode, residentName, selectedScenario, router]);

  // Shared card-change logic: publish card-advance + update both DB stores atomically
  const publishCardChange = useCallback((cardNum: number, structuredData: Record<string, unknown>) => {
    // Merge with live CTG/vitals so polling trainees don't see stale state
    const liveStructuredData = {
      ...structuredData,
      ctg:    ctgParamsRef.current,
      vitals: vitalsRef.current,
    };
    pusherRef.current?.publish({ type: 'card-advance', cardNumber: cardNum, structuredData: liveStructuredData });
    if (!sessionCode) return;
    // Write to sessions table (session metadata)
    fetch(`/api/simulator/sessions/${sessionCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-role': 'instructor' },
      body: JSON.stringify({ current_state: { cardNumber: cardNum, structuredData: liveStructuredData }, sim_time_seconds: simTimeRef.current }),
    }).catch(() => {});
    // Write to sim-state (polling fallback) immediately — don't wait for heartbeat
    const snapshot = {
      type: 'state-snapshot' as const,
      cardNumber: cardNum,
      structuredData: liveStructuredData,
      isRunning: isRunningRef.current,
      simTimeSeconds: simTimeRef.current,
      ...snapshotExtras(),
    };
    fetch(`/api/sim-state/${sessionCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    }).catch(() => {});
  }, [sessionCode, snapshotExtras]);

  const handleNextCard = useCallback(() => {
    if (!selectedScenario) return;
    const next = currentCard + 1;
    if (next > selectedScenario.cards.length) return;
    const card = selectedScenario.cards.find(c => c.card_number === next);
    if (!card) return;
    setCurrentCard(next);
    saveRestore({ currentCard: next });
    addTimeline('card', `כרטיס ${next}`, card.title);
    const structuredData = card.structured_data
      ? { ...card.structured_data, clinical_description: card.clinical_description ?? '', card_title: card.title }
      : { clinical_description: card.clinical_description ?? '', card_title: card.title };
    publishCardChange(next, structuredData as Record<string, unknown>);
  }, [currentCard, selectedScenario, addTimeline, publishCardChange, saveRestore]);

  const handlePrevCard = useCallback(() => {
    if (currentCard <= 1) return;
    const prev = currentCard - 1;
    if (!selectedScenario) return;
    const card = selectedScenario.cards.find(c => c.card_number === prev);
    if (!card) return;
    setCurrentCard(prev);
    saveRestore({ currentCard: prev });
    const structuredData = card.structured_data
      ? { ...card.structured_data, clinical_description: card.clinical_description ?? '', card_title: card.title }
      : { clinical_description: card.clinical_description ?? '', card_title: card.title };
    publishCardChange(prev, structuredData as Record<string, unknown>);
  }, [currentCard, selectedScenario, publishCardChange, saveRestore]);

  const handleOverride = useCallback((override: Partial<LiveOverrideParams>, mode: 'retroactive' | 'prospective') => {
    // Apply locally immediately (Pusher does not echo back to sender)
    const hasCTGField = (
      override.fhr_baseline !== undefined || override.fhr_variability !== undefined ||
      override.accelerations !== undefined || override.decelerations !== undefined ||
      override.contraction_frequency !== undefined || override.contraction_intensity !== undefined ||
      override.special !== undefined
    );
    if (hasCTGField) {
      setCtgParams(prev => ({
        ...prev,
        ...(override.fhr_baseline          !== undefined && { fhr_baseline:          override.fhr_baseline }),
        ...(override.fhr_variability       !== undefined && { fhr_variability:       override.fhr_variability }),
        ...(override.accelerations         !== undefined && { accelerations:         override.accelerations }),
        ...(override.decelerations         !== undefined && { decelerations:         override.decelerations }),
        ...(override.contraction_frequency !== undefined && { contraction_frequency: override.contraction_frequency }),
        ...(override.contraction_intensity !== undefined && { contraction_intensity: override.contraction_intensity }),
        ...(override.special               !== undefined && { special:               override.special }),
      }));
      if (mode === 'retroactive') setCtgRetroactiveKey(k => k + 1);
    }
    const vitalsUpdate: Partial<VitalSigns> = {};
    if (override.hr           !== undefined) vitalsUpdate.hr           = override.hr;
    if (override.bp_systolic  !== undefined) vitalsUpdate.bp_systolic  = override.bp_systolic;
    if (override.bp_diastolic !== undefined) vitalsUpdate.bp_diastolic = override.bp_diastolic;
    if (override.spo2         !== undefined) vitalsUpdate.spo2         = override.spo2;
    if (override.temp         !== undefined) vitalsUpdate.temp         = override.temp;
    if (Object.keys(vitalsUpdate).length > 0) setVitals(prev => ({ ...prev, ...vitalsUpdate }));

    addTimeline('override', mode === 'retroactive' ? 'החלפת תמונה קלינית' : 'שינוי בהדרגה');
    pusherRef.current?.publish({ type: 'live-override', params: override, retroactive: mode === 'retroactive' });

    // Write to sim-state so polling clients (iPad HTML page) get the override immediately
    if (sessionCode) {
      const newCtg = hasCTGField ? {
        ...ctgParamsRef.current,
        ...(override.fhr_baseline          !== undefined && { fhr_baseline:          override.fhr_baseline }),
        ...(override.fhr_variability       !== undefined && { fhr_variability:       override.fhr_variability }),
        ...(override.accelerations         !== undefined && { accelerations:         override.accelerations }),
        ...(override.decelerations         !== undefined && { decelerations:         override.decelerations }),
        ...(override.contraction_frequency !== undefined && { contraction_frequency: override.contraction_frequency }),
        ...(override.contraction_intensity !== undefined && { contraction_intensity: override.contraction_intensity }),
        ...(override.special               !== undefined && { special:               override.special }),
      } : ctgParamsRef.current;
      const newVitals = {
        ...vitalsRef.current,
        ...(override.hr           !== undefined && { hr:           override.hr }),
        ...(override.bp_systolic  !== undefined && { bp_systolic:  override.bp_systolic }),
        ...(override.bp_diastolic !== undefined && { bp_diastolic: override.bp_diastolic }),
        ...(override.spo2         !== undefined && { spo2:         override.spo2 }),
        ...(override.temp         !== undefined && { temp:         override.temp }),
      };
      const scenario = selectedScenarioRef.current;
      const cardNum  = currentCardRef.current;
      const card = scenario?.cards.find(c => c.card_number === cardNum);
      const baseSD = card ? { ...(card.structured_data ?? {}), clinical_description: card.clinical_description ?? '', card_title: card.title } : {};
      const sd = { ...baseSD, ctg: newCtg, vitals: newVitals };
      fetch(`/api/sim-state/${sessionCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'state-snapshot', cardNumber: cardNum, structuredData: sd, isRunning: isRunningRef.current, simTimeSeconds: simTimeRef.current, retroactive: mode === 'retroactive', ...snapshotExtras() }),
      }).catch(() => {});
    }
  }, [addTimeline, sessionCode, snapshotExtras]);

  // Live labs push: instructor sends a new lab-results row to all devices
  const handlePushLabs = useCallback((row: PushedLabRow) => {
    seenPushIds.current.add(row.id); // the local publish echo is deduped
    pushedLabsRef.current = [...pushedLabsRef.current, row].slice(-20); // bound snapshot size
    setLabRows(prev => [...prev, {
      id: row.id,
      timestamp: row.timestamp,
      material: row.material ?? 'דם',
      labs: row.labs,
      abnormal_fields: row.abnormal_fields,
    }]);
    addTimeline('override', 'תוצאות מעבדה נשלחו');
    pusherRef.current?.publish({ type: 'labs-push', row });
    if (sessionCode) {
      // Immediate snapshot so 2s-polling trainees get the row without waiting for the heartbeat
      const scenario = selectedScenarioRef.current;
      const cardNum  = currentCardRef.current;
      const card = scenario?.cards.find(c => c.card_number === cardNum);
      const baseSD = card ? { ...(card.structured_data ?? {}), clinical_description: card.clinical_description ?? '', card_title: card.title } : {};
      const sd = { ...baseSD, ctg: ctgParamsRef.current, vitals: vitalsRef.current };
      const snapshot = { type: 'state-snapshot', cardNumber: cardNum, structuredData: sd, isRunning: isRunningRef.current, simTimeSeconds: simTimeRef.current, ...snapshotExtras() };
      fetch(`/api/sim-state/${sessionCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      }).catch(() => {});
      fetch(`/api/simulator/sessions/${sessionCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-role': 'instructor' },
        body: JSON.stringify({ current_state: snapshot, sim_time_seconds: simTimeRef.current }),
      }).catch(() => {});
    }
  }, [addTimeline, sessionCode, snapshotExtras]);

  const handleAddNote = useCallback((note: Omit<NoteEntry, 'id'>) => {
    addTimeline('note', note.content.slice(0, 50));
    fetch('/api/simulator/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionCode, author: note.author, role: urlRole, text: note.content, simTime: note.simTime, isQuickTag: note.isQuickTag, tagType: note.tagType }),
    }).catch(() => {});
    // publish fires local handlers immediately — the note-added handler below adds it to state.
    // Do NOT also call setNotes here or notes will appear twice.
    pusherRef.current?.publish({ type: 'note-added', author: note.author, role: urlRole, text: note.content, simTime: note.simTime, isQuickTag: note.isQuickTag, tagType: note.tagType });
  }, [addTimeline, sessionCode, urlRole]);

  const handleLeaveConfirmed = useCallback(() => {
    setLeaveConfirmOpen(false);
    setPhase('setup');
    setIsRunning(false);
    setSelectedScenario(null);
    setSessionCode('');
    setSimTime(0);
    setCurrentCard(1);
    setNotes([]);
    setTimeline([]);
    setVideoClips([]);
    setLabRows([]);
    pushedLabsRef.current = [];
    seenPushIds.current = new Set();
    setIsRecording(false);
    setNotepadContent('');
    router.push('/tools/simulator');
  }, [router]);

  const handleToggleMute = useCallback(async () => {
    await ensureAudio(); // initialize AudioContext in user-gesture context
    setIsMuted(m => !m);
  }, [ensureAudio]);

  const handleFHRUpdate = useCallback((fhr: number) => {
    setCurrentFHR(fhr);
    audioEngineRef.current?.setFHR(fhr);
  }, []);

  const handleClipReady = useCallback((blob: Blob, start: number, end: number) => {
    const clip: VideoClip = {
      id: `clip_${Date.now()}`,
      deviceRole: urlRole,
      startSeconds: start,
      endSeconds:   end,
      blobUrl:      URL.createObjectURL(blob),
    };
    setVideoClips(prev => [...prev, clip]);
    setIsRecording(false);
    const fd = new FormData();
    fd.append('video', blob, 'sim.webm');
    fd.append('sessionCode', sessionCode);
    fd.append('deviceRole', urlRole);
    fd.append('startTime', String(start));
    fd.append('endTime', String(end));
    fetch('/api/simulator/upload-video', { method: 'POST', body: fd }).catch(() => {});
  }, [urlRole, sessionCode]);

  const handleCreateSession = useCallback(async () => {
    if (!selectedScenario) return;
    setCreating(true);
    // Reset all per-session state so a second run always starts fresh
    setCurrentCard(1);
    setIsRunning(false);
    setSimTime(0);
    setNotes([]);
    setTimeline([]);
    setVideoClips([]);
    setLabRows([]);
    pushedLabsRef.current = [];
    seenPushIds.current = new Set();
    let code = '';
    try {
      const res = await fetch('/api/simulator/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: selectedScenario.id, residentName: residentName.trim(), midwifeName: midwifeName.trim(), seniorDoctorName: seniorDoctor.trim(), chargeMidwifeName: chargeMidwife.trim(), observers }),
      });
      const data = await res.json();
      code = data.session?.session_code ?? data.session?.sessionCode ?? '';
    } catch { /* fall through */ }
    if (!code) {
      const chars = 'ACDEFHJKLMNPRSTUVWXY3456789'; // pragma: allowlist secret
      code = 'SIM-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    // Load first card
    const first = selectedScenario.cards.find(c => c.card_number === 1);
    if (first?.structured_data) {
      const d = first.structured_data;
      if (d.ctg) { setCtgParams(d.ctg); setHasCTG(true); } else setHasCTG(false);
      if (d.vitals)  setVitals(d.vitals);
      if (d.patient) setPatient(d.patient);
      if (d.labs) {
        const row: LabRow = {
          id: 'card_1_init',
          timestamp: new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
          material: 'דם',
          labs: d.labs,
          abnormal_fields: d.abnormal_fields ?? [],
        };
        setLabRows([row]);
      }
    }
    setSessionCode(code);
    setPhase('running');
    setCreating(false);
    window.scrollTo(0, 0);
    // Write to localStorage synchronously before navigation — survives refresh
    saveRestore({ code, scenarioId: selectedScenario.id, isRunning: false, currentCard: 1 });
    router.push(`/tools/simulator?code=${code}`);

    // Write initial state to sim-state immediately so polling participants
    // get card 1 data before the instructor clicks "התחל" (before isRunning=true)
    const firstCard = selectedScenario.cards.find(c => c.card_number === 1);
    if (firstCard) {
      const initSD = firstCard.structured_data
        ? { ...firstCard.structured_data, clinical_description: firstCard.clinical_description ?? '', card_title: firstCard.title }
        : { clinical_description: firstCard.clinical_description ?? '', card_title: firstCard.title };
      const initSnap = {
        type: 'state-snapshot', cardNumber: 1, structuredData: initSD, isRunning: false, simTimeSeconds: 0,
        pushedLabs: [], caseStory: selectedScenario.case_story ?? '', scenarioName: selectedScenario.name,
      };
      fetch(`/api/sim-state/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initSnap),
      }).catch(() => {});
      // Also persist to session record — sim_sessions is guaranteed-shared
      // so any serverless instance serving participants can read it back.
      fetch(`/api/simulator/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-role': 'instructor' },
        body: JSON.stringify({ current_state: initSnap, sim_time_seconds: 0 }),
      }).catch(() => {});
    }
  }, [selectedScenario, residentName, midwifeName, seniorDoctor, chargeMidwife, observers, router, saveRestore]);

  const handleAssessmentSubmit = useCallback(async (data: {
    scores: Record<string, number>;
    itemNotes?: Record<string, string>;
    seniority?: string;
    simType?: string;
    strengths: string;
    improvements: string;
    keyMessage: string;
    total: number;
    sendEmails?: boolean;
  }) => {
    try {
      const res = await fetch('/api/simulator/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode,
          participantName: residentName || midwifeName || 'משתתף',
          evaluatorName: 'מדריך',
          formType: 'resident' as const,
          scenarioName: selectedScenario?.name ?? 'סימולציה',
          participantEmails: data.sendEmails ? participantEmails : [],
          ...data,
        }),
      });
      return await res.json();
    } catch {
      return { emailError: 'שגיאת רשת' };
    }
  }, [sessionCode, residentName, midwifeName, selectedScenario, participantEmails]);

  const handleAddDebriefNote = useCallback((timeSeconds: number, content: string) => {
    setNotes(prev => [...prev, { id: `db_${Date.now()}`, simTime: timeSeconds, author: 'מ', content, isQuickTag: false }]);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentCardData = selectedScenario?.cards.find(c => c.card_number === currentCard);
  const debriefNotes    = notes.map(n => ({ ...n, phase: 'sim' }));

  // ── Phase renders ─────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <>
        {/* Temporary JS diagnostic banner — remove after iOS debugging */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: jsDbg === '...' ? '#dc2626' : '#16a34a', color: '#fff', fontSize: '0.6rem', fontFamily: 'monospace', padding: '2px 6px', wordBreak: 'break-all' }}>
          JS:{jsDbg}
        </div>
        <SetupScreen
        scenarios={scenarios}
        selectedScenario={selectedScenario}
        onSelectScenario={setSelectedScenario}
        residentName={residentName}   onResidentName={setResidentName}
        midwifeName={midwifeName}     onMidwifeName={setMidwifeName}
        seniorDoctor={seniorDoctor}   onSeniorDoctor={setSeniorDoctor}
        chargeMidwife={chargeMidwife} onChargeMidwife={setChargeMidwife}
        observers={observers}         onObserversChange={setObservers}
        onEmailsChange={setParticipantEmails}
        onStart={handleCreateSession}
        creating={creating}
        isAdmin={isAdmin}
        onEditScenario={setEditingScenario}
      />
      {editingScenario && (
        <ScenarioCardEditor
          scenario={editingScenario}
          onSave={s => handleScenarioSaved(s as unknown as Scenario)}
          onClose={() => setEditingScenario(null)}
        />
      )}
      </>
    );
  }

  if (phase === 'debrief') {
    return (
      <DebriefView
        sessionName={selectedScenario?.name ?? 'סימולציה'}
        sessionDate={new Date().toLocaleDateString('he-IL')}
        totalDuration={simTime}
        participants={[residentName, midwifeName, ...observers].filter(Boolean)}
        timeline={timeline}
        videoClips={videoClips}
        notes={debriefNotes}
        onAddDebriefNote={handleAddDebriefNote}
        onClose={() => { setPhase('assessment'); }}
      />
    );
  }

  if (phase === 'assessment') {
    return (
      <AssessmentForm
        formType="resident"
        participantName={residentName || 'משתתף'}
        evaluatorName="מדריך"
        sessionDate={new Date().toLocaleDateString('he-IL')}
        scenarioName={selectedScenario?.name ?? 'סימולציה'}
        participantEmails={participantEmails}
        onSubmit={handleAssessmentSubmit}
        onCancel={() => setPhase('debrief')}
        onDone={() => setPhase('setup')}
      />
    );
  }

  // ── Running view ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: theme.bg,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Patient banner */}
      <PatientBanner patient={patient} simTimeSeconds={simTime} isRunning={isRunning} />

      {/* Session meta bar */}
      <div style={{
        background: theme.accentSoft,
        borderBottom: `1px solid ${theme.borderSoft}`,
        padding: '4px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        {sessionCode && (
          <span style={{ color: theme.label, fontFamily: 'monospace', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
            📡 {sessionCode}
          </span>
        )}
        {isMidwife && (
          <>
            <span style={{ color: theme.textDim, fontSize: '0.85rem' }}>👁 מצב משקיף</span>
            <button
              onClick={handleToggleMute}
              style={{
                background: isMuted ? 'rgba(234,179,8,0.15)' : 'rgba(139,92,246,0.1)',
                border: isMuted ? '1px solid rgba(234,179,8,0.4)' : `1px solid ${theme.borderSoft}`,
                borderRadius: 6,
                color: isMuted ? '#b45309' : theme.text,
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '3px 10px',
                fontFamily: 'inherit',
              }}
            >
              {isMuted ? '🔇 קול כבוי' : '🔊 קול פעיל'}
            </button>
            <button
              onClick={() => setIsRecording(r => !r)}
              style={{
                background: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(139,92,246,0.1)',
                border: isRecording ? '1px solid rgba(239,68,68,0.5)' : `1px solid ${theme.borderSoft}`,
                borderRadius: 6,
                color: isRecording ? '#dc2626' : theme.text,
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '3px 10px',
                fontFamily: 'inherit',
              }}
            >
              {isRecording ? '⏺ מקליט' : '🔴 הקלט'}
            </button>
          </>
        )}
        {!isMidwife && sessionCode && (
          <div style={{ display: 'flex', gap: 6, marginRight: 'auto' }}>
            <button
              onClick={() => setQrOpen('trainee')}
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 6, color: theme.name === 'dark' ? '#93c5fd' : '#1d4ed8', fontSize: '0.85rem', cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit' }}
            >
              📱 מסך מתמחה
            </button>
            <button
              onClick={() => setQrOpen('midwife')}
              style={{ background: theme.chipBg, border: `1px solid ${theme.borderSoft}`, borderRadius: 6, color: theme.lilac, fontSize: '0.85rem', cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit' }}
            >
              📱 מסך מיילדת
            </button>
          </div>
        )}
        {!isMidwife && (
          <button
            onClick={() => setPatientEditOpen(true)}
            style={{ background: 'none', border: `1px solid ${theme.borderSoft}`, borderRadius: 6, color: theme.label, fontSize: '0.85rem', cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit', marginRight: 'auto' }}
          >
            ✎ עדכן פרטי מטופלת
          </button>
        )}
        <ThemeToggleButton style={{ width: 30, height: 30, fontSize: '0.9rem' }} />
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', flexDirection: portrait ? 'column' : 'row', flexWrap: portrait ? 'nowrap' : 'wrap', minHeight: 0 }}>

        {/* Left: CTG + EHR */}
        <div style={{ flex: portrait ? '0 0 auto' : '1 1 320px', display: 'flex', flexDirection: 'column', minWidth: 0, order: portrait ? 1 : 0 }}>

          {/* CTG + Vitals row — in portrait: vitals on top, CTG below */}
          <div style={{ height: portrait ? 'auto' : 360, display: 'flex', flexDirection: portrait ? 'column-reverse' : 'row', minHeight: 0 }}>
            <div style={{ flex: portrait ? '0 0 280px' : 1, position: 'relative', minWidth: 0 }}>
              {hasCTG
                ? <CTGMonitor ctgParams={ctgParams} maternalHR={vitals.hr} isRunning={isRunning} onFHRUpdate={handleFHRUpdate} resetKey={ctgResetKey} retroactiveKey={ctgRetroactiveKey} simSpeed={simSpeed} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: '2rem' }}>🩺</span>
                    <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>אין ניטור עוברי</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>דופק אמהי: {vitals.hr} bpm</span>
                  </div>
              }
            </div>
            <div style={{
              width: portrait ? '100%' : 160, height: portrait ? 120 : 'auto',
              flexShrink: 0,
              borderLeft: portrait ? 'none' : `1px solid ${theme.borderSoft}`,
              borderBottom: portrait ? `1px solid ${theme.borderSoft}` : 'none',
              padding: 8,
            }}>
              <VitalSignsDisplay fhr={currentFHR} vitals={vitals} isRunning={isRunning} />
            </div>
          </div>

          {/* EHR Labs */}
          <div style={{ minHeight: 200, borderTop: `2px solid ${theme.borderSoft}` }}>
            <EHRLabsPanel rows={labRows} />
          </div>
        </div>

        {/* Right panel — in portrait appears first (order: -1) */}
        <div style={{
          flex: portrait ? '0 0 auto' : '0 0 340px',
          borderLeft: portrait ? 'none' : `1px solid ${theme.borderSoft}`,
          borderBottom: portrait ? `1px solid ${theme.borderSoft}` : 'none',
          display: 'flex',
          flexDirection: 'column',
          background: theme.surface,
          order: portrait ? -1 : 0,
        }}>
          {!isMidwife && (
            <>
              {/* Instructor controls */}
              <div style={{ padding: '10px 10px 0', flexShrink: 0 }}>
                <InstructorControls
                  currentCard={currentCard}
                  totalCards={selectedScenario?.cards.length ?? 1}
                  isRunning={isRunning}
                  isMuted={isMuted}
                  isRecording={isRecording}
                  onPrev={handlePrevCard}
                  onNext={handleNextCard}
                  onStart={handleStart}
                  onStop={handleStop}
                  onEndSim={() => setConfirmEndOpen(true)}
                  onToggleMute={handleToggleMute}
                  onToggleRecord={() => setIsRecording(r => !r)}
                  onOpenOverride={() => setOverrideOpen(true)}
                  onOpenLabsPush={() => setLabsPushOpen(true)}
                  onAddNote={() => setNoteFormTrigger(t => t + 1)}
                  simSpeed={simSpeed}
                  onSpeedChange={handleSpeedChange}
                />
              </div>

              {/* Video recorder (when active) */}
              {isRecording && (
                <div style={{ padding: '6px 10px 0', flexShrink: 0 }}>
                  <VideoRecorder
                    sessionCode={sessionCode}
                    deviceRole="instructor"
                    simTimeSeconds={simTime}
                    onClipReady={handleClipReady}
                  />
                </div>
              )}

              {/* Current + next card descriptions */}
              {currentCardData && (
                <div style={{ margin: '8px 10px 0', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {/* Current card */}
                  <div style={{
                    padding: '12px 14px',
                    background: theme.accentSoft,
                    border: `1px solid ${theme.borderSoft}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ color: theme.label, fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>
                      ▶ {currentCardData.title}
                    </div>
                    <div style={{ color: theme.text, fontSize: '0.95rem', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-line' }}>
                      {currentCardData.clinical_description}
                    </div>
                  </div>
                  {/* Next card preview */}
                  {selectedScenario?.cards.find(c => c.card_number === currentCard + 1) && (() => {
                    const next = selectedScenario.cards.find(c => c.card_number === currentCard + 1)!;
                    return (
                      <div style={{
                        padding: '10px 14px',
                        background: theme.surface,
                        border: `1px dashed ${theme.borderSoft}`,
                        borderRadius: 8,
                        opacity: 0.75,
                      }}>
                        <div style={{ color: theme.accent, fontSize: '0.9rem', fontWeight: 700, marginBottom: 4 }}>
                          הבא · {next.title}
                        </div>
                        <div style={{ color: theme.textDim, fontSize: '0.85rem', lineHeight: 1.5, maxHeight: 90, overflowY: 'auto' }}>
                          {next.clinical_description}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* Midwife video recorder (when active) */}
          {isMidwife && isRecording && (
            <div style={{ padding: '6px 10px 0', flexShrink: 0 }}>
              <VideoRecorder
                sessionCode={sessionCode}
                deviceRole="midwife_supervisor"
                simTimeSeconds={simTime}
                onClipReady={handleClipReady}
              />
            </div>
          )}

          {/* Notes system — takes remaining space */}
          <div style={{ flex: 1, minHeight: 0, marginTop: 8, borderTop: `1px solid ${theme.borderSoft}` }}>
            <NoteSystem
              role={isMidwife ? 'midwife_supervisor' : 'instructor'}
              simTimeSeconds={simTime}
              isRunning={isRunning}
              notes={notes}
              notepadContent={notepadContent}
              onAddNote={handleAddNote}
              onNotepadChange={setNotepadContent}
              openFormTrigger={noteFormTrigger}
            />
          </div>
        </div>
      </div>

      {/* Live override panel (modal) */}
      <LiveOverridePanel
        isOpen={overrideOpen}
        ctgParams={ctgParams}
        vitals={vitals}
        onUpdate={handleOverride}
        onClose={() => setOverrideOpen(false)}
      />

      {/* Live labs push panel (modal) */}
      {labsPushOpen && (
        <LabsPushPanel
          isOpen={labsPushOpen}
          baseLabs={labRows[labRows.length - 1]?.labs ?? currentCardData?.structured_data?.labs ?? {}}
          baseAbnormal={labRows[labRows.length - 1]?.abnormal_fields ?? currentCardData?.structured_data?.abnormal_fields ?? []}
          simTimeSeconds={simTime}
          onPush={handlePushLabs}
          onClose={() => setLabsPushOpen(false)}
        />
      )}

      {/* End simulation confirmation */}
      {confirmEndOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmEndOpen(false); }}
        >
          <div dir="rtl" style={{ background: theme.surfaceRaised, border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', color: theme.textHi, boxShadow: '0 25px 60px rgba(0,0,0,0.6)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏹</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700 }}>סיום סימולציה?</h3>
            <p style={{ margin: '0 0 24px', color: theme.textDim, fontSize: '0.85rem', lineHeight: 1.6 }}>
              הסימולציה תסתיים ותועבר לטופס ההערכה. לא ניתן לחזור.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setConfirmEndOpen(false); handleEndSim(); }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                כן, סיים
              </button>
              <button
                onClick={() => setConfirmEndOpen(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid rgba(156,163,175,0.3)', background: theme.surface, color: theme.textDim, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient edit modal */}
      {patientEditOpen && (
        <PatientEditModal
          patient={patient}
          onSave={updated => { setPatient(updated); setPatientEditOpen(false); }}
          onClose={() => setPatientEditOpen(false)}
        />
      )}

      {/* QR / join modal */}
      {qrOpen && sessionCode && (() => {
        const sParam = selectedScenario ? `?s=${selectedScenario.id}` : '';
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const joinUrl = qrOpen === 'midwife'
          ? `${origin}/tools/simulator?code=${sessionCode}&role=midwife_instructor`
          : `${origin}/tools/simulator/participant/${sessionCode}${sParam}`;
        const modalTitle = qrOpen === 'midwife' ? '📱 מסך מיילדת' : '📱 מסך מתמחה';
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(joinUrl)}`;
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) setQrOpen(null); }}
          >
            <div dir="rtl" style={{ background: theme.surfaceRaised, border: `1px solid ${theme.borderSoft}`, borderRadius: 18, padding: '28px 32px', maxWidth: 360, width: '100%', color: theme.textHi, boxShadow: '0 25px 60px rgba(0,0,0,0.7)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: theme.lilac }}>{modalTitle}</h3>
                <button onClick={() => setQrOpen(null)} style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1.1rem', fontFamily: 'inherit' }}>✕</button>
              </div>

              {/* QR code */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 8, display: 'inline-block', marginBottom: 18 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR code" width={180} height={180} style={{ display: 'block' }} />
              </div>

              {/* Session code */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: theme.textDim, fontSize: '0.72rem', marginBottom: 4 }}>קוד סשן</div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700, color: theme.label, letterSpacing: '0.15em' }}>{sessionCode}</div>
              </div>

              {/* Copy URL */}
              <div style={{ background: theme.surface, border: `1px solid ${theme.borderSoft}`, borderRadius: 8, padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: '0.68rem', color: theme.textDim, overflowX: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>{joinUrl}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(joinUrl).catch(() => {})}
                  style={{ background: theme.chipBg, border: `1px solid ${theme.borderSoft}`, borderRadius: 5, color: theme.lilac, fontSize: '0.68rem', cursor: 'pointer', padding: '3px 8px', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                >
                  העתק
                </button>
              </div>

              <p style={{ color: theme.textDim, fontSize: '0.72rem', margin: 0, lineHeight: 1.6 }}>
                סרקו את הקוד QR עם הטאבלט השני או הדביקו את הקישור בדפדפן
              </p>
            </div>
          </div>
        );
      })()}

      {/* Leave confirmation dialog */}
      {leaveConfirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div dir="rtl" style={{ background: theme.surfaceRaised, border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: '28px 32px', maxWidth: 380, width: '100%', color: theme.textHi, boxShadow: '0 25px 60px rgba(0,0,0,0.7)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px', color: theme.danger, fontSize: '1.05rem', fontWeight: 700 }}>הסימולציה פעילה</h3>
            <p style={{ color: theme.textDim, fontSize: '0.85rem', lineHeight: 1.7, margin: '0 0 24px' }}>
              אם תצא עכשיו, הסימולציה תישמר אוטומטית.<br />
              תוכל לחזור אליה דרך <strong style={{ color: theme.lilac }}>היסטוריה</strong> תוך 24 שעות.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setLeaveConfirmOpen(false)}
                style={{ padding: '10px 22px', borderRadius: 8, border: `1px solid ${theme.borderSoft}`, background: theme.chipBg, color: theme.lilac, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← המשך סימולציה
              </button>
              <button
                onClick={handleLeaveConfirmed}
                style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.2)', color: theme.danger, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                🚪 צא ושמור
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @media (max-width: 700px) {
          .sim-setup-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ── Tiny component that reads URL params — only this is suspended ─────────────
function SearchParamsReader() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const urlCode = searchParams.get('code');
  const urlRole = searchParams.get('role') ?? 'instructor';

  // Role gate: read sim_meta cookie (non-httpOnly, set at login)
  useEffect(() => {
    try {
      const raw = document.cookie.split(';').find(c => c.trim().startsWith('sim_meta='));
      if (raw) {
        const meta = JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=')));
        // Trainees go to join page — unless they have the midwife_instructor role in the URL
        if (meta.role === 'trainee' && urlRole !== 'midwife_instructor') router?.push('/tools/simulator/join');
      }
    } catch { /* ignore parse errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SimulatorPageInner urlCode={urlCode} urlRole={urlRole} />;
}

// ── Page wrapper: renders SimulatorPageInner immediately with null params ─────
// Suspense only wraps SearchParamsReader (tiny), so the main UI never blocks.
export default function SimulatorPage() {
  return (
    <Suspense fallback={<SimulatorPageInner urlCode={null} urlRole="instructor" />}>
      <SearchParamsReader />
    </Suspense>
  );
}
