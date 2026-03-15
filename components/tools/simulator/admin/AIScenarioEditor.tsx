'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  onApplyScenario: (scenario: unknown) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = ['PPH', 'אקלמפסיה', 'ברדיקרדיה עוברית', 'קרע ברחם'];

const SYSTEM_PROMPT = `אתה מומחה לסימולציות רפואיות בחדר לידה. כאשר המשתמש מתאר תרחיש קליני, צור JSON מלא ומובנה עבור סימולציה.

המבנה הנדרש:
{
  "name": "שם התרחיש",
  "case_story": "סיפור המקרה",
  "expected_actions": "פעולות מצופות מהצוות",
  "cards": [
    {
      "card_number": 1,
      "title": "כותרת הכרטיס",
      "clinical_description": "תיאור קליני",
      "structured_data": {
        "ctg": {
          "fhr_baseline": 140,
          "fhr_variability": "normal",
          "accelerations": "present",
          "decelerations": "none",
          "contraction_frequency": 3,
          "contraction_intensity": "moderate"
        },
        "vitals": {
          "hr": 88,
          "bp_systolic": 120,
          "bp_diastolic": 76,
          "spo2": 99,
          "temp": 36.8
        },
        "labs": {},
        "abnormal_fields": []
      }
    }
  ]
}

ספק JSON תקני בלבד בתוך בלוק \`\`\`json ... \`\`\`. הסבר קצר לפני ה-JSON מותר.`;

function extractJSON(text: string): unknown | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```json\s*[\s\S]*?```/g, '<em style="color:#4ade80;font-size:0.75rem">[JSON ← ראה תצוגה מקדימה]</em>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

export default function AIScenarioEditor({ onApplyScenario }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewJSON, setPreviewJSON] = useState<unknown | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: SYSTEM_PROMPT,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No response body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assistantText };
          return updated;
        });
      }

      // Extract JSON from final response
      const extracted = extractJSON(assistantText);
      if (extracted) setPreviewJSON(extracted);

    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `שגיאה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        height: '100%',
        gap: 0,
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* ── Left: Chat (60%) ── */}
      <div
        style={{
          flex: '0 0 60%',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid rgba(139,92,246,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(139,92,246,0.2)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, color: '#a78bfa', fontSize: '1rem', fontWeight: 700 }}>
            ✨ עורך תרחישים AI
          </h3>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.75rem' }}>
            שלח תיאור של תרחיש קליני ו-Claude ייצור JSON מלא
          </p>
        </div>

        {/* Quick prompts */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', flexShrink: 0, flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(`צור תרחיש מלא עבור: ${prompt}`)}
              style={{
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: 20,
                color: '#c4b5fd',
                fontSize: '0.72rem',
                cursor: 'pointer',
                padding: '5px 12px',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: '0.82rem', textAlign: 'center', marginTop: 24 }}>
              התחל שיחה — תאר תרחיש קליני
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.07)',
                  border: msg.role === 'assistant' ? '1px solid rgba(139,92,246,0.2)' : 'none',
                  color: '#f1f5f9',
                  fontSize: '0.82rem',
                  lineHeight: 1.6,
                  direction: 'rtl',
                }}
                dangerouslySetInnerHTML={{ __html: msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content }}
              />
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ color: '#6b7280', fontSize: '0.82rem', padding: '8px 12px' }}>מייצר תרחיש...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(139,92,246,0.2)',
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="תאר תרחיש קליני..."
            rows={2}
            dir="rtl"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 8,
              color: '#f1f5f9',
              fontSize: '0.85rem',
              padding: '8px 12px',
              resize: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            style={{
              background: isLoading || !input.trim() ? 'rgba(139,92,246,0.25)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              padding: '8px 18px',
              fontFamily: 'inherit',
              alignSelf: 'stretch',
            }}
          >
            שלח
          </button>
        </div>
      </div>

      {/* ── Right: JSON Preview (40%) ── */}
      <div
        style={{
          flex: '0 0 40%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(139,92,246,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, color: '#a78bfa', fontSize: '0.95rem', fontWeight: 700 }}>
            תצוגה מקדימה
          </h3>
          {previewJSON != null && (
            <button
              onClick={() => onApplyScenario(previewJSON)}
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                padding: '6px 16px',
                fontFamily: 'inherit',
              }}
            >
              ✓ Apply
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {previewJSON ? (
            <pre
              dir="ltr"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: 8,
                padding: 14,
                color: '#4ade80',
                fontSize: '0.72rem',
                fontFamily: "'Courier New', Courier, monospace",
                overflowX: 'auto',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {JSON.stringify(previewJSON, null, 2)}
            </pre>
          ) : (
            <div style={{ color: '#6b7280', fontSize: '0.82rem', textAlign: 'center', marginTop: 40 }}>
              JSON יוצג כאן לאחר יצירת תרחיש
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
