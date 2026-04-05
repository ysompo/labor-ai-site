'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface FormMeta {
  participantName: string;
  scenarioName: string | null;
  submitted: boolean;
}

export default function SelfAssessmentPage() {
  const params  = useParams<{ token: string }>();
  const token   = params?.token ?? '';

  const [meta,         setMeta]         = useState<FormMeta | null>(null);
  const [notFound,     setNotFound]     = useState(false);
  const [strengths,    setStrengths]    = useState('');
  const [improvements, setImprovements] = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [done,         setDone]         = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/simulator/self-assessment/${token}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json() as Promise<FormMeta>;
      })
      .then(data => {
        if (!data) return;
        setMeta(data);
        if (data.submitted) setDone(true);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  const handleSubmit = async () => {
    if (!strengths.trim() && !improvements.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/simulator/self-assessment/${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ strengths, improvements }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const json = await res.json() as { error?: string };
        alert(json.error ?? 'שגיאה בשמירה');
      }
    } catch {
      alert('שגיאת רשת');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    direction: 'rtl',
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    maxWidth: 580,
    width: '100%',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e40af, #4B2E6A)',
    padding: '24px 32px',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '28px 32px',
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!meta && !notFound) {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#6b7280', fontSize: 14 }}>טוען...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>הערכה עצמית</div>
            <div style={{ color: '#bfdbfe', fontSize: 12, marginTop: 2 }}>Labor-AI Lab · Hadassah Mount Scopus</div>
          </div>
          <div style={bodyStyle}>
            <p style={{ color: '#ef4444', fontWeight: 700, fontSize: 15, textAlign: 'center' }}>
              הקישור אינו תקין או פג תוקף
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>הערכה עצמית</div>
            <div style={{ color: '#bfdbfe', fontSize: 12, marginTop: 2 }}>Labor-AI Lab · Hadassah Mount Scopus</div>
          </div>
          <div style={{ ...bodyStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ color: '#16a34a', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
              תודה! ההערכה העצמית נשמרה בהצלחה
            </p>
            <p style={{ color: '#6b7280', fontSize: 13 }}>
              המידע יתווסף לדוח הסימולציה
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
            הערכה עצמית — {meta!.scenarioName ?? 'סימולציה'}
          </div>
          <div style={{ color: '#bfdbfe', fontSize: 12, marginTop: 2 }}>
            Labor-AI Lab · Hadassah Mount Scopus
          </div>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          <p style={{ color: '#374151', fontSize: 14, marginBottom: 24 }}>
            שלום <strong>{meta!.participantName}</strong>, אנא מלא/י את ההערכה העצמית:
          </p>

          {/* Strengths */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 700, color: '#16a34a', fontSize: 14, marginBottom: 6 }}>
              נקודות לשימור
            </label>
            <textarea
              value={strengths}
              onChange={e => setStrengths(e.target.value)}
              placeholder="מה עבד טוב בסימולציה?"
              rows={4}
              dir="rtl"
              style={{
                width: '100%',
                border: '1.5px solid #d1fae5',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                color: '#1f2937',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#16a34a'; }}
              onBlur={e => { e.target.style.borderColor = '#d1fae5'; }}
            />
          </div>

          {/* Improvements */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontWeight: 700, color: '#d97706', fontSize: 14, marginBottom: 6 }}>
              נקודות לשיפור
            </label>
            <textarea
              value={improvements}
              onChange={e => setImprovements(e.target.value)}
              placeholder="מה ניתן לשפר בסימולציה הבאה?"
              rows={4}
              dir="rtl"
              style={{
                width: '100%',
                border: '1.5px solid #fde68a',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                color: '#1f2937',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#d97706'; }}
              onBlur={e => { e.target.style.borderColor = '#fde68a'; }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (!strengths.trim() && !improvements.trim())}
            style={{
              width: '100%',
              background: submitting || (!strengths.trim() && !improvements.trim())
                ? '#9ca3af'
                : 'linear-gradient(135deg, #1e40af, #4B2E6A)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '13px 0',
              fontSize: 15,
              fontWeight: 700,
              cursor: submitting || (!strengths.trim() && !improvements.trim()) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {submitting ? 'שומר...' : 'שליחת הערכה עצמית'}
          </button>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '12px 32px', textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
          Labor-AI Simulation Lab · Hadassah Medical Center, Mount Scopus
        </div>
      </div>
    </div>
  );
}
