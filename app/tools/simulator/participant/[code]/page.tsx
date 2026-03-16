'use client';

import nextDynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { CTGParams, VitalSigns, PatientInfo, CardLabs } from '@/lib/simulatorTypes';
import { CTG_PRESETS } from '@/lib/ctgPresets';
import PatientBanner from '@/components/tools/simulator/PatientBanner';
import VitalSignsDisplay from '@/components/tools/simulator/VitalSignsDisplay';

// Prevent edge-caching stale HTML for participant sessions
export const dynamic = 'force-dynamic';

const CTGMonitor = nextDynamic(() => import('@/components/tools/simulator/CTGMonitor'), { ssr: false });

const DEFAULT_PATIENT: PatientInfo = {
  name: '—', age: 0, gravida: 0, para: 0,
  gestational_weeks: 0, gestational_days: 0,
};
const DEFAULT_CTG    = CTG_PRESETS.normal.ctg;
const DEFAULT_VITALS = CTG_PRESETS.normal.vitals;

// ── Simple labs renderer ──────────────────────────────────────────────────────
function LabsGrid({ labs, abnormal }: { labs: CardLabs; abnormal: string[] }) {
  const rows: { key: string; label: string; value: string; unit: string }[] = [];

  const push = (key: string, label: string, val: number | undefined, unit: string, digits = 1) => {
    if (val !== undefined) rows.push({ key, label, value: val.toFixed(digits), unit });
  };

  // CBC
  push('hgb',  'HGB',  labs.cbc?.hgb,  'g/dL');
  push('plt',  'PLT',  labs.cbc?.plt,  'K/μL', 0);
  push('wbc',  'WBC',  labs.cbc?.wbc,  'K/μL');
  push('hct',  'HCT',  labs.cbc?.hct,  '%');

  // Chemistry
  push('cre',  'Cre',  labs.chemistry?.cre, 'mg/dL', 2);
  push('ast',  'AST',  labs.chemistry?.ast, 'U/L', 0);
  push('alt',  'ALT',  labs.chemistry?.alt, 'U/L', 0);
  push('ldh',  'LDH',  labs.chemistry?.ldh, 'U/L', 0);
  push('ur_ac','Uric', labs.chemistry?.ur_ac, 'mg/dL');
  push('alb',  'Alb',  labs.chemistry?.alb,  'g/dL');

  // Coagulation
  push('pt_pct','PT%', labs.coagulation?.pt_pct, '%', 0);
  push('inr',  'INR',  labs.coagulation?.inr,    '', 2);
  push('ptt',  'PTT',  labs.coagulation?.ptt,    'sec', 0);
  push('fib',  'Fib',  labs.coagulation?.fib,    'mg/dL', 0);
  push('d_dimer','D-dim', labs.coagulation?.d_dimer, 'μg/mL', 2);

  // Other
  push('crp',  'CRP',  labs.other?.crp, 'mg/L');
  push('protein_creatinine_ratio', 'P/C', labs.other?.protein_creatinine_ratio, '', 2);

  if (rows.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
      {rows.map(r => {
        const isAbnormal = abnormal.includes(r.key);
        return (
          <span key={r.key} style={{ fontSize: '0.82rem', display: 'flex', gap: 4, alignItems: 'baseline' }}>
            <span style={{ color: '#6b7280' }}>{r.label}:</span>
            <span style={{
              color: isAbnormal ? '#f87171' : '#e2e8f0',
              fontWeight: isAbnormal ? 700 : 500,
              textDecoration: isAbnormal ? 'underline' : 'none',
            }}>
              {r.value}
            </span>
            {r.unit && <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{r.unit}</span>}
          </span>
        );
      })}
    </div>
  );
}

// ── Trainee page ──────────────────────────────────────────────────────────────
export default function TraineePage() {
  const pathname = usePathname();
  const code = pathname?.split('/').pop() ?? '';

  const [isRunning, setIsRunning]       = useState(false);
  const [simEnded, setSimEnded]         = useState(false);
  const [ctgParams, setCtgParams]       = useState<CTGParams>(DEFAULT_CTG);
  const [vitals, setVitals]             = useState<VitalSigns>(DEFAULT_VITALS);
  const [patient, setPatient]           = useState<PatientInfo>(DEFAULT_PATIENT);
  const [labs, setLabs]                 = useState<CardLabs | null>(null);
  const [abnormalFields, setAbnormal]   = useState<string[]>([]);
  const [description, setDescription]   = useState('');
  const [cardTitle, setCardTitle]       = useState('');
  const [cardNumber, setCardNumber]     = useState(0);
  const [currentFHR, setCurrentFHR]     = useState(DEFAULT_CTG.fhr_baseline);
  const [simTime, setSimTime]           = useState(0);
  const [dbgStatus, setDbgStatus]       = useState('idle');
  const [dbgEvents, setDbgEvents]       = useState(0);
  const [dbgLast, setDbgLast]           = useState('');
  const [dbgPoll, setDbgPoll]           = useState('idle');
  const [dbgPollN, setDbgPollN]         = useState(0);
  // Render counter — incremented every render without needing effects
  const renderN = useRef(0);
  renderN.current++;
  const audioRef         = useRef<import('@/components/tools/simulator/AudioEngine').AudioEngine | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const pusherRef        = useRef<import('@/components/tools/simulator/PusherSync').PusherSync | null>(null);
  const stateInitialized = useRef(false);

  // Dead-simple mount effect — if this doesn't fire, React hydration is broken
  useEffect(() => { setDbgPoll('fx:mounted'); }, []);

  // Init audio engine
  useEffect(() => {
    import('@/components/tools/simulator/AudioEngine').then(({ AudioEngine }) => {
      audioRef.current = new AudioEngine();
      audioRef.current.initialize().catch(() => {});
    });
    return () => audioRef.current?.dispose();
  }, []);

  // Poll DB-backed live state every 2s — works across serverless instances
  useEffect(() => {
    let lastUpdatedAt: number | null = null;
    const poll = async () => {
      setDbgPollN(n => n + 1);
      try {
        const res  = await fetch(`/api/sim-state/${code}`);
        if (!res.ok) { setDbgPoll(`e${res.status}`); return; }
        const data = await res.json() as { payload: unknown; updatedAt: number | null; dbOk?: boolean };
        const dbTag = data.dbOk ? 'db' : 'mem';
        if (!data.payload) { setDbgPoll(`${dbTag}:null`); return; }
        if (data.updatedAt === lastUpdatedAt) { setDbgPoll(`${dbTag}:same`); return; }
        lastUpdatedAt = data.updatedAt;

        const snap = data.payload as {
          type?: string;
          cardNumber?: number;
          structuredData?: {
            ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[];
            clinical_description?: string; card_title?: string;
          } | null;
          isRunning?: boolean;
          simTimeSeconds?: number;
        };
        if (snap.type !== 'state-snapshot') { setDbgPoll(`${dbTag}:t:${snap.type}`); return; }
        setDbgPoll(`${dbTag}:got`);

        const d = snap.structuredData;
        if (d?.ctg)                  setCtgParams(d.ctg);
        if (d?.vitals)               setVitals(d.vitals);
        if (d?.patient)              setPatient(d.patient);
        if (d?.labs)                 setLabs(d.labs);
        if (d?.abnormal_fields)      setAbnormal(d.abnormal_fields);
        if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
        if (d?.card_title !== undefined)           setCardTitle(d.card_title);
        if ((snap.cardNumber ?? 0) > 0)            setCardNumber(snap.cardNumber!);
        if (!stateInitialized.current && snap.simTimeSeconds !== undefined) {
          setSimTime(snap.simTimeSeconds);
          stateInitialized.current = true;
        }
        if (snap.isRunning) {
          setIsRunning(true);
          audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
        }
      } catch { setDbgPoll('err'); }
    };

    poll(); // immediate on mount
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setSimTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // FHR → audio
  useEffect(() => { audioRef.current?.setFHR(currentFHR); }, [currentFHR]);

  // Pusher
  useEffect(() => {
    import('@/components/tools/simulator/PusherSync').then(({ PusherSync }) => {
      const sync = new PusherSync(code);
      pusherRef.current = sync;

      const unsub = sync.subscribe(event => {
        setDbgEvents(n => n + 1);
        setDbgLast(event.type);
        if (event.type === 'timer-control') {
          if (event.action === 'start' || event.action === 'resume') {
            setIsRunning(true);
            audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
          } else if (event.action === 'pause' || event.action === 'stop') {
            audioRef.current?.stopBeeping();
            setIsRunning(false);
          }
        }

        if (event.type === 'card-advance') {
          const d = event.structuredData as {
            ctg?: CTGParams;
            vitals?: VitalSigns;
            patient?: PatientInfo;
            labs?: CardLabs;
            abnormal_fields?: string[];
            clinical_description?: string;
            card_title?: string;
          } | null;
          if (d?.ctg)                  setCtgParams(d.ctg);
          if (d?.vitals)               setVitals(d.vitals);
          if (d?.patient)              setPatient(d.patient);
          if (d?.labs)                 setLabs(d.labs);
          if (d?.abnormal_fields)      setAbnormal(d.abnormal_fields);
          if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
          if (d?.card_title !== undefined)           setCardTitle(d.card_title);
          setCardNumber(event.cardNumber);
        }

        if (event.type === 'live-override') {
          const p = event.params;
          setCtgParams(prev => ({ ...prev, ...p }));
          if ((p as { spo2?: number }).spo2 !== undefined)
            setVitals(prev => ({ ...prev, spo2: (p as { spo2: number }).spo2 }));
        }

        if (event.type === 'session-end') {
          audioRef.current?.stopBeeping();
          setIsRunning(false);
          setSimEnded(true);
        }

        if (event.type === 'state-snapshot') {
          const d = event.structuredData as {
            ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[];
            clinical_description?: string; card_title?: string;
          } | null;
          if (d?.ctg)                  setCtgParams(d.ctg);
          if (d?.vitals)               setVitals(d.vitals);
          if (d?.patient)              setPatient(d.patient);
          if (d?.labs)                 setLabs(d.labs);
          if (d?.abnormal_fields)      setAbnormal(d.abnormal_fields);
          if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
          if (d?.card_title !== undefined)           setCardTitle(d.card_title);
          if (event.cardNumber > 0)    setCardNumber(event.cardNumber);
          // Only sync clock on first snapshot to avoid jumps on periodic heartbeats
          if (!stateInitialized.current) {
            setSimTime(event.simTimeSeconds);
            stateInitialized.current = true;
          }
          if (event.isRunning) {
            setIsRunning(true);
            audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
          }
        }
      });

      sync.connect(
        process.env.NEXT_PUBLIC_PUSHER_KEY,
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap2',
      ).then(() => {
        setDbgStatus('connected ✓');
        setTimeout(() => sync.publish({ type: 'request-state' }), 800);
      }).catch((e) => {
        setDbgStatus(`error: ${String(e).slice(0, 40)}`);
      });

      return unsub;
    });

    return () => { pusherRef.current?.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleFHRUpdate = useCallback((fhr: number) => setCurrentFHR(fhr), []);

  return (
    <div style={{
      background: '#0d0d1f',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      <PatientBanner patient={patient} simTimeSeconds={simTime} isRunning={isRunning} />

      {/* Debug bar — remove once confirmed working */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
        background: '#0a0a1a', borderTop: '1px solid #222',
        padding: '3px 10px', fontSize: '0.65rem', fontFamily: 'monospace',
        color: dbgPoll === 'got' ? '#22c55e' : dbgPoll.startsWith('e') ? '#f87171' : '#f59e0b',
        display: 'flex', gap: 14, flexWrap: 'wrap',
      }}>
        <span suppressHydrationWarning>R:{renderN.current}</span>
        <span>P:{dbgStatus}</span>
        <span>DB:{dbgPoll}({dbgPollN})</span>
        <span>Ev:{dbgEvents}{dbgLast ? '/' + dbgLast : ''}</span>
        <span>code:{code||'?'}</span>
      </div>

      {/* Session-ended overlay */}
      {simEnded && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: 'rgba(13,13,31,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
        }}>
          <div style={{ fontSize: '2.5rem' }}>✅</div>
          <div style={{ color: '#c4b5fd', fontSize: '1.4rem', fontWeight: 700 }}>הסימולציה הסתיימה</div>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
            תודה על השתתפותך
          </div>
        </div>
      )}

      {/* CTG + Vitals */}
      <div style={{ flex: '0 0 370px', display: 'flex', minHeight: 0 }}>
        <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0 }}>
          <CTGMonitor ctgParams={ctgParams} maternalHR={vitals.hr} isRunning={isRunning} onFHRUpdate={handleFHRUpdate} />
        </div>
        <div style={{ width: 210, flexShrink: 0, borderLeft: '1px solid rgba(139,92,246,0.15)', padding: 10 }}>
          <VitalSignsDisplay fhr={currentFHR} vitals={vitals} isRunning={isRunning} />
        </div>
      </div>

      {/* Clinical data panel */}
      <div style={{
        flex: 1, minHeight: 0,
        borderTop: '2px solid rgba(139,92,246,0.2)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Panel header */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid rgba(139,92,246,0.12)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          {cardNumber > 0 && (
            <span style={{
              background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)',
              borderRadius: 6, padding: '2px 8px',
              color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 700,
            }}>
              כרטיס {cardNumber}
            </span>
          )}
          {cardTitle && (
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }} dir="rtl">
              {cardTitle}
            </span>
          )}
          {!cardNumber && (
            <span style={{ color: '#4b5563', fontSize: '0.82rem' }}>ממתין לנתונים קליניים...</span>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }} dir="rtl">

          {/* Clinical description */}
          {description && (
            <div>
              <div style={{ color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                תיאור קליני
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {description}
              </div>
            </div>
          )}

          {/* Labs */}
          {labs && (
            <div>
              <div style={{ color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                תוצאות מעבדה
              </div>
              <LabsGrid labs={labs} abnormal={abnormalFields} />
              {labs.other?.blood_type && (
                <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#fbbf24' }}>
                  סוג דם: {labs.other.blood_type}
                </div>
              )}
            </div>
          )}

          {/* Medical history */}
          {patient.history && (
            <div>
              <div style={{ color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                רקע רפואי
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.82rem', lineHeight: 1.6 }}>
                {patient.history}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

