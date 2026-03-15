'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CTGParams, VitalSigns, PatientInfo, LiveOverrideParams } from '@/lib/simulatorTypes';
import { CTG_PRESETS } from '@/lib/ctgPresets';
import type { LabRow } from '@/components/tools/simulator/EHRLabsPanel';
import PatientBanner from '@/components/tools/simulator/PatientBanner';
import VitalSignsDisplay from '@/components/tools/simulator/VitalSignsDisplay';
import InstructorControls from '@/components/tools/simulator/InstructorControls';
import LiveOverridePanel from '@/components/tools/simulator/LiveOverridePanel';
import NoteSystem, { type NoteEntry } from '@/components/tools/simulator/NoteSystem';

const CTGMonitor     = dynamic(() => import('@/components/tools/simulator/CTGMonitor'),     { ssr: false });
const EHRLabsPanel   = dynamic(() => import('@/components/tools/simulator/EHRLabsPanel'),   { ssr: false });
const VideoRecorder  = dynamic(() => import('@/components/tools/simulator/VideoRecorder'),  { ssr: false });
const DebriefView    = dynamic(() => import('@/components/tools/simulator/DebriefView'),    { ssr: false });
const AssessmentForm = dynamic(() => import('@/components/tools/simulator/AssessmentForm'), { ssr: false });

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
  const [form, setForm] = useState<PatientInfo>({ ...patient });

  const field = (label: string, key: keyof PatientInfo, type = 'text', min?: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ color: '#a78bfa', fontSize: '0.7rem', fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        min={min}
        value={(form[key] as string | number) ?? ''}
        onChange={e => setForm(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '6px 8px', color: '#f1f5f9', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
      />
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div dir="rtl" style={{ background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, color: '#f1f5f9', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#a78bfa' }}>✎ עדכון פרטי מטופלת</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.1rem', fontFamily: 'inherit' }}>✕</button>
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
          <label style={{ color: '#a78bfa', fontSize: '0.7rem', fontWeight: 600 }}>היסטוריה</label>
          <textarea
            value={form.history ?? ''}
            onChange={e => setForm(prev => ({ ...prev, history: e.target.value }))}
            rows={2}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '6px 8px', color: '#f1f5f9', fontSize: '0.82rem', resize: 'none', fontFamily: 'inherit', outline: 'none' }}
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
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(156,163,175,0.3)', background: 'rgba(255,255,255,0.04)', color: '#9ca3af', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

interface StaffMember { id: number; name: string; role: string; email?: string; }

const OTHER_VALUE = '__other__';

function StaffSelect({ value, onChange, staff, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  staff: StaffMember[];
  placeholder: string;
}) {
  const inRoster = staff.some(s => s.name === value);
  const isOther  = value !== '' && !inRoster;
  const [showText, setShowText] = useState(isOther);

  const baseStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7,
    padding: '8px 10px', color: '#f1f5f9', fontSize: '0.85rem',
    boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl', outline: 'none',
  };

  if (showText) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...baseStyle, flex: 1 }}
          autoFocus
        />
        <button
          onClick={() => { onChange(''); setShowText(false); }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#9ca3af', cursor: 'pointer', padding: '0 10px', fontFamily: 'inherit', fontSize: '0.8rem' }}
          title="חזור לרשימה"
        >↩</button>
      </div>
    );
  }

  return (
    <select
      value={inRoster ? value : ''}
      onChange={e => {
        if (e.target.value === OTHER_VALUE) { setShowText(true); onChange(''); }
        else onChange(e.target.value);
      }}
      style={{ ...baseStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
    >
      <option value="" style={{ background: '#1a1a2e' }}>{placeholder}</option>
      {staff.map(s => (
        <option key={s.id} value={s.name} style={{ background: '#1a1a2e' }}>
          {s.name} · {s.role}
        </option>
      ))}
      <option value={OTHER_VALUE} style={{ background: '#1a1a2e', color: '#a78bfa' }}>✎ אחר (הקלד ידנית)</option>
    </select>
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
}) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  useEffect(() => {
    fetch('/api/simulator/staff')
      .then(r => r.json())
      .then(d => setStaffList(d.staff ?? []))
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
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0d0d1f', fontFamily: "'Segoe UI', system-ui, sans-serif", overflowY: 'auto' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>🏥 הגדרת סימולציה</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: '6px 0 0' }}>Labor-AI Lab · Hadassah Mount Scopus</p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/tools/simulator/history" style={{ color: '#a78bfa', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>📋 היסטוריה</Link>
            <Link href="/tools/admin/simulator" style={{ color: '#7c3aed', fontSize: '0.8rem', textDecoration: 'none' }}>⚙ ניהול →</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* Scenario list */}
          <div>
            <div style={{ color: '#a78bfa', fontSize: '0.78rem', fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>בחירת תרחיש</div>
            {scenarios.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '0.82rem', padding: 20, textAlign: 'center' }}>⏳ טוען תרחישים...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scenarios.map(s => {
                  const active = selectedScenario?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelectScenario(s)}
                      style={{
                        textAlign: 'right', padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                        border:      active ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.08)',
                        background:  active ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                        color:       active ? '#c4b5fd' : '#d1d5db',
                        fontFamily: 'inherit', direction: 'rtl',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 5 }}>{s.name}</div>
                      <div style={{ fontSize: '0.73rem', color: '#9ca3af', lineHeight: 1.5 }}>
                        {s.case_story?.slice(0, 130)}{s.case_story?.length > 130 ? '...' : ''}
                      </div>
                      {active && s.expected_actions && (
                        <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#7c3aed', borderTop: '1px solid rgba(139,92,246,0.2)', paddingTop: 6 }}>
                          ✅ {s.expected_actions.slice(0, 120)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: form + start */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Participants */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#a78bfa', fontSize: '0.78rem', fontWeight: 700, marginBottom: 12 }}>משתתפים</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>מתמחה</label>
                  <StaffSelect
                    value={residentName}
                    onChange={onResidentName}
                    staff={residents.length ? residents : staffList}
                    placeholder="— בחר מתמחה —"
                  />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>מיילדת</label>
                  <StaffSelect
                    value={midwifeName}
                    onChange={onMidwifeName}
                    staff={midwives.length ? midwives : staffList}
                    placeholder="— בחר מיילדת —"
                  />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>רופא מומחה</label>
                  <StaffSelect
                    value={seniorDoctor}
                    onChange={onSeniorDoctor}
                    staff={seniorDoctors.length ? seniorDoctors : staffList}
                    placeholder="— בחר רופא מומחה —"
                  />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.72rem', display: 'block', marginBottom: 4 }}>מיילדת אחראית</label>
                  <StaffSelect
                    value={chargeMidwife}
                    onChange={onChargeMidwife}
                    staff={chargeMidwives.length ? chargeMidwives : staffList}
                    placeholder="— בחר מיילדת אחראית —"
                  />
                </div>
              </div>

              {/* Observers */}
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
                <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginBottom: 8 }}>
                  נוכחים (ללא הערכה)
                </div>
                {observers.map((name, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <StaffSelect
                        value={name}
                        onChange={v => { const next = [...observers]; next[i] = v; onObserversChange(next); }}
                        staff={staffList}
                        placeholder={`— משקיף ${i + 1} —`}
                      />
                    </div>
                    <button
                      onClick={() => onObserversChange(observers.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', alignSelf: 'center' }}
                    >✕</button>
                  </div>
                ))}
                <button
                  onClick={() => onObserversChange([...observers, ''])}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 7, color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', padding: '6px 12px', width: '100%', fontFamily: 'inherit' }}
                >
                  + הוסף משקיף
                </button>
              </div>
            </div>

            {/* Selected scenario summary */}
            {selectedScenario && (
              <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: '0.72rem', color: '#9ca3af' }}>
                <div style={{ color: '#c4b5fd', fontWeight: 700, marginBottom: 4 }}>{selectedScenario.name}</div>
                <div>{selectedScenario.cards.length} כרטיסים</div>
              </div>
            )}

            {/* Join hint */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', fontSize: '0.72rem', color: '#6b7280', lineHeight: 1.6 }}>
              📱 לאחר יצירת קוד הסשן, שתפו אותו עם המיילדת האחראית דרך <strong style={{ color: '#a78bfa' }}>/join</strong>
            </div>

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
function SimulatorPageInner() {
  const searchParams = useSearchParams();
  const urlCode = searchParams.get('code');
  const urlRole = searchParams.get('role') ?? 'instructor';
  const isMidwife = urlRole === 'midwife_supervisor';

  // Phase
  const [phase, setPhase]   = useState<SimPhase>(urlCode ? 'running' : 'setup');
  const [sessionCode, setSessionCode] = useState<string>(urlCode ?? '');

  // Scenarios
  const [scenarios, setScenarios]           = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [currentCard, setCurrentCard]       = useState(1);

  // Simulation state
  const [isRunning, setIsRunning]   = useState(false);
  const [simTime, setSimTime]       = useState(0);
  const [ctgParams, setCtgParams]   = useState<CTGParams>(DEFAULT_CTG);
  const [vitals, setVitals]         = useState<VitalSigns>(DEFAULT_VITALS);
  const [patient, setPatient]       = useState<PatientInfo>(DEFAULT_PATIENT);
  const [currentFHR, setCurrentFHR] = useState(DEFAULT_CTG.fhr_baseline);
  const [labRows, setLabRows]       = useState<LabRow[]>([]);
  const [isMuted, setIsMuted]       = useState(false);

  // Panels / overlays
  const [overrideOpen, setOverrideOpen]     = useState(false);
  const [patientEditOpen, setPatientEditOpen]   = useState(false);
  const [confirmEndOpen, setConfirmEndOpen]     = useState(false);
  const [qrOpen, setQrOpen]                 = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [videoClips, setVideoClips]         = useState<VideoClip[]>([]);

  // Notes
  const [notes, setNotes]               = useState<NoteEntry[]>([]);
  const [notepadContent, setNotepadContent] = useState('');

  // Timeline for debrief
  const [timeline, setTimeline]         = useState<TimelineEvent[]>([]);

  // Assessment
  const [showAssessment, setShowAssessment] = useState(false);

  // Setup form
  const [residentName, setResidentName]       = useState('');
  const [midwifeName, setMidwifeName]         = useState('');
  const [seniorDoctor, setSeniorDoctor]       = useState('');
  const [chargeMidwife, setChargeMidwife]     = useState('');
  const [observers, setObservers]             = useState<string[]>([]);
  const [participantEmails, setParticipantEmails] = useState<string[]>([]);
  const [creating, setCreating]               = useState(false);

  // Refs
  const audioRef  = useRef<import('@/components/tools/simulator/AudioEngine').AudioEngine | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pusherRef = useRef<import('@/components/tools/simulator/PusherSync').PusherSync | null>(null);
  const simTimeRef = useRef(0);

  // Keep simTimeRef in sync for callbacks
  useEffect(() => { simTimeRef.current = simTime; }, [simTime]);

  // ── AudioEngine lazy init ─────────────────────────────────────────────────
  useEffect(() => {
    import('@/components/tools/simulator/AudioEngine').then(({ AudioEngine }) => {
      audioRef.current = new AudioEngine();
    });
    return () => audioRef.current?.dispose();
  }, []);

  // ── Load scenarios ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/simulator/scenarios')
      .then(r => r.json())
      .then(d => setScenarios(d.scenarios ?? []))
      .catch(() => {});
  }, []);

  // ── Wall-clock timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setSimTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // ── FHR → audio ───────────────────────────────────────────────────────────
  useEffect(() => { audioRef.current?.setFHR(currentFHR); }, [currentFHR]);

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
          if (d?.ctg)    setCtgParams(d.ctg);
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
          const p = event.params as Partial<CTGParams & { spo2: number; bp_systolic: number }>;
          setCtgParams(prev => ({
            ...prev,
            ...(p.fhr_baseline    !== undefined && { fhr_baseline:    p.fhr_baseline }),
            ...(p.fhr_variability !== undefined && { fhr_variability: p.fhr_variability }),
            ...(p.accelerations   !== undefined && { accelerations:   p.accelerations }),
            ...(p.decelerations   !== undefined && { decelerations:   p.decelerations }),
          }));
          if (p.spo2        !== undefined) setVitals(prev => ({ ...prev, spo2:        p.spo2! }));
          if (p.bp_systolic !== undefined) setVitals(prev => ({ ...prev, bp_systolic: p.bp_systolic! }));
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
          audioRef.current?.stopBeeping();
          setIsRunning(false);
          setPhase('debrief');
        }
      });

      const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
      sync.connect(key, process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'eu').catch(console.error);
    });

    return () => {
      unsub?.();
      pusherRef.current?.disconnect();
      pusherRef.current = null;
    };
  }, [sessionCode]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addTimeline = useCallback((type: TimelineEvent['type'], label: string, detail?: string) => {
    setTimeline(prev => [...prev, { id: `${type}_${Date.now()}`, timeSeconds: simTimeRef.current, type, label, detail }]);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    await audioRef.current?.initialize();
    audioRef.current?.startBeeping();
    setIsRunning(true);
    addTimeline('start', 'התחלת סימולציה');
    pusherRef.current?.publish({ type: 'timer-control', action: 'start' });
  }, [addTimeline]);

  const handleStop = useCallback(() => {
    audioRef.current?.stopBeeping();
    setIsRunning(false);
    pusherRef.current?.publish({ type: 'timer-control', action: 'pause' });
  }, []);

  const handleEndSim = useCallback(() => {
    audioRef.current?.stopBeeping();
    setIsRunning(false);
    addTimeline('end', 'סיום סימולציה');
    pusherRef.current?.publish({ type: 'session-end' });
    if (sessionCode) {
      fetch(`/api/simulator/sessions/${sessionCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }).catch(() => {});
    }
    setPhase('debrief');
  }, [addTimeline, sessionCode]);

  const handleNextCard = useCallback(() => {
    if (!selectedScenario) return;
    const next = currentCard + 1;
    if (next > selectedScenario.cards.length) return;
    const card = selectedScenario.cards.find(c => c.card_number === next);
    if (!card) return;
    setCurrentCard(next);
    addTimeline('card', `כרטיס ${next}`, card.title);
    pusherRef.current?.publish({
      type: 'card-advance',
      cardNumber: next,
      structuredData: card.structured_data,
    });
  }, [currentCard, selectedScenario, addTimeline]);

  const handlePrevCard = useCallback(() => {
    if (currentCard <= 1) return;
    const prev = currentCard - 1;
    if (!selectedScenario) return;
    const card = selectedScenario.cards.find(c => c.card_number === prev);
    if (!card) return;
    setCurrentCard(prev);
    pusherRef.current?.publish({
      type: 'card-advance',
      cardNumber: prev,
      structuredData: card.structured_data,
    });
  }, [currentCard, selectedScenario]);

  const handleOverride = useCallback((override: LiveOverrideParams) => {
    addTimeline('override', 'עקיפת ערכים');
    // Apply locally (Pusher does not echo events back to the sender)
    setCtgParams(prev => ({
      ...prev,
      ...(override.fhr_baseline   !== undefined && { fhr_baseline:   override.fhr_baseline }),
      ...(override.fhr_variability !== undefined && { fhr_variability: override.fhr_variability }),
      ...(override.accelerations  !== undefined && { accelerations:  override.accelerations }),
      ...(override.decelerations  !== undefined && { decelerations:  override.decelerations }),
    }));
    if (override.bp_systolic !== undefined) setVitals(prev => ({ ...prev, bp_systolic: override.bp_systolic! }));
    if (override.spo2        !== undefined) setVitals(prev => ({ ...prev, spo2:        override.spo2! }));
    // Broadcast to other devices
    pusherRef.current?.publish({ type: 'live-override', params: override });
  }, [addTimeline]);

  const handleAddNote = useCallback((note: Omit<NoteEntry, 'id'>) => {
    const n: NoteEntry = { ...note, id: `note_${Date.now()}` };
    setNotes(prev => [...prev, n]);
    addTimeline('note', note.content.slice(0, 50));
    fetch('/api/simulator/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionCode, author: note.author, role: urlRole, text: note.content, simTime: note.simTime, isQuickTag: note.isQuickTag, tagType: note.tagType }),
    }).catch(() => {});
    pusherRef.current?.publish({ type: 'note-added', author: note.author, role: urlRole, text: note.content, simTime: note.simTime, isQuickTag: note.isQuickTag, tagType: note.tagType });
  }, [addTimeline, sessionCode, urlRole]);

  const handleToggleMute = useCallback(() => {
    const muted = audioRef.current?.toggleMute() ?? false;
    setIsMuted(muted);
  }, []);

  const handleFHRUpdate = useCallback((fhr: number) => setCurrentFHR(fhr), []);

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
    if (!code) code = 'SIM-' + Math.random().toString(36).slice(2, 6).toUpperCase();

    // Load first card
    const first = selectedScenario.cards.find(c => c.card_number === 1);
    if (first?.structured_data) {
      const d = first.structured_data;
      if (d.ctg)     setCtgParams(d.ctg);
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
  }, [selectedScenario, residentName, midwifeName]);

  const handleAssessmentSubmit = useCallback(async (data: {
    scores: Record<string, 0 | 1 | 2>;
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
      />
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
        background: '#0d0d1f',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Patient banner */}
      <PatientBanner patient={patient} simTimeSeconds={simTime} isRunning={isRunning} />

      {/* Session meta bar */}
      <div style={{
        background: 'rgba(124,58,237,0.07)',
        borderBottom: '1px solid rgba(139,92,246,0.18)',
        padding: '4px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        {sessionCode && (
          <span style={{ color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
            📡 {sessionCode}
          </span>
        )}
        {isMidwife && (
          <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>👁 מצב משקיף</span>
        )}
        {!isMidwife && sessionCode && (
          <button
            onClick={() => setQrOpen(true)}
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 6, color: '#c4b5fd', fontSize: '0.7rem', cursor: 'pointer', padding: '3px 10px', fontFamily: 'inherit', marginRight: 'auto' }}
          >
            📱 חבר מסך שני
          </button>
        )}
        {!isMidwife && (
          <button
            onClick={() => setPatientEditOpen(true)}
            style={{ background: 'none', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', padding: '2px 10px', fontFamily: 'inherit', marginRight: 'auto' }}
          >
            ✎ עדכן פרטי מטופלת
          </button>
        )}
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Left: CTG + EHR */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* CTG + Vitals row */}
          <div style={{ flex: '0 0 360px', display: 'flex', minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <CTGMonitor ctgParams={ctgParams} maternalHR={vitals.hr} isRunning={isRunning} onFHRUpdate={handleFHRUpdate} />
            </div>
            <div style={{ width: 195, flexShrink: 0, borderLeft: '1px solid rgba(139,92,246,0.15)', padding: 10 }}>
              <VitalSignsDisplay fhr={currentFHR} vitals={vitals} isRunning={isRunning} />
            </div>
          </div>

          {/* EHR Labs */}
          <div style={{ flex: 1, minHeight: 0, borderTop: '2px solid rgba(139,92,246,0.2)' }}>
            <EHRLabsPanel rows={labRows} />
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 275,
          flexShrink: 0,
          borderLeft: '1px solid rgba(139,92,246,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.01)',
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
                  onAddNote={() => {/* NoteSystem has its own add button */}}
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
                    padding: '8px 10px',
                    background: 'rgba(139,92,246,0.07)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    borderRadius: 8,
                  }}>
                    <div style={{ color: '#a78bfa', fontSize: '0.68rem', fontWeight: 700, marginBottom: 3 }}>
                      ▶ {currentCardData.title}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.71rem', lineHeight: 1.5, maxHeight: 70, overflowY: 'auto' }}>
                      {currentCardData.clinical_description}
                    </div>
                  </div>
                  {/* Next card preview */}
                  {selectedScenario?.cards.find(c => c.card_number === currentCard + 1) && (() => {
                    const next = selectedScenario.cards.find(c => c.card_number === currentCard + 1)!;
                    return (
                      <div style={{
                        padding: '7px 10px',
                        background: 'rgba(255,255,255,0.015)',
                        border: '1px dashed rgba(139,92,246,0.15)',
                        borderRadius: 8,
                        opacity: 0.65,
                      }}>
                        <div style={{ color: '#7c3aed', fontSize: '0.65rem', fontWeight: 700, marginBottom: 3 }}>
                          הבא · {next.title}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.68rem', lineHeight: 1.4, maxHeight: 52, overflowY: 'auto' }}>
                          {next.clinical_description}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* Notes system — takes remaining space */}
          <div style={{ flex: 1, minHeight: 0, marginTop: 8, borderTop: '1px solid rgba(139,92,246,0.12)' }}>
            <NoteSystem
              role={isMidwife ? 'midwife_supervisor' : 'instructor'}
              simTimeSeconds={simTime}
              isRunning={isRunning}
              notes={notes}
              notepadContent={notepadContent}
              onAddNote={handleAddNote}
              onNotepadChange={setNotepadContent}
            />
          </div>
        </div>
      </div>

      {/* Live override panel (modal) */}
      <LiveOverridePanel
        isOpen={overrideOpen}
        currentFHR={currentFHR}
        currentVariability={ctgParams.fhr_variability}
        currentAccelerations={ctgParams.accelerations}
        currentDecelerations={ctgParams.decelerations}
        currentBP={{ systolic: vitals.bp_systolic, diastolic: vitals.bp_diastolic }}
        currentSpo2={vitals.spo2}
        onApply={handleOverride}
        onClose={() => setOverrideOpen(false)}
      />

      {/* End simulation confirmation */}
      {confirmEndOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmEndOpen(false); }}
        >
          <div dir="rtl" style={{ background: '#1a1a2e', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', color: '#f1f5f9', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏹</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700 }}>סיום סימולציה?</h3>
            <p style={{ margin: '0 0 24px', color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6 }}>
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
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid rgba(156,163,175,0.3)', background: 'rgba(255,255,255,0.04)', color: '#9ca3af', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
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
        const joinUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/tools/simulator/join?code=${sessionCode}`
          : `/tools/simulator/join?code=${sessionCode}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(joinUrl)}`;
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) setQrOpen(false); }}
          >
            <div dir="rtl" style={{ background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.45)', borderRadius: 18, padding: '28px 32px', maxWidth: 360, width: '100%', color: '#f1f5f9', boxShadow: '0 25px 60px rgba(0,0,0,0.7)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#c4b5fd' }}>📱 חיבור מסך שני</h3>
                <button onClick={() => setQrOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.1rem', fontFamily: 'inherit' }}>✕</button>
              </div>

              {/* QR code */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 8, display: 'inline-block', marginBottom: 18 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR code" width={180} height={180} style={{ display: 'block' }} />
              </div>

              {/* Session code */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: '#6b7280', fontSize: '0.72rem', marginBottom: 4 }}>קוד סשן</div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.15em' }}>{sessionCode}</div>
              </div>

              {/* Copy URL */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: '0.68rem', color: '#9ca3af', overflowX: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>{joinUrl}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(joinUrl).catch(() => {})}
                  style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 5, color: '#c4b5fd', fontSize: '0.68rem', cursor: 'pointer', padding: '3px 8px', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                >
                  העתק
                </button>
              </div>

              <p style={{ color: '#4b5563', fontSize: '0.72rem', margin: 0, lineHeight: 1.6 }}>
                סרקו את הקוד QR עם הטאבלט השני או הדביקו את הקישור בדפדפן
              </p>
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

// ── Page wrapper with Suspense for useSearchParams ───────────────────────────
export default function SimulatorPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#0d0d1f', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: 'inherit' }}>
        טוען...
      </div>
    }>
      <SimulatorPageInner />
    </Suspense>
  );
}
