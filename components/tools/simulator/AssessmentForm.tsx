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
    strengths: string;
    improvements: string;
    keyMessage: string;
    total: number;
    sendEmails?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}

const RUBRIC_SECTIONS = [
  {
    category: 'זיהוי ואבחנה',
    items: [
      { id: 'diag_1', text: 'זיהוי מוקדם של הסימנים הקליניים' },
      { id: 'diag_2', text: 'פרשנות נכונה של הממצאים' },
      { id: 'diag_3', text: 'קביעת אבחנה מדויקת' },
      { id: 'diag_4', text: 'תיעדוף בעיות לפי חומרה' },
    ],
  },
  {
    category: 'ניהול קליני',
    items: [
      { id: 'mgmt_1', text: 'קבלת החלטות בזמן' },
      { id: 'mgmt_2', text: 'ביצוע פרוטוקול טיפולי' },
      { id: 'mgmt_3', text: 'ניטור ומעקב אחר תגובה לטיפול' },
      { id: 'mgmt_4', text: 'קריאה לעזרה בזמן' },
    ],
  },
  {
    category: 'תקשורת וצוות',
    items: [
      { id: 'comm_1', text: 'תקשורת עם הצוות' },
      { id: 'comm_2', text: 'הסבר למטופלת' },
      { id: 'comm_3', text: 'תיעוד ודיווח' },
    ],
  },
];

const SCORE_LABELS: Record<0 | 1 | 2, string> = {
  0: 'לא בוצע',
  1: 'בוצע חלקית',
  2: 'בוצע מלא',
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
  const initialScores: Record<string, 0 | 1 | 2> = {};
  RUBRIC_SECTIONS.forEach((sec) => sec.items.forEach((item) => { initialScores[item.id] = 0; }));

  const [scores, setScores]           = useState<Record<string, 0 | 1 | 2>>(initialScores);
  const [strengths, setStrengths]     = useState(initialNotes);
  const [improvements, setImprovements] = useState('');
  const [keyMessage, setKeyMessage]   = useState('');
  const [sending, setSending]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [emailSent, setEmailSent]     = useState(false);

  const total    = Object.values(scores).reduce<number>((sum, s) => sum + s, 0);
  const maxScore = RUBRIC_SECTIONS.reduce((sum, sec) => sum + sec.items.length * 2, 0);

  const handleScore = (id: string, score: 0 | 1 | 2) => {
    setScores((prev) => ({ ...prev, [id]: score }));
  };

  const handleSave = async (sendEmails = false) => {
    setSending(true);
    await onSubmit({ scores, strengths, improvements, keyMessage, total, sendEmails });
    setSending(false);
    setSaved(true);
    if (sendEmails) setEmailSent(true);
  };

  const handleExportPDF = () => window.print();

  const headerStyle: React.CSSProperties = {
    background: '#1e40af',
    color: '#fff',
    padding: '10px 16px',
    fontWeight: 700,
    fontSize: '0.9rem',
    borderRadius: '8px 8px 0 0',
    marginTop: 20,
    marginBottom: 0,
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #dbeafe',
    borderRadius: '0 0 8px 8px',
    overflow: 'hidden',
    marginBottom: 4,
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: '0.85rem',
    resize: 'vertical',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#111',
    boxSizing: 'border-box',
    background: '#fafafa',
  };

  return (
    <div
      dir="rtl"
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#111',
      }}
    >
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: 12, padding: '20px 24px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ margin: '0 0 12px', color: '#1e40af', fontSize: '1.2rem', fontWeight: 700 }}>
            טופס הערכה — {formType === 'resident' ? 'מתמחה' : 'מיילדת'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: '0.85rem' }}>
            <div><span style={{ color: '#6b7280' }}>משתתף: </span><strong>{participantName}</strong></div>
            <div><span style={{ color: '#6b7280' }}>מעריך: </span><strong>{evaluatorName}</strong></div>
            <div><span style={{ color: '#6b7280' }}>תרחיש: </span><strong>{scenarioName}</strong></div>
            <div><span style={{ color: '#6b7280' }}>תאריך: </span><strong>{sessionDate}</strong></div>
          </div>
        </div>

        {/* Score display */}
        <div style={{
          background: total >= maxScore * 0.75 ? '#f0fdf4' : total >= maxScore * 0.5 ? '#fffbeb' : '#fef2f2',
          border: `2px solid ${total >= maxScore * 0.75 ? '#16a34a' : total >= maxScore * 0.5 ? '#d97706' : '#dc2626'}`,
          borderRadius: 10, padding: '12px 20px', marginBottom: 8, textAlign: 'center',
        }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111' }}>{total}</span>
          <span style={{ fontSize: '1rem', color: '#6b7280' }}>/{maxScore}</span>
          <span style={{ marginRight: 8, color: '#6b7280', fontSize: '0.85rem' }}>ניקוד כולל</span>
        </div>

        {/* Rubric sections */}
        {RUBRIC_SECTIONS.map((section) => (
          <div key={section.category}>
            <div style={headerStyle}>{section.category}</div>
            <div style={cardStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {section.items.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f7f9ff' }}>
                      <td style={{ padding: '10px 16px', fontSize: '0.85rem', borderBottom: '1px solid #f0f0f0', width: '60%' }}>
                        {item.text}
                      </td>
                      <td style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {([0, 1, 2] as (0 | 1 | 2)[]).map((score) => (
                            <button
                              key={score}
                              onClick={() => handleScore(item.id, score)}
                              style={{
                                padding: '5px 12px', borderRadius: 6,
                                border: `1.5px solid ${scores[item.id] === score ? SCORE_COLORS[score] : '#d1d5db'}`,
                                background: scores[item.id] === score ? SCORE_BG[score] : '#fff',
                                color: scores[item.id] === score ? SCORE_COLORS[score] : '#6b7280',
                                fontWeight: scores[item.id] === score ? 700 : 400,
                                fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'all 0.12s', whiteSpace: 'nowrap',
                              }}
                            >
                              {score} — {SCORE_LABELS[score]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Text areas */}
        <div style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: 12, padding: '20px', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>חוזקות</label>
            <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} placeholder="נקודות לשימור..." style={textareaStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>נקודות לשיפור</label>
            <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={3} placeholder="תחומים לשיפור..." style={textareaStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: '0.85rem' }}>מסר מרכזי</label>
            <textarea value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} rows={2} placeholder="המסר החשוב ביותר מהסימולציה..." style={textareaStyle} />
          </div>
        </div>

        {/* ── Done screen ─────────────────────────────────── */}
        {saved ? (
          <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 12, padding: '28px 24px', marginTop: 20, textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '1.1rem', marginBottom: 16 }}>ההערכה נשמרה בהצלחה</div>
            {emailSent ? (
              <div style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: 20 }}>
                📧 הערכה נשלחה ל-{participantEmails.length} משתתף{participantEmails.length !== 1 ? 'ים' : ''}
              </div>
            ) : participantEmails.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: 8 }}>
                  {participantEmails.join(', ')}
                </div>
                <button
                  onClick={async () => { setSending(true); await onSubmit({ scores, strengths, improvements, keyMessage, total, sendEmails: true }); setSending(false); setEmailSent(true); }}
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
              <button onClick={onDone} className="no-print" style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                🏠 סיום וחזרה לתפריט
              </button>
            </div>
          </div>
        ) : (
          /* Action buttons */
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }} className="no-print">
            <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              ← חזור לדיבריף
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
                {sending ? 'שולח...' : `📧 שמור ושלח לכל המשתתפים (${participantEmails.length})`}
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
