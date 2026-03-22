'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import AssessmentForm from '@/components/tools/simulator/AssessmentForm';

interface SessionParticipants {
  resident?: string;
  midwife?: string;
  senior_doctor?: string;
  charge_midwife?: string;
  observers?: string[];
}

interface SessionData {
  session_code: string;
  instructor_name: string; // JSON participants
  created_at: string;
  scenario_name?: string;
}

function MidwifeEvaluateInner({ code, evaluatorName }: { code: string; evaluatorName: string }) {
  const router = useRouter();

  const [session, setSession]           = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<SessionParticipants>({});
  const [initialNotes, setInitialNotes] = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // Load notes from sessionStorage (written by participant page)
  useEffect(() => {
    const stored = sessionStorage.getItem(`sim_notes_${code}`);
    if (stored) setInitialNotes(stored);
  }, [code]);

  // Fetch session data
  useEffect(() => {
    fetch(`/api/simulator/sessions/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        const s = data.session as SessionData;
        setSession(s);
        try {
          const parsed = JSON.parse(s.instructor_name ?? '{}') as SessionParticipants;
          setParticipants(parsed);
        } catch { /* ignore parse error */ }
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [code]);

  const handleSubmit = async (data: {
    scores: Record<string, 0 | 1 | 2>;
    itemNotes?: Record<string, string>;
    seniority?: string;
    simType?: string;
    strengths: string;
    improvements: string;
    keyMessage: string;
    total: number;
    sendEmails?: boolean;
  }) => {
    const res = await fetch('/api/simulator/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionCode:      code,
        formType:         'midwife',
        participantName:  participants.midwife ?? '',
        evaluatorName,
        scenarioName:     session?.scenario_name ?? '',
        sessionDate:      session ? new Date(session.created_at).toLocaleDateString('he-IL') : '',
        scores:           data.scores,
        strengths:        data.strengths,
        improvements:     data.improvements,
        keyMessage:       data.keyMessage,
        total:            data.total,
        sendEmails:       data.sendEmails,
        participantEmails: [],
      }),
    });
    const result = await res.json() as { emailError?: string };
    if (result.emailError) return { emailError: result.emailError };
  };

  if (loading) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ color: '#6b7280' }}>טוען נתוני סימולציה...</div>
    </div>
  );

  if (error) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ color: '#dc2626' }}>שגיאה: {error}</div>
    </div>
  );

  return (
    <AssessmentForm
      formType="midwife"
      participantName={participants.midwife ?? '—'}
      evaluatorName={evaluatorName || participants.charge_midwife || '—'}
      sessionDate={session ? new Date(session.created_at).toLocaleDateString('he-IL') : ''}
      scenarioName={session?.scenario_name ?? code}
      participantEmails={[]}
      initialNotes={initialNotes}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      onDone={() => router.push('/tools/simulator/history')}
    />
  );
}

// Server Component — resolves params + searchParams on the server
export default function MidwifeEvaluatePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ evaluator?: string }>;
}) {
  const { code }   = use(params);
  const sp         = use(searchParams);
  const evaluatorName = sp.evaluator ?? '';
  return <MidwifeEvaluateInner code={code} evaluatorName={evaluatorName} />;
}
