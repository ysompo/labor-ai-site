'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { use } from 'react';
import type { CTGParams, VitalSigns, PatientInfo, CardLabs, PushedLabRow } from '@/lib/simulatorTypes';
import type { LabRow } from '@/components/tools/simulator/EHRLabsPanel';
import { CTG_PRESETS } from '@/lib/ctgPresets';
import { SEEDED_SCENARIOS } from '@/lib/simulatorScenarios';
import PatientBanner from '@/components/tools/simulator/PatientBanner';
import VitalSignsDisplay from '@/components/tools/simulator/VitalSignsDisplay';
import { useSimTheme, ThemeToggleButton } from '@/components/tools/simulator/SimThemeProvider';

const CTGMonitor   = dynamic(() => import('@/components/tools/simulator/CTGMonitor'),   { ssr: false });
const EHRLabsPanel = dynamic(() => import('@/components/tools/simulator/EHRLabsPanel'), { ssr: false });

const DEFAULT_PATIENT: PatientInfo = {
  name: '—', age: 0, gravida: 0, para: 0,
  gestational_weeks: 0, gestational_days: 0,
};
const DEFAULT_CTG    = CTG_PRESETS.normal.ctg;
const DEFAULT_VITALS = CTG_PRESETS.normal.vitals;

function makeLabRow(labs: CardLabs, abnormal: string[]): LabRow {
  return {
    id: `card_${Date.now()}`,
    timestamp: new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
    material: 'דם',
    labs,
    abnormal_fields: abnormal,
  };
}

// Plain 'use client' page — same pattern as live/[code]/page.tsx (no RSC boundary)
export default function TraineePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { theme } = useSimTheme();

  const [isRunning, setIsRunning]     = useState(false);
  const [simEnded, setSimEnded]       = useState(false);
  const [ctgParams, setCtgParams]     = useState<CTGParams>(DEFAULT_CTG);
  const [vitals, setVitals]           = useState<VitalSigns>(DEFAULT_VITALS);
  const [patient, setPatient]         = useState<PatientInfo>(DEFAULT_PATIENT);
  const [labRows, setLabRows]         = useState<LabRow[]>([]);
  const [description, setDescription] = useState('');
  const [cardTitle, setCardTitle]     = useState('');
  const [cardNumber, setCardNumber]   = useState(0);
  const [currentFHR, setCurrentFHR]   = useState(DEFAULT_CTG.fhr_baseline);
  const [ctgResetKey, setCtgResetKey]             = useState(0);
  const [ctgRetroactiveKey, setCtgRetroactiveKey] = useState(0);
  const [simTime, setSimTime]         = useState(0);
  const [mounted, setMounted]         = useState(false);
  const [isPortrait, setIsPortrait]   = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [dbgStatus, setDbgStatus]     = useState('idle');
  const [dbgPoll, setDbgPoll]         = useState('idle');
  const [dbgPollN, setDbgPollN]       = useState(0);
  const [dbgEvents, setDbgEvents]     = useState(0);
  const [dbgLast, setDbgLast]         = useState('');

  // Opening vignette popup
  const [vignette, setVignette]         = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [vignetteOpen, setVignetteOpen] = useState(false);

  const audioRef         = useRef<import('@/components/tools/simulator/AudioEngine').AudioEngine | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const pusherRef        = useRef<import('@/components/tools/simulator/PusherSync').PusherSync | null>(null);
  const stateInitialized = useRef(false);
  // Tracks which card numbers have already had their labs appended — prevents
  // repeated snapshot deliveries from adding the same card's labs multiple times.
  const loadedLabCards   = useRef<Set<number>>(new Set());
  // Same dedupe for live-pushed lab rows (keyed by row id, separate from card labs)
  const loadedPushedLabs = useRef<Set<string>>(new Set());
  const vignetteSeen     = useRef(false);
  // Simulation speed — clinical seconds per real second, driven by the instructor
  const [simSpeed, setSimSpeed] = useState(5);
  const simSpeedRef      = useRef(5);

  const applySimSpeed = useCallback((speed?: number) => {
    if (!speed || speed === simSpeedRef.current) return;
    simSpeedRef.current = speed;
    setSimSpeed(speed);
  }, []);

  // Append live-pushed lab rows in order, skipping ones already shown.
  // Snapshots carry the full pushed history so late joiners replay everything.
  const appendPushedRows = useCallback((rows?: PushedLabRow[]) => {
    if (!rows?.length) return;
    const fresh = rows.filter(r => r?.id && !loadedPushedLabs.current.has(r.id));
    if (!fresh.length) return;
    fresh.forEach(r => loadedPushedLabs.current.add(r.id));
    setLabRows(prev => [...prev, ...fresh.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      material: r.material ?? 'דם',
      labs: r.labs,
      abnormal_fields: r.abnormal_fields ?? [],
    } as LabRow))]);
  }, []);

  // Show the opening vignette once per session code (survives refresh via sessionStorage)
  const maybeShowVignette = useCallback((text?: string, name?: string) => {
    if (!text || vignetteSeen.current) return;
    vignetteSeen.current = true;
    setVignette(text);
    if (name) setScenarioName(name);
    try {
      if (sessionStorage.getItem('sim_vignette_' + code) === 'done') return;
    } catch { /* private mode */ }
    setVignetteOpen(true);
  }, [code]);

  const dismissVignette = useCallback(() => {
    try { sessionStorage.setItem('sim_vignette_' + code, 'done'); } catch { /* ignore */ }
    setVignetteOpen(false);
  }, [code]);

  useEffect(() => {
    setMounted(true);
    const update = () => setIsPortrait(window.innerWidth < window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    import('@/components/tools/simulator/AudioEngine').then(({ AudioEngine }) => {
      audioRef.current = new AudioEngine();
      audioRef.current.initialize().catch(() => {});
    });
    return () => audioRef.current?.dispose();
  }, []);

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
          type?: string; cardNumber?: number;
          structuredData?: { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[];
            clinical_description?: string; card_title?: string; } | null;
          isRunning?: boolean; simTimeSeconds?: number;
          pushedLabs?: PushedLabRow[]; caseStory?: string; scenarioName?: string;
          simSpeed?: number;
        };
        if (snap.type !== 'state-snapshot') { setDbgPoll(`${dbTag}:t:${snap.type}`); return; }
        setDbgPoll(`${dbTag}:got`);
        const d = snap.structuredData;
        if (d?.ctg)    setCtgParams(d.ctg);
        if (d?.vitals) setVitals(d.vitals);
        if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
        if (d?.labs) {
          const cn = snap.cardNumber ?? 0;
          if (cn > 0 && !loadedLabCards.current.has(cn)) {
            loadedLabCards.current.add(cn);
            setLabRows(prev => [...prev, makeLabRow(d.labs!, d.abnormal_fields ?? [])]);
          } else if (cn === 0 && loadedLabCards.current.size === 0) {
            loadedLabCards.current.add(0);
            setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
          }
        }
        appendPushedRows(snap.pushedLabs);
        maybeShowVignette(snap.caseStory, snap.scenarioName);
        applySimSpeed(snap.simSpeed);
        if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
        if (d?.card_title !== undefined)           setCardTitle(d.card_title);
        if ((snap.cardNumber ?? 0) > 0)            setCardNumber(snap.cardNumber!);
        if (snap.simTimeSeconds !== undefined) {
          // Compensate for how long ago the snapshot was written
          const latencySimSecs = (snap as { wallClockMs?: number }).wallClockMs
            ? Math.round((Date.now() - (snap as { wallClockMs: number }).wallClockMs) * simSpeedRef.current / 1000)
            : 0;
          setSimTime(snap.simTimeSeconds + latencySimSecs);
          stateInitialized.current = true;
        }
        if (snap.isRunning) {
          setIsRunning(true);
          audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
        } else {
          setIsRunning(false);
          audioRef.current?.stopBeeping();
        }
      } catch { setDbgPoll('err'); }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);

  }, [code, appendPushedRows, maybeShowVignette]);

  // Reliable initial-state load: if scenario ID is in the URL (?s=N), load
  // card 1 directly from SEEDED_SCENARIOS — no API call, no DB needed.
  // Falls back to sessions + scenarios API if ?s is absent (e.g. old links).
  // Note: we read window.location.search directly for old Safari/iPad compat.
  useEffect(() => {
    let cancelled = false;

    // Fast path: scenario ID embedded in URL by instructor QR modal
    const sParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('s')
      : null;
    const scenarioId = sParam ? parseInt(sParam) : 0;
    if (scenarioId > 0) {
      const seeded = SEEDED_SCENARIOS[scenarioId - 1]; // 0-indexed
      if (seeded?.case_story) maybeShowVignette(seeded.case_story, seeded.name);
      const card1 = seeded?.cards.find(c => c.card_number === 1);
      if (card1 && !stateInitialized.current) {
        const d = card1.structured_data;
        if (d?.ctg)    setCtgParams(d.ctg);
        if (d?.vitals) setVitals(d.vitals);
        if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
        if (d?.labs) {
          loadedLabCards.current.add(1);
          setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
        }
        if (card1.clinical_description) setDescription(card1.clinical_description);
        setCardTitle(card1.title);
        setCardNumber(1);
      }
      return; // done — Pusher/polling will advance to current card
    }

    // Slow path: fetch session then scenarios API (requires DB or Pusher)
    (async () => {
      try {
        const sRes = await fetch(`/api/simulator/sessions/${code}`);
        if (!sRes.ok || cancelled) return;
        const sData = await sRes.json() as { session?: { scenario_id?: number } };
        const sid = sData.session?.scenario_id;
        if (!sid || cancelled) return;

        const scRes = await fetch('/api/simulator/scenarios');
        if (!scRes.ok || cancelled) return;
        const scData = await scRes.json() as { scenarios?: Array<{
          id: number; name?: string; case_story?: string; cards: Array<{
            card_number: number; title: string; clinical_description: string;
            structured_data: { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
              labs?: CardLabs; abnormal_fields?: string[]; } | null;
          }>;
        }> };
        const scenario = scData.scenarios?.find(sc => sc.id === sid);
        if (scenario?.case_story && !cancelled) maybeShowVignette(scenario.case_story, scenario.name);
        const card1 = scenario?.cards.find(c => c.card_number === 1);
        if (!card1 || cancelled || stateInitialized.current) return;
        const d = card1.structured_data;
        if (d?.ctg)    setCtgParams(d.ctg);
        if (d?.vitals) setVitals(d.vitals);
        if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
        if (d?.labs) {
          loadedLabCards.current.add(1);
          setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
        }
        if (card1.clinical_description) setDescription(card1.clinical_description);
        setCardTitle(card1.title);
        setCardNumber(1);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };

  }, [code, maybeShowVignette]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setSimTime(t => t + simSpeedRef.current), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  useEffect(() => { audioRef.current?.setFHR(currentFHR); }, [currentFHR]);

  useEffect(() => {
    let requestRetryId: ReturnType<typeof setInterval> | null = null;
    import('@/components/tools/simulator/PusherSync').then(({ PusherSync }) => {
      const sync = new PusherSync(code);
      pusherRef.current = sync;
      const unsub = sync.subscribe(event => {
        setDbgEvents(n => n + 1);
        setDbgLast(event.type);
        if (event.type === 'timer-control') {
          if (event.action === 'start' || event.action === 'resume') {
            // Sync clock to instructor's time, compensating for network latency
            if (event.simTimeSeconds !== undefined) {
              const latencySimSecs = event.wallClockMs
                ? Math.round((Date.now() - event.wallClockMs) * 5 / 1000)
                : 0;
              setSimTime(event.simTimeSeconds + latencySimSecs);
              stateInitialized.current = true;
            }
            setIsRunning(true);
            audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
          } else if (event.action === 'pause' || event.action === 'stop') {
            if (event.simTimeSeconds !== undefined) setSimTime(event.simTimeSeconds);
            audioRef.current?.stopBeeping();
            setIsRunning(false);
          }
        }
        if (event.type === 'card-advance') {
          const d = event.structuredData as { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[]; clinical_description?: string; card_title?: string; } | null;
          if (d?.ctg)    setCtgParams(d.ctg);
          if (d?.vitals) setVitals(d.vitals);
          if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
          if (d?.labs) {
            loadedLabCards.current.add(event.cardNumber);
            setLabRows(prev => [...prev, makeLabRow(d.labs!, d.abnormal_fields ?? [])]);
          }
          if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
          if (d?.card_title !== undefined)           setCardTitle(d.card_title);
          setCardNumber(event.cardNumber);
        }
        if (event.type === 'live-override') {
          if (event.retroactive) setCtgRetroactiveKey(k => k + 1);
          const p = event.params as {
            fhr_baseline?: number; fhr_variability?: string; accelerations?: string;
            decelerations?: string; contraction_frequency?: number; contraction_intensity?: string;
            special?: string; hr?: number; bp_systolic?: number; bp_diastolic?: number;
            spo2?: number; temp?: number;
          };
          setCtgParams(prev => ({
            ...prev,
            ...(p.fhr_baseline         !== undefined && { fhr_baseline:          p.fhr_baseline }),
            ...(p.fhr_variability      !== undefined && { fhr_variability:       p.fhr_variability as CTGParams['fhr_variability'] }),
            ...(p.accelerations        !== undefined && { accelerations:         p.accelerations as CTGParams['accelerations'] }),
            ...(p.decelerations        !== undefined && { decelerations:         p.decelerations as CTGParams['decelerations'] }),
            ...(p.contraction_frequency !== undefined && { contraction_frequency: p.contraction_frequency }),
            ...(p.contraction_intensity !== undefined && { contraction_intensity: p.contraction_intensity as CTGParams['contraction_intensity'] }),
            ...(p.special              !== undefined && { special:               p.special as CTGParams['special'] }),
          }));
          const vitalsUpdate: Partial<VitalSigns> = {};
          if (p.hr           !== undefined) vitalsUpdate.hr           = p.hr;
          if (p.bp_systolic  !== undefined) vitalsUpdate.bp_systolic  = p.bp_systolic;
          if (p.bp_diastolic !== undefined) vitalsUpdate.bp_diastolic = p.bp_diastolic;
          if (p.spo2         !== undefined) vitalsUpdate.spo2         = p.spo2;
          if (p.temp         !== undefined) vitalsUpdate.temp         = p.temp;
          if (Object.keys(vitalsUpdate).length > 0) setVitals(prev => ({ ...prev, ...vitalsUpdate }));
        }
        if (event.type === 'labs-push') {
          appendPushedRows([event.row]);
        }
        if (event.type === 'speed-change') {
          applySimSpeed(event.simSpeed);
        }
        if (event.type === 'session-end') {
          audioRef.current?.stopBeeping();
          setIsRunning(false);
          setSimEnded(true);
          setVignetteOpen(false);
        }
        if (event.type === 'state-snapshot') {
          const d = event.structuredData as { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[]; clinical_description?: string; card_title?: string; } | null;
          if (d?.ctg)    setCtgParams(d.ctg);
          if (d?.vitals) setVitals(d.vitals);
          if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
          if (d?.labs) {
            const cn = event.cardNumber ?? 0;
            if (cn > 0 && !loadedLabCards.current.has(cn)) {
              loadedLabCards.current.add(cn);
              setLabRows(prev => [...prev, makeLabRow(d.labs!, d.abnormal_fields ?? [])]);
            } else if (cn === 0 && loadedLabCards.current.size === 0) {
              loadedLabCards.current.add(0);
              setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
            }
          }
          appendPushedRows(event.pushedLabs);
          maybeShowVignette(event.caseStory, event.scenarioName);
          applySimSpeed(event.simSpeed);
          if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
          if (d?.card_title !== undefined)           setCardTitle(d.card_title);
          if (event.cardNumber > 0)    setCardNumber(event.cardNumber);
          // Always resync clock from authoritative instructor snapshot,
          // correcting for network latency using the embedded wall-clock stamp.
          {
            const latencySimSecs = event.wallClockMs
              ? Math.round((Date.now() - event.wallClockMs) * simSpeedRef.current / 1000)
              : 0;
            setSimTime(event.simTimeSeconds + latencySimSecs);
            stateInitialized.current = true;
          }
          if (event.isRunning) {
            setIsRunning(true);
            audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
          } else {
            setIsRunning(false);
            audioRef.current?.stopBeeping();
          }
        }
      });
      sync.connect(
        process.env.NEXT_PUBLIC_PUSHER_KEY,
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap2',
      ).then(() => {
        setDbgStatus('ok');
        // Send request-state once immediately, then retry every 8s until we have data
        const sendRequest = () => sync.publish({ type: 'request-state' });
        setTimeout(sendRequest, 800);
        requestRetryId = setInterval(() => {
          if (stateInitialized.current) { clearInterval(requestRetryId!); requestRetryId = null; return; }
          sendRequest();
        }, 8000);
      }).catch((e) => {
        setDbgStatus(`err:${String(e).slice(0, 20)}`);
      });
    });
    return () => {
      if (requestRetryId !== null) clearInterval(requestRetryId);
      pusherRef.current?.disconnect();
    };

  }, [code, appendPushedRows, maybeShowVignette]);

  const handleFHRUpdate = useCallback((fhr: number) => setCurrentFHR(fhr), []);

  const handleToggleMute = useCallback(() => {
    audioRef.current?.toggleMute();
    setIsMuted(m => !m);
  }, []);

  return (
    <div style={{
      background: theme.bg, height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden',
    }}>
      <PatientBanner patient={patient} simTimeSeconds={simTime} isRunning={isRunning} />

      {process.env.NODE_ENV !== 'production' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
          background: '#0a0a1a', borderTop: '1px solid #222',
          padding: '3px 10px', fontSize: '0.65rem', fontFamily: 'monospace',
          color: dbgPoll.includes('got') ? '#22c55e' : '#f59e0b',
          display: 'flex', gap: 14, flexWrap: 'wrap',
        }}>
          <span>JS:{mounted ? 'YES' : 'NO'}</span>
          <span>P:{dbgStatus}</span>
          <span>DB:{dbgPoll}({dbgPollN})</span>
          <span>Ev:{dbgEvents}{dbgLast ? '/'+dbgLast : ''}</span>
          <span>{code}</span>
        </div>
      )}

      {simEnded && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: theme.overlay,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <div style={{ fontSize: '2.5rem' }}>✅</div>
          <div style={{ color: theme.name === 'dark' ? '#c4b5fd' : '#fff', fontSize: '1.5rem', fontWeight: 700 }}>הסימולציה הסתיימה</div>
          <div style={{ color: theme.name === 'dark' ? '#9ca3af' : '#e5e7eb', fontSize: '1rem', textAlign: 'center', lineHeight: 1.6 }}>תודה על השתתפותך</div>
        </div>
      )}

      {/* Opening vignette popup — trainee reads the case story, then starts */}
      {vignetteOpen && !simEnded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 70, background: theme.overlay,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div dir="rtl" style={{
            background: theme.surfaceRaised, border: `1px solid ${theme.border}`,
            borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '88vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '22px 26px 14px', borderBottom: `1px solid ${theme.borderSoft}`, flexShrink: 0 }}>
              <div style={{ color: theme.label, fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 6 }}>
                📋 תרחיש פתיחה
              </div>
              {scenarioName && (
                <div style={{ color: theme.textHi, fontSize: '1.5rem', fontWeight: 800 }}>{scenarioName}</div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>
              <div style={{ color: theme.text, fontSize: '1.25rem', lineHeight: 1.9, whiteSpace: 'pre-line' }}>
                {vignette}
              </div>
            </div>
            <div style={{ padding: '16px 26px 22px', flexShrink: 0 }}>
              <button
                onClick={dismissVignette}
                style={{
                  width: '100%', minHeight: 56, borderRadius: 12, border: 'none',
                  background: `linear-gradient(135deg, ${theme.brand}, ${theme.accent})`,
                  color: '#fff', fontSize: '1.2rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                קראתי — התחל ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CTG + vitals — landscape: side-by-side; portrait: CTG on top, compact vitals below */}
      <div style={{
        flex: isPortrait ? '0 0 auto' : '0 0 370px',
        display: 'flex',
        flexDirection: isPortrait ? 'column' : 'row',
        minHeight: 0,
      }}>
        <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0, height: isPortrait ? 280 : undefined }}>
          <CTGMonitor ctgParams={ctgParams} maternalHR={vitals.hr} isRunning={isRunning} onFHRUpdate={handleFHRUpdate} resetKey={ctgResetKey} retroactiveKey={ctgRetroactiveKey} simSpeed={simSpeed} />
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'בטל השתקה' : 'השתק קול CTG'}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: isMuted ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.55)',
              border: `1px solid ${isMuted ? '#ef4444' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 6, color: '#fff', fontSize: '1.1rem',
              width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 10,
            }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <ThemeToggleButton style={{ position: 'absolute', top: 8, right: 50, width: 34, height: 34, borderRadius: 6, zIndex: 10 }} />
        </div>
        <div style={{
          width: isPortrait ? '100%' : 210,
          height: isPortrait ? 62 : undefined,
          flexShrink: 0,
          borderLeft: isPortrait ? 'none' : `1px solid ${theme.borderSoft}`,
          borderTop: isPortrait ? `1px solid ${theme.borderSoft}` : 'none',
          padding: isPortrait ? '6px 8px' : 10,
        }}>
          <VitalSignsDisplay fhr={currentFHR} vitals={vitals} isRunning={isRunning} compact={isPortrait} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, borderTop: `2px solid ${theme.borderSoft}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 20px', borderBottom: `1px solid ${theme.borderSoft}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {cardNumber > 0 && (
            <span style={{ background: theme.chipBg, border: `1px solid ${theme.borderSoft}`, borderRadius: 8, padding: '4px 14px', color: theme.lilac, fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              כרטיס {cardNumber}
            </span>
          )}
          {cardTitle && <span style={{ color: theme.textHi, fontWeight: 800, fontSize: '1.35rem' }} dir="rtl">{cardTitle}</span>}
          {!cardNumber && <span style={{ color: theme.textDim, fontSize: '1.05rem' }}>ממתין לנתונים קליניים...</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 20 }} dir="rtl">
          {description && (
            <div>
              <div style={{ color: theme.label, fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>תיאור קליני</div>
              <div style={{ color: theme.text, fontSize: '1.1rem', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{description}</div>
            </div>
          )}
          {labRows.length > 0 && (
            <div>
              <div style={{ color: theme.label, fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>תוצאות מעבדה</div>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <EHRLabsPanel rows={labRows} />
              </div>
              {labRows[labRows.length - 1]?.labs.other?.blood_type && (
                <div style={{ marginTop: 8, fontSize: '1rem', fontWeight: 600, color: theme.name === 'dark' ? '#fbbf24' : '#b45309' }}>
                  סוג דם: {labRows[labRows.length - 1].labs.other!.blood_type}
                </div>
              )}
            </div>
          )}
          {patient.history && (
            <div>
              <div style={{ color: theme.label, fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>רקע רפואי</div>
              <div style={{ color: theme.textDim, fontSize: '1rem', lineHeight: 1.7 }}>{patient.history}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

