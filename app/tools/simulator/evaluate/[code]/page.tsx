'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AssessmentForm from '@/components/tools/simulator/AssessmentForm';

interface SessionParticipants {
  resident?: string;
  resident_junior?: string;
  midwife?: string;
  senior_doctor?: string;
  charge_midwife?: string;
  observers?: string[];
}

interface SessionData {
  session_code: string;
  instructor_name: string;
  created_at: string;
  scenario_name?: string;
}

interface StaffMember { id: number; name: string; email?: string; role?: string; }

type FormType = 'resident' | 'resident_junior' | 'midwife';

interface FormDef {
  type: FormType;
  participantKey: keyof Omit<SessionParticipants, 'observers'>;
  label: string;
}

const FORM_DEFS: FormDef[] = [
  { type: 'resident',        participantKey: 'resident',        label: 'מתמחה בכיר' },
  { type: 'resident_junior', participantKey: 'resident_junior', label: 'מתמחה צעיר' },
  { type: 'midwife',         participantKey: 'midwife',         label: 'מיילדת' },
];

const EDITOR_ROLES: { key: keyof Omit<SessionParticipants, 'observers'>; label: string }[] = [
  { key: 'resident',        label: 'מתמחה בכיר' },
  { key: 'resident_junior', label: 'מתמחה צעיר' },
  { key: 'midwife',         label: 'מיילדת' },
  { key: 'senior_doctor',   label: 'רופא בכיר' },
  { key: 'charge_midwife',  label: 'מיילדת אחראית' },
];

function EvaluateInner({ code, evaluatorName }: { code: string; evaluatorName: string }) {
  const router = useRouter();

  const [session, setSession]           = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<SessionParticipants>({});
  const [staffList, setStaffList]       = useState<StaffMember[]>([]);
  const [staffEmails, setStaffEmails]   = useState<Record<string, string>>({});
  const [initialNotes, setInitialNotes] = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [activeTab, setActiveTab]       = useState(0);

  // Participants editor
  const [editOpen, setEditOpen]     = useState(false);
  const [editValues, setEditValues] = useState<SessionParticipants>({});
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem(`sim_notes_${code}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setInitialNotes(stored);
  }, [code]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/simulator/sessions/${code}`).then(r => r.json()),
      fetch('/api/simulator/staff').then(r => r.json()),
    ]).then(([sessionData, staffData]) => {
      if (sessionData.error) { setError(sessionData.error); setLoading(false); return; }
      const s = sessionData.session as SessionData;
      setSession(s);
      let parsed: SessionParticipants = {};
      try { parsed = JSON.parse(s.instructor_name ?? '{}') as SessionParticipants; } catch { /* ignore */ }
      setParticipants(parsed);
      setEditValues(parsed);

      const list = (staffData.staff ?? []) as StaffMember[];
      setStaffList(list);
      const emailMap: Record<string, string> = {};
      for (const staff of list) {
        if (staff.name && staff.email) emailMap[staff.name] = staff.email;
      }
      setStaffEmails(emailMap);

      const hasAny = parsed.resident || parsed.resident_junior || parsed.midwife || parsed.senior_doctor || parsed.charge_midwife;
      if (!hasAny) setEditOpen(true);

      setLoading(false);
    }).catch(e => { setError(String(e)); setLoading(false); });
  }, [code]);

  const handleSaveParticipants = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/simulator/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructor_name: JSON.stringify(editValues) }),
      });
      if (res.ok) {
        setParticipants(editValues);
        setEditOpen(false);
        setSaveMsg('נשמר');
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        setSaveMsg('שגיאה בשמירה');
      }
    } catch {
      setSaveMsg('שגיאה בשמירה');
    }
    setSaving(false);
  };

  const makeSubmitHandler = useCallback((formType: FormType, participantName: string) =>
    async (data: {
      scores: Record<string, number>;
      itemNotes: Record<string, string>;
      seniority: string;
      simType: string;
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
          sessionCode:       code,
          formType,
          participantName,
          evaluatorName,
          scenarioName:      session?.scenario_name ?? '',
          sessionDate:       session ? new Date(session.created_at).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL'),
          scores:            data.scores,
          strengths:         data.strengths,
          improvements:      data.improvements,
          keyMessage:        data.keyMessage,
          total:             data.total,
          sendEmails:        data.sendEmails,
          participantEmails: [participantName]
            .filter(Boolean)
            .map(name => staffEmails[name])
            .filter(Boolean),
        }),
      });
      const result = await res.json() as { emailError?: string };
      if (result.emailError) return { emailError: result.emailError };
    },
  [code, evaluatorName, session, staffEmails]);

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

  // Determine which forms to show
  const activeForms = FORM_DEFS.filter(f => !!participants[f.participantKey]);
  const hasTabs = activeForms.length > 1;
  const currentForm = activeForms[activeTab] ?? activeForms[0];

  const participantSummary = EDITOR_ROLES
    .map(r => participants[r.key])
    .filter(Boolean)
    .join(', ');

  return (
    <div dir="rtl" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>

      {/* ── Participants editor ────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 0' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>משתתפים בסימולציה</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {saveMsg && (
                <span style={{ fontSize: '0.82rem', color: saveMsg === 'נשמר' ? '#16a34a' : '#dc2626' }}>
                  {saveMsg === 'נשמר' ? '✓ ' : ''}{saveMsg}
                </span>
              )}
              <button
                onClick={() => setEditOpen(o => !o)}
                style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', fontSize: '0.82rem', color: '#374151', cursor: 'pointer' }}
              >
                {editOpen ? 'סגור' : 'ערוך'}
              </button>
            </div>
          </div>

          {!editOpen && (
            <div style={{ marginTop: 8, fontSize: '0.88rem', color: participantSummary ? '#374151' : '#9ca3af' }}>
              {participantSummary || 'לא הוזנו משתתפים — לחץ ערוך להוספה'}
            </div>
          )}

          {editOpen && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                {EDITOR_ROLES.map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{label}</label>
                    <input
                      list={`staff-${key}`}
                      value={editValues[key] ?? ''}
                      onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="הקלד שם או בחר מהרשימה"
                      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: '0.88rem', color: '#1f2937' }}
                    />
                    <datalist id={`staff-${key}`}>
                      {staffList.map(s => <option key={s.id} value={s.name} />)}
                    </datalist>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={handleSaveParticipants}
                  disabled={saving}
                  style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 22px', fontWeight: 700, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'שומר...' : 'שמור משתתפים'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs (shown only when 2+ forms) ───────────────────────────── */}
        {hasTabs && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
            {activeForms.map((f, i) => (
              <button
                key={f.type}
                onClick={() => setActiveTab(i)}
                style={{
                  padding: '9px 22px', borderRadius: '8px 8px 0 0',
                  border: '1px solid #e5e7eb', borderBottom: i === activeTab ? '1px solid #f8fafc' : '1px solid #e5e7eb',
                  background: i === activeTab ? '#f8fafc' : '#fff',
                  color: i === activeTab ? '#7c3aed' : '#6b7280',
                  fontWeight: i === activeTab ? 700 : 400,
                  fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {f.label}
                {participants[f.participantKey] && (
                  <span style={{ marginRight: 6, fontSize: '0.78rem', color: '#9ca3af' }}>
                    ({participants[f.participantKey]})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Assessment form ────────────────────────────────────────────── */}
      {activeForms.length === 0 ? (
        <div dir="rtl" style={{ maxWidth: 720, margin: '16px auto', padding: '0 16px', color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center' }}>
          הוסף משתתפים כדי להתחיל בהערכה
        </div>
      ) : currentForm && (
        <AssessmentForm
          key={currentForm.type}
          formType={currentForm.type}
          participantName={participants[currentForm.participantKey] ?? '—'}
          evaluatorName={evaluatorName || participants.charge_midwife || participants.senior_doctor || '—'}
          sessionDate={session ? new Date(session.created_at).toLocaleDateString('he-IL') : ''}
          scenarioName={session?.scenario_name ?? code}
          participantEmails={[participants[currentForm.participantKey]]
            .filter(Boolean)
            .map(name => staffEmails[name!])
            .filter(Boolean)}
          initialNotes={currentForm.type !== 'resident_junior' ? initialNotes : ''}
          onSubmit={makeSubmitHandler(currentForm.type, participants[currentForm.participantKey] ?? '')}
          onCancel={() => router.back()}
          onDone={() => router.push('/tools/simulator/history')}
        />
      )}
    </div>
  );
}

export default function EvaluatePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ evaluator?: string }>;
}) {
  const { code } = use(params);
  const sp       = use(searchParams);
  return <EvaluateInner code={code} evaluatorName={sp.evaluator ?? ''} />;
}
