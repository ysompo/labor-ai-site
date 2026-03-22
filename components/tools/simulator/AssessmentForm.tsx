'use client';

import { useState } from 'react';

interface Props {
  formType: 'resident' | 'midwife';
  participantName: string;
  evaluatorName: string;
  sessionDate: string;
  scenarioName: string;
  participantEmails?: string[];
  initialNotes?: string;
  onSubmit: (data: {
    scores: Record<string, 0 | 1 | 2>;
    itemNotes: Record<string, string>;
    seniority: string;
    simType: string;
    strengths: string;
    improvements: string;
    keyMessage: string;
    total: number;
    sendEmails?: boolean;
  }) => Promise<{ emailError?: string } | void>;
  onCancel: () => void;
  onDone: () => void;
}

// ─── Rubrics (exact items from the uploaded forms) ──────────────────────────

const RESIDENT_RUBRIC_SECTIONS = [
  {
    category: 'זיהוי קליני',
    items: [
      { id: 'id_1', text: 'זיהוי מוקדם של מצב חריג' },
      { id: 'id_2', text: 'חיבור נכון בין סימנים קליניים' },
      { id: 'id_3', text: 'זיהוי מצב חירום בזמן' },
    ],
  },
  {
    category: 'קבלת החלטות',
    items: [
      { id: 'dec_1', text: 'קבלת החלטות בזמן' },
      { id: 'dec_2', text: 'זיהוי נקודת הסלמה' },
      { id: 'dec_3', text: 'עצירה בזמן ומעבר לח.נ.' },
    ],
  },
  {
    category: 'הובלה ותקשורת',
    items: [
      { id: 'lead_1', text: 'הכרזה ברורה' },
      { id: 'lead_2', text: 'קריאה מוקדמת לעזרה' },
      { id: 'lead_3', text: 'חלוקת תפקידים' },
      { id: 'lead_4', text: 'תקשורת עם היולדת' },
      { id: 'lead_5', text: 'ניהול האירוע' },
    ],
  },
];

const MIDWIFE_RUBRIC_SECTIONS = [
  {
    category: 'זיהוי קליני',
    items: [
      { id: 'id_1', text: 'זיהוי מוקדם של מצב חריג' },
      { id: 'id_2', text: 'חיבור נכון בין סימנים קליניים' },
      { id: 'id_3', text: 'זיהוי מצב חירום בזמן' },
    ],
  },
  {
    category: 'היכרות עם פרוטוקולים \\ ציוד \\ תרופות',
    items: [
      { id: 'prot_1', text: 'הכרות עם פרוטוקולים' },
      { id: 'prot_2', text: 'הנגשת תרופות' },
      { id: 'prot_3', text: 'הכרות עם מינונים וצורת מתן' },
    ],
  },
  {
    category: 'הובלה ותקשורת',
    items: [
      { id: 'lead_1', text: 'קריאה מוקדמת לעזרה' },
      { id: 'lead_2', text: 'דיווח מדויק לאחראית/רופא' },
      { id: 'lead_3', text: 'חלוקת תפקידים' },
      { id: 'lead_4', text: 'תקשורת עם היולדת' },
    ],
  },
];

const SIM_TYPES = [
  'PPH', 'פרע כתפיים', 'וואקום', 'PET/Eclampsia',
  'קרע ברחם', 'לידה מוקדמת', 'ברדיקרדיה עוברית', 'החייאה',
];

const SCORE_LABELS: Record<0 | 1 | 2, string> = {
  0: 'לא בוצע',
  1: 'בוצע חלקית',
  2: 'בוצע היטב',
};

const SCORE_COLORS: Record<0 | 1 | 2, string> = {
  0: '#dc2626',
  1: '#d97706',
  2: '#16a34a',
};

const SCORE_BG: Record<0 | 1 | 2, string> = {
  0: '#fef2f2',
  1: '#fffbeb',
  2: '#f0fdf4',
};

export default function AssessmentForm({
  formType,
  participantName,
  evaluatorName,
  sessionDate,
  scenarioName,
  participantEmails = [],
  initialNotes = '',
  onSubmit,
  onCancel,
  onDone,
}: Props) {
  const activeSections = formType === 'midwife' ? MIDWIFE_RUBRIC_SECTIONS : RESIDENT_RUBRIC_SECTIONS;
  const initScores: Record<string, 0 | 1 | 2> = {};
  const initItemNotes: Record<string, string>  = {};
  activeSections.forEach(sec => sec.items.forEach(item => {
    initScores[item.id]     = 0;
    initItemNotes[item.id]  = '';
  }));

  const [scores, setScores]           = useState<Record<string, 0 | 1 | 2>>(initScores);
  const [itemNotes, setItemNotes]     = useState<Record<string, string>>(initItemNotes);
  const [seniority, setSeniority]     = useState('');
  const [simType, setSimType]         = useState(scenarioName ?? '');
  const [strengths, setStrengths]     = useState(initialNotes);
  const [improvements, setImprovements] = useState('');
  const [keyMessage, setKeyMessage]   = useState('');
  const [sending, setSending]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [emailSent, setEmailSent]     = useState(false);
  const [emailError, setEmailError]   = useState<string | null>(null);

  const total    = Object.values(scores).reduce<number>((sum, s) => sum + s, 0);
  const maxScore = activeSections.reduce((sum, sec) => sum + sec.items.length * 2, 0);

  const handleScore     = (id: string, score: 0 | 1 | 2) => setScores(p => ({ ...p, [id]: score }));
  const handleItemNote  = (id: string, note: string)      => setItemNotes(p => ({ ...p, [id]: note }));

  const handleSave = async (sendEmails = false) => {
    setSending(true);
    setEmailError(null);
    const result = await onSubmit({ scores, itemNotes, seniority, simType, strengths, improvements, keyMessage, total, sendEmails });
    setSending(false);
    setSaved(true);
    if (sendEmails) {
      if (result?.emailError) setEmailError(result.emailError);
      else setEmailSent(true);
    }
  };

  const handleExportPDF = () => window.print();

  // ── Styles ──────────────────────────────────────────────────────────────
  const sectionHeaderStyle: React.CSSProperties = {
    background: '#1e40af', color: '#fff',
    padding: '10px 16px', fontWeight: 700, fontSize: '0.9rem',
    borderRadius: '8px 8px 0 0', marginTop: 20, marginBottom: 0,
  };
  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #dbeafe',
    borderRadius: '0 0 8px 8px', overflow: 'hidden', marginBottom: 4,
  };
  const textareaStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
    padding: '8px 10px', fontSize: '0.85rem', resize: 'vertical',
    fontFamily: 'Arial, Helvetica, sans-serif', color: '#111',
    boxSizing: 'border-box', background: '#fafafa',
  };
  const inputStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px',
    fontSize: '0.85rem', fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#111', background: '#fafafa', outline: 'none',
  };

  const isResident = formType === 'resident';
  const title      = isResident
    ? 'טופס משוב למתמחה'
    : 'טופס משוב למיילדת';
  const seniorityLabel = isResident ? 'ותק בהתמחות' : 'ותק כמיילדת';
  const participantLabel = isResident ? 'שם המתמחה' : 'שם המיילדת';

  return (
    <div dir="rtl" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Header card ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: 12, padding: '20px 24px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ margin: '0 0 16px', color: '#1e40af', fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' }}>
            {title}
          </h2>

          {/* Meta fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '0.85rem', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ color: '#6b7280', fontWeight: 600 }}>{participantLabel}</label>
              <div style={{ fontWeight: 700 }}>{participantName || '—'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ color: '#6b7280', fontWeight: 600 }}>{seniorityLabel}</label>
              <input
                value={seniority}
                onChange={e => setSeniority(e.target.value)}
                placeholder="לדוגמה: שנה ראשונה"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ color: '#6b7280', fontWeight: 600 }}>שם המדריך</label>
              <div style={{ fontWeight: 700 }}>{evaluatorName || '—'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ color: '#6b7280', fontWeight: 600 }}>תאריך</label>
              <div style={{ fontWeight: 700 }}>{sessionDate || '—'}</div>
            </div>
          </div>

          {/* Simulation type checkboxes */}
          <div>
            <div style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>סוג הסימולציה:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
              {SIM_TYPES.map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={simType === type}
                    onChange={() => setSimType(prev => prev === type ? '' : type)}
                    style={{ accentColor: '#1e40af', width: 15, height: 15 }}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Score summary ────────────────────────────────────────────── */}
        <div style={{
          background: total >= maxScore * 0.75 ? '#f0fdf4' : total >= maxScore * 0.5 ? '#fffbeb' : '#fef2f2',
          border: `2px solid ${total >= maxScore * 0.75 ? '#16a34a' : total >= maxScore * 0.5 ? '#d97706' : '#dc2626'}`,
          borderRadius: 10, padding: '10px 20px', marginBottom: 8, textAlign: 'center',
        }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111' }}>{total}</span>
          <span style={{ fontSize: '1rem', color: '#6b7280' }}>/{maxScore}</span>
          <span style={{ marginRight: 10, color: '#6b7280', fontSize: '0.85rem' }}>ניקוד כולל</span>
          <span style={{ color: total >= maxScore * 0.75 ? '#16a34a' : total >= maxScore * 0.5 ? '#d97706' : '#dc2626', fontSize: '0.85rem', fontWeight: 700 }}>
            {total >= maxScore * 0.75 ? 'בוצע היטב' : total >= maxScore * 0.5 ? 'בוצע חלקית' : 'דרוש שיפור'}
          </span>
        </div>

        {/* ── Rubric sections ──────────────────────────────────────────── */}
        {activeSections.map(section => (
          <div key={section.category}>
            <div style={sectionHeaderStyle}>{section.category}</div>
            <div style={cardStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#eff6ff' }}>
                    <th style={{ padding: '8px 14px', fontSize: '0.78rem', color: '#1e40af', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #dbeafe', width: '34%' }}>פריט</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.78rem', color: '#1e40af', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid #dbeafe', width: '42%' }}>ציון</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.78rem', color: '#1e40af', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid #dbeafe', width: '24%' }}>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f7f9ff' }}>
                      <td style={{ padding: '10px 14px', fontSize: '0.85rem', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }}>
                        {item.text}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {([2, 1, 0] as (0 | 1 | 2)[]).map(score => (
                            <button
                              key={score}
                              onClick={() => handleScore(item.id, score)}
                              style={{
                                padding: '5px 11px', borderRadius: 6,
                                border: `1.5px solid ${scores[item.id] === score ? SCORE_COLORS[score] : '#d1d5db'}`,
                                background: scores[item.id] === score ? SCORE_BG[score] : '#fff',
                                color: scores[item.id] === score ? SCORE_COLORS[score] : '#6b7280',
                                fontWeight: scores[item.id] === score ? 700 : 400,
                                fontSize: '0.73rem', cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'all 0.12s', whiteSpace: 'nowrap',
                              }}
                            >
                              {SCORE_LABELS[score]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }}>
                        <input
                          type="text"
                          value={itemNotes[item.id] ?? ''}
                          onChange={e => handleItemNote(item.id, e.target.value)}
                          placeholder="הערה..."
                          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: '0.78rem', padding: '5px 8px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* ── Free-text fields ─────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: 12, padding: '20px', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>נקודות לשימור</label>
            <textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={3} placeholder="נקודות לשימור..." style={textareaStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>נקודות לשיפור</label>
            <textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={3} placeholder="תחומים לשיפור..." style={textareaStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>מסר מרכזי</label>
            <textarea value={keyMessage} onChange={e => setKeyMessage(e.target.value)} rows={2} placeholder="המסר החשוב ביותר מהסימולציה..." style={textareaStyle} />
          </div>
        </div>

        {/* ── Done screen ──────────────────────────────────────────────── */}
        {saved ? (
          <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 12, padding: '28px 24px', marginTop: 20, textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '1.1rem', marginBottom: 16 }}>ההערכה נשמרה בהצלחה</div>
            {emailError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '0.82rem' }}>
                ⚠ שגיאה בשליחת המייל: {emailError}
              </div>
            )}
            {emailSent ? (
              <div style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: 20 }}>
                📧 הערכה נשלחה ל-{participantEmails.length} משתתף{participantEmails.length !== 1 ? 'ים' : ''}
              </div>
            ) : participantEmails.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: 8 }}>{participantEmails.join(', ')}</div>
                <button
                  onClick={async () => { setSending(true); await onSubmit({ scores, itemNotes, seniority, simType, strengths, improvements, keyMessage, total, sendEmails: true }); setSending(false); setEmailSent(true); }}
                  disabled={sending}
                  style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#1e40af', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {sending ? 'שולח...' : `📧 שלח לכל המשתתפים (${participantEmails.length})`}
                </button>
              </div>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginBottom: 20 }}>אין כתובות מייל רשומות למשתתפים</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleExportPDF} className="no-print" style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid #1e40af', background: '#fff', color: '#1e40af', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                📄 ייצוא PDF
              </button>
              <a href="/tools/simulator/history" className="no-print" style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.5)', background: '#fff', color: '#7c3aed', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                📋 היסטוריה
              </a>
              <button onClick={onDone} className="no-print" style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                🏠 סיום וחזרה לתפריט
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }} className="no-print">
            <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              ← חזור
            </button>
            <button onClick={handleExportPDF} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #1e40af', background: '#fff', color: '#1e40af', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              📄 ייצוא PDF
            </button>
            {participantEmails.length > 0 && (
              <button
                onClick={() => handleSave(true)}
                disabled={sending}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: sending ? '#9ca3af' : '#1e40af', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {sending ? 'שולח...' : `📧 שמור ושלח (${participantEmails.length})`}
              </button>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={sending}
              style={{ flex: 1, padding: '10px 24px', borderRadius: 8, border: 'none', background: sending ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minWidth: 140 }}
            >
              {sending ? 'שומר...' : '💾 שמור הערכה'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
