# Labor-AI Delivery Room Simulator — Complete Technical Specification
# Version: Final — for Claude Code implementation

## 1. Overview

Build an immersive, tablet-optimized, multi-device delivery room simulator for training OB/GYN residents and midwives on obstetric emergencies at Hadassah Mount Scopus Medical Center.

The simulator replicates a real Israeli hospital EHR (Chameleon-style) and bedside fetal monitor. Three tablets are used simultaneously, synced in real-time, with role-based views. The system includes live CTG waveform rendering, Web Audio FHR beeping, structured lab panels, video recording, timestamped notes, debriefing tools, and formal assessment forms.

**This builds on an existing Next.js 16 + TypeScript + Tailwind v4 project deployed on Vercel.** The database tables, API routes, auth system, and basic simulator scaffold already exist. This spec covers the immersive layer that replaces the current simple card UI and adds multi-device synchronization.

---

## 2. Project Context

- **Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4
- **Hosting:** Vercel
- **Database:** Vercel Postgres
- **Real-time sync:** Pusher (free tier — 200k messages/day, 100 concurrent connections)
- **AI API:** Anthropic Claude via `/api/chat` server-side proxy (already implemented)
- **Video storage:** Vercel Blob (initially) or Cloudflare R2 for larger volumes
- **Brand color:** `#4B2E6A` (purple)
- **Target device:** iPad in landscape mode (1024×768 minimum, optimized for 1194×834 iPad Air)
- **Language:** Hebrew RTL throughout the simulator interface
- **Offline:** Not required — reliable WiFi assumed in simulation space

---

## 3. The Three-Tablet Architecture

### 3.1 Device Roles

| Tablet | User | Role Code | What They See | What They Can Do |
|--------|------|-----------|---------------|-----------------|
| **Tablet 1** | Senior Physician (רופא בכיר) | `instructor` | Full view: CTG + EHR + expected actions + controls + notepad | Start/stop sim, advance cards, live overrides, timestamped notes, free-text notepad, fill **resident** assessment |
| **Tablet 2** | Supervising Midwife (מיילדת אחראית) | `midwife_supervisor` | Observer view: CTG + EHR (same as trainees) + notepad + assessment | Timestamped notes, free-text notepad, fill **midwife** assessment. **Cannot** control scenario. |
| **Tablet 3** | Trainees (2 residents + 1-2 midwives) | `display` | Immersive clinical view ONLY: CTG monitor + EHR labs + patient banner. No controls, no expected actions, no card indicators. | View only. Optional: start/stop video recording. |

### 3.2 Session Flow

1. Senior physician logs in → navigates to `/tools/simulator` → creates new session
2. Selects scenario, assigns participants from roster (primary/secondary residents, primary/secondary midwives), enters their own name as instructor
3. System generates a **session code** (e.g., "SIM-4827")
4. Supervising midwife logs in → goes to `/tools/simulator/join` → enters session code → role auto-assigned based on staff roster
5. Trainee tablet navigates to `/tools/simulator/live/SIM-4827` → **no login required** → display-only mode
6. Physician taps "התחל סימולציה" → all three tablets sync: timer starts, CTG begins drawing, audio begins (on tablets that have audio enabled)
7. During simulation: physician advances cards and/or pushes live overrides → all tablets update in real-time via Pusher
8. Physician taps "סיים סימולציה" → all tablets show "הסימולציה הסתיימה"
9. **Debriefing phase** → trainee tablet switches to debriefing view (timeline + video playback). Physician can add debrief notes on the timeline.
10. **Evaluation phase** → physician fills resident assessment on tablet 1, midwife supervisor fills midwife assessment on tablet 2
11. **Save & share** → assessments saved to DB, PDFs can be exported and emailed to participants

### 3.3 Real-Time Sync (Pusher)

Use Pusher Channels for real-time communication between tablets.

**Channel:** `presence-sim-{sessionCode}` (presence channel tracks who's connected)

**Events published by physician tablet:**

| Event | Payload | Triggers |
|-------|---------|----------|
| `card-advance` | `{ cardNumber, structuredData }` | CTG params change, labs update, vitals update on all tablets |
| `live-override` | `{ type: "fhr_drop" \| "bp_change" \| "alarm" \| ..., params }` | Immediate CTG/vitals change without advancing card |
| `timer-control` | `{ action: "start" \| "pause" \| "resume" \| "stop" }` | Timer sync |
| `session-end` | `{}` | All tablets switch to debrief mode |

**Events published by any tablet:**

| Event | Payload |
|-------|---------|
| `note-added` | `{ author, role, text, simTime, isQuickTag, tagType? }` |
| `recording-started` | `{ device, simTime }` |
| `recording-stopped` | `{ device, simTime, clipId }` |

**Pusher setup:**
```
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=...
```

Add server-side auth endpoint at `/api/pusher/auth` for presence channels.

---

## 4. Staff Roster & Participants

### 4.1 Database: `sim_staff` table (replaces `sim_residents`)

```sql
CREATE TABLE IF NOT EXISTS sim_staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,          -- 'מתמחה' | 'מיילדת' | 'רופא בכיר' | 'מיילדת אחראית'
  email VARCHAR(255) DEFAULT '',      -- for sending evaluations/reports
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Roles:
- `מתמחה` — resident trainee
- `מיילדת` — midwife trainee
- `רופא בכיר` — senior physician (instructor/evaluator)
- `מיילדת אחראית` — senior midwife (supervisor/evaluator)

### 4.2 Database: `sim_session_participants` table (new)

```sql
CREATE TABLE IF NOT EXISTS sim_session_participants (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  staff_id INT REFERENCES sim_staff(id),
  role_in_session VARCHAR(50) NOT NULL,  -- 'primary_resident' | 'secondary_resident' | 'primary_midwife' | 'secondary_midwife' | 'instructor' | 'midwife_supervisor'
  evaluated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

When starting a session, the physician assigns:
- **Primary resident** (evaluated = true)
- **Secondary resident** (evaluated = false)
- **Primary midwife** (evaluated = true)
- **Secondary midwife** (optional, evaluated = false)
- **Instructor** = the physician themselves (auto-assigned)
- **Midwife supervisor** = the senior midwife (selected from roster)

Secondary participants get a "participated" record in their history without formal scores.

### 4.3 Updated `sim_sessions` table

```sql
-- Modify: remove single resident_id, add session_code
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS session_code VARCHAR(20) UNIQUE;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'setup';
-- status: 'setup' | 'running' | 'debrief' | 'completed'
```

The `instructor_name` field stays for backward compatibility, but the instructor is also tracked via `sim_session_participants`.

---

## 5. Card Structured Data

### 5.1 Database migration

```sql
ALTER TABLE sim_cards ADD COLUMN IF NOT EXISTS structured_data JSONB;
```

### 5.2 TypeScript interface

```typescript
interface CardStructuredData {
  ctg: {
    fhr_baseline: number;
    fhr_variability: "normal" | "reduced" | "minimal" | "absent" | "saltatory";
    accelerations: "present" | "absent";
    decelerations: "none" | "early" | "variable_mild" | "variable_moderate" | "variable_severe" | "late" | "prolonged";
    deceleration_depth?: number;
    deceleration_duration?: number;
    contraction_frequency: number;
    contraction_intensity: "mild" | "moderate" | "strong";
    special?: "bradycardia" | "tachycardia" | "sinusoidal" | "none";
  };
  
  vitals: {
    hr: number;
    bp_systolic: number;
    bp_diastolic: number;
    spo2: number;
    temp: number;
    rr?: number;
  };
  
  labs: {
    cbc?: { wbc?: number; rbc?: number; hgb?: number; hct?: number; plt?: number; mcv?: number; mch?: number; mchc?: number; mpv?: number; rdw?: number; };
    chemistry?: { na?: number; k?: number; cl?: number; glu?: number; bun?: number; cre?: number; ast?: number; alt?: number; alb?: number; ldh?: number; alk_p?: number; ggtp?: number; t_bil?: number; d_bil?: number; mg?: number; ur_ac?: number; ca?: number; p?: number; tp?: number; };
    coagulation?: { pt_pct?: number; inr?: number; ptt?: number; fib?: number; d_dimer?: number; tt?: number; bt?: number; };
    other?: { crp?: number; protein_creatinine_ratio?: number; blood_type?: string; };
  };
  
  abnormal_fields: string[];
  
  patient?: {
    name: string;
    age: number;
    gravida: number;
    para: number;
    gestational_weeks: number;
    gestational_days: number;
    blood_type?: string;
    allergies?: string;
    history?: string;
  };
}
```

### 5.3 Live Override Structure

The physician can push immediate changes without advancing a card:

```typescript
interface LiveOverride {
  type: "fhr" | "vitals" | "alarm" | "custom";
  params: {
    fhr_baseline?: number;        // sudden bradycardia: set to 70
    fhr_variability?: string;     // change variability
    decelerations?: string;       // trigger decelerations
    hr?: number;                  // maternal HR change
    bp_systolic?: number;
    bp_diastolic?: number;
    spo2?: number;
    trigger_alarm?: boolean;
    custom_message?: string;      // flash a message on trainee display
  };
}
```

---

## 6. Screen Layouts

### 6.1 Tablet 1 — Senior Physician (Instructor)

```
┌─────────────────────────────────────────────────────────────────────┐
│  PATIENT BANNER (dark bg)                              Timer 04:27  │
│  שם: רחל כהן | גיל: 32 | G3P2 | שבוע 39+4 | דם: O+ | ...         │
├──────────────────────────────────────────┬──────────────────────────┤
│                                          │  VITAL SIGNS NUMERICS    │
│         CTG MONITOR (Canvas)             │  FHR: 140  (green)       │
│   FHR trace (green) on dark bg           │  MHR: 92   (yellow)      │
│   Yellow bands at 110 & 160              │  BP: 120/78 (white/red)  │
│   Toco channel below (white)             │  SpO2: 99% (cyan)        │
│                                          │  Temp: 36.8              │
├──────────────────────────────────────────┼──────────────────────────┤
│                                          │  📋 EXPECTED ACTIONS      │
│   EHR LABS PANEL                         │  (scenario reference,     │
│   (Hebrew RTL tables matching            │   collapsed/expandable)   │
│    Hadassah EHR style)                   │                          │
│                                          │  📝 FREE-TEXT NOTEPAD     │
│   ספירה | ביוכימיה | מנגנון קרישה        │  (persistent, always      │
│                                          │   visible scratchpad)     │
│                                          ├──────────────────────────┤
│                                          │  INSTRUCTOR CONTROLS      │
│                                          │  [◀ Prev] Card 2/4 [▶]  │
│                                          │  [⚡ Override] [📝 Note]  │
│                                          │  [🔴 Record] [🔇 Mute]   │
│                                          │  [⏹ End Simulation]      │
└──────────────────────────────────────────┴──────────────────────────┘
```

**Override panel** (opens as modal/drawer when tapped):
- Slider: FHR baseline (60–200)
- Slider: BP systolic (60–220)
- Slider: SpO2 (70–100)
- Quick buttons: "Trigger Bradycardia", "Trigger Decel", "Trigger Alarm"
- Changes push immediately via Pusher

### 6.2 Tablet 2 — Supervising Midwife

```
┌─────────────────────────────────────────────────────────────────────┐
│  PATIENT BANNER                                        Timer 04:27  │
├──────────────────────────────────────────┬──────────────────────────┤
│                                          │  VITAL SIGNS NUMERICS    │
│         CTG MONITOR (Canvas)             │                          │
│   (identical to trainee view)            │                          │
│                                          │                          │
├──────────────────────────────────────────┼──────────────────────────┤
│                                          │  📝 FREE-TEXT NOTEPAD     │
│   EHR LABS PANEL                         │                          │
│   (identical to trainee view)            │  [📝 Quick Note]         │
│                                          │  [🔴 Record]             │
│                                          │  (NO scenario controls)  │
└──────────────────────────────────────────┴──────────────────────────┘
```

Same clinical view as trainee tablet + notepad + quick note button + optional recording. No card controls, no expected actions.

### 6.3 Tablet 3 — Trainee Display

```
┌─────────────────────────────────────────────────────────────────────┐
│  PATIENT BANNER (dark bg)                                           │
│  שם: רחל כהן | גיל: 32 | G3P2 | שבוע 39+4 | דם: O+               │
├──────────────────────────────────────────┬──────────────────────────┤
│                                          │                          │
│         CTG MONITOR (Canvas)             │  VITAL SIGNS NUMERICS    │
│                                          │                          │
│   FHR trace (green) on dark bg           │  FHR: 140                │
│   Yellow bands at 110 & 160              │  MHR: 92                 │
│   Toco channel below                     │  BP: 120/78              │
│                                          │  SpO2: 99%               │
│                                          │  Temp: 36.8              │
├──────────────────────────────────────────┴──────────────────────────┤
│                                                                     │
│   EHR LABS PANEL (full width)                                       │
│   ספירה | ביוכימיה | מנגנון קרישה                                   │
│                                                                     │
│                                          [🔴 Record] (small corner) │
└─────────────────────────────────────────────────────────────────────┘
```

Clean clinical display only. No controls, no timer visible, no card indicators. Just what the team would see at a real bedside. Small record button in corner (optional).

---

## 7. CTG Monitor — Waveform Rendering

### 7.1 Visual Style

Match the EHR-integrated CTG from reference screenshots (slides 6, 8):
- Dark background (`#1a1a2e`)
- Y-axis: 60–200 bpm, gridlines every 20 bpm
- **Yellow/amber horizontal bands** at 110 and 160 bpm (semi-transparent)
- **FHR trace:** green line, ~2px width
- **Maternal HR trace:** yellow line, ~1px width, dimmer
- **Time axis:** scrolling left-to-right, timestamps every 5 minutes
- **Toco channel:** separate area below, 0–100 scale, white contraction peaks

### 7.2 Waveform Generation Algorithm

The CTG generates a realistic trace in real-time based on the card's CTG parameters. NOT playback of recordings.

```typescript
function generateFHRSample(params: CTGParams, timeMs: number): number {
  let fhr = params.fhr_baseline;
  
  // Variability: band-limited noise using multiple sine waves
  const amp = { normal: 10, reduced: 3, minimal: 1, absent: 0, saltatory: 20 }[params.fhr_variability];
  fhr += amp * (
    Math.sin(timeMs * 0.003) * 0.4 +
    Math.sin(timeMs * 0.007) * 0.3 +
    Math.sin(timeMs * 0.013) * 0.2 +
    (Math.random() - 0.5) * 0.3
  );
  
  // Accelerations: periodic bumps up of 15-25 bpm lasting 15-30 sec
  // Decelerations: synchronized with contractions, shape varies by type
  // Early: gradual mirror of contraction
  // Variable: sharp V-shape, onset/offset abrupt
  // Late: onset after contraction peak, gradual
  // Prolonged: sustained drop for >2 min
  
  return Math.round(fhr);
}

function generateTocoSample(frequency: number, intensity: string, timeMs: number): number {
  const period = (10 * 60 * 1000) / frequency;
  const phase = (timeMs % period) / period;
  const peakAmp = { mild: 30, moderate: 50, strong: 80 }[intensity];
  const sigma = 0.12;
  return Math.round(peakAmp * Math.exp(-((phase - 0.5) ** 2) / (2 * sigma ** 2)) + (Math.random() - 0.5) * 3);
}
```

### 7.3 Card Transitions

When the physician advances cards, CTG parameters transition **gradually** over 30–60 seconds. Baseline shifts smoothly, variability changes progressively, decelerations appear/intensify. No jarring jumps.

### 7.4 Live Overrides

Override changes apply **immediately** (no gradual transition) — a sudden bradycardia should hit the trace right away. The waveform generator checks for active overrides before applying card parameters.

### 7.5 Canvas Implementation

- Use `requestAnimationFrame` at 60fps
- Circular buffer: ~1200 data points per trace (20 min at 1 sample/sec)
- Draw only visible portion
- Static grid layer using `OffscreenCanvas` if available
- The Canvas runs its own animation loop independent of React renders
- Use React refs for CTG state, not useState

---

## 8. Vital Signs Numeric Display

Large colored numbers like a real bedside monitor:

| Parameter | Color | Alert Threshold |
|-----------|-------|----------------|
| FHR | Green (#22c55e) | <110 or >160 → red flash |
| MHR | Yellow (#eab308) | <50 or >120 → red flash |
| BP | White (#f1f5f9), red if abnormal | Systolic >160 or <90, Diastolic >110 |
| SpO2 | Cyan (#06b6d4) | <95 → yellow, <90 → red |
| Temp | White (#f1f5f9) | >38.0 → red |

Numbers update with slight random jitter (±1-2 bpm for HR, ±1 mmHg for BP) every 2–3 seconds to look alive. Values come from `structured_data.vitals` and are modified by live overrides.

---

## 9. EHR Labs Panel

**Must match the exact Hadassah EHR visual style from reference screenshots.**

### 9.1 Visual Design

- **Table headers:** Blue text (`#1e40af`) on light gray background row
- **Section titles:** Bold Hebrew in rounded border box — ביוכימיה, ספירה, מנגנון קרישה
- **Column headers:** English abbreviations (NA, K, CL, GLU, BUN, CRE, etc.)
- **Values:** Monospaced font, right-aligned numbers
- **Abnormal values:** Red color (`#dc2626`) and underlined — based on `abnormal_fields` array
- **Date/time column:** far left (RTL), format: `DD/MM/YY HH:MM`
- **חומר column:** "דם" or "שתן"
- **Progressive rows:** each card adds a new row, table grows over time (like sequential labs in a real EHR)

### 9.2 Lab Panels (matching screenshots exactly)

**Panel: ספירה**
```
WBC | RBC | HGB | HCT | MCV | MCH | MCHC | PLT | MPV | RETIC | RDW
```

**Panel: ביוכימיה**
```
NA | K | CL | GLU | BUN | ECRE | CRE | CA | P | TP | ALB | ALT | AST
```

**Panel: ביוכימיה (extended)**
```
ALK.P | GGTP | T.BIL | D.BIL | DIA | LDH | UR.AC | MG | CHOL | HDL | LDL | TG
```

**Panel: מנגנון קרישה**
```
PT% | INR | PTT | DIMER | FIB | TT | BT
```

**Individual tests** (CRP, PROTEIN/CREATININE RATIO):
```
תאריך | חומר | שם בדיקה | תוצאה | יחידות | ע. ייחוס | הערות
```

### 9.3 Normal Ranges for Highlighting

```typescript
export const NORMAL_RANGES: Record<string, [number, number]> = {
  wbc: [4.0, 11.0], hgb: [11.0, 16.0], hct: [33, 44], plt: [150, 400],
  na: [135, 145], k: [3.5, 5.0], cre: [0.4, 0.9], ast: [0, 35], alt: [0, 35],
  ldh: [0, 250], glu: [70, 140], mg: [1.7, 2.4],
  inr: [0.8, 1.2], ptt: [25, 35], fib: [200, 600],
  crp: [0, 0.5],
};
```

---

## 10. Audio System

Use **Web Audio API** — no external audio files.

### 10.1 FHR Beeping

```typescript
// Short sine beep at FHR rate
// FHR 140 = beep every 429ms (reassuring rhythm)
// FHR 70 = beep every 857ms (ominous slowing)
// Pitch: 800Hz at normal FHR, drops to ~600Hz during bradycardia

function createBeep(audioCtx: AudioContext, frequency = 800, duration = 0.08) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
```

Use `audioCtx.currentTime` for precise scheduling, not `setInterval`.

### 10.2 Alarms

| Condition | Threshold | Sound |
|-----------|-----------|-------|
| FHR bradycardia | <110 for >30 sec | Rapid triple beep at 1000Hz, repeat every 3 sec |
| FHR tachycardia | >160 for >30 sec | Double beep at 700Hz |
| Maternal BP critical | Systolic >160 or <90 | Medium priority double beep |
| SpO2 low | <95% | Descending tone |
| SpO2 critical | <90% | High priority rapid beep |

### 10.3 Audio Initialization

AudioContext requires user gesture. The "התחל סימולציה" button initializes audio. Mute/unmute button always visible on evaluator tablets.

---

## 11. Note-Taking System

### 11.1 Timestamped Quick Notes

Both evaluators (physician + midwife supervisor) get a floating 📝 button. Tap → small input slides up → type or pick a quick tag → saves with sim timestamp → disappears.

**Quick tags for physician:**
- ⚠️ פספס סימן אזהרה
- ⏱ עיכוב בקבלת החלטה
- ✅ זיהוי מהיר
- 📢 הכרזה ברורה
- 🔇 לא קרא לעזרה
- 💬 תקשורת טובה

**Quick tags for midwife supervisor:**
- 💊 ידע תרופתי טוב
- ❌ לא הכירה פרוטוקול
- ✅ הכנת ציוד נכונה
- 📢 דיווח מדויק

Plus free-text option always available.

### 11.2 Persistent Free-Text Notepad

A small panel always visible on evaluator tablets. Not timestamped, not structured — a continuous scratchpad. Content carries over into the assessment form as starting material for strengths/improvements/key message.

### 11.3 Database: `sim_notes` table (new)

```sql
CREATE TABLE IF NOT EXISTS sim_notes (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  author_id INT REFERENCES sim_staff(id),
  sim_time_seconds INT NOT NULL,        -- simulation clock time
  note_type VARCHAR(20) DEFAULT 'text', -- 'text' | 'quick_tag' | 'debrief'
  tag_type VARCHAR(50) DEFAULT '',      -- quick tag identifier
  content TEXT DEFAULT '',
  phase VARCHAR(20) DEFAULT 'simulation', -- 'simulation' | 'debrief'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 11.4 Notepad Content: `sim_notepads` table (new)

```sql
CREATE TABLE IF NOT EXISTS sim_notepads (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  author_id INT REFERENCES sim_staff(id),
  content TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 12. Video Recording

### 12.1 Fully Manual Control

Recording is **not automatic**. Any tablet can start/stop recording via a small 🔴 button. Multiple clips per session are supported.

When record is tapped:
1. **Consent notice** appears: "סימולציה זו מוקלטת למטרות הדרכה והערכה. בלחיצה על 'אשר' את/ה מאשר/ת את ההקלטה."
2. User confirms → front-facing camera + audio begin recording
3. Red dot indicator visible on screen while recording
4. Tap again to stop → clip saved

The trainee tablet's **front-facing camera** captures the team working (they're looking at the screen, so the camera faces them).

### 12.2 Recording Specs

- Resolution: 720p (balance quality vs performance)
- Frame rate: 15fps (sufficient for reviewing team dynamics)
- Format: WebM (MediaRecorder default) or MP4
- Audio: include room audio (verbal communication)
- Each clip tagged with: session_id, device_role, sim_start_time, sim_end_time, clip_id

### 12.3 Database: `sim_video_clips` table (new)

```sql
CREATE TABLE IF NOT EXISTS sim_video_clips (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sim_sessions(id) ON DELETE CASCADE,
  device_role VARCHAR(20) NOT NULL,     -- 'instructor' | 'midwife_supervisor' | 'display'
  sim_time_start INT NOT NULL,          -- sim seconds when recording started
  sim_time_end INT NOT NULL,
  blob_url TEXT NOT NULL,               -- Vercel Blob or R2 URL
  duration_seconds INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 12.4 Upload

After recording stops, upload in background to Vercel Blob via `/api/simulator/upload-video`. Don't block the UI during upload — show a small upload progress indicator.

---

## 13. Debriefing View

Accessible **immediately after simulation ends AND later from session history**. The debriefing view is a permanent record.

### 13.1 Layout

Displayed on the trainee tablet (big screen everyone can see) and accessible from session detail on any device.

```
┌─────────────────────────────────────────────────────────────────────┐
│  SESSION HEADER                                                     │
│  סימולציה: PPH | תאריך: 13/03/2026 | משך: 07:12                    │
│  צוות: [names]                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TIMELINE BAR                                                       │
│  ──●──────●────────●──────●────────●─────────●──→                   │
│    0:00   1:30     2:47   4:15     5:30      7:12                   │
│    Start  Card 2   📝Note Card 3   📝Note    End                    │
│           ⚡FHR↓   "לא    ⚡BP↓    "הכרזה                           │
│           to 110   זיהה"           ברורה"                           │
│                                                                     │
│  Tap any point to jump video there                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  VIDEO PLAYER                          │  NOTES LIST               │
│  [▶ Play] [⏸] ──●──── [timeline]      │  All timestamped notes    │
│                                        │  from both evaluators,    │
│  Clip 1: 2:30–5:45 (trainee tablet)   │  ordered chronologically  │
│  Clip 2: 4:00–4:45 (physician tablet) │                           │
│                                        │  [+ Add debrief note]    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.2 Debrief Notes

During the debrief discussion, the physician can tap any point on the timeline and add a new note (marked as `phase: "debrief"`, visually distinct from simulation notes). These annotate the review conversation.

### 13.3 Video Playback

All clips from the session are listed. Tapping a clip plays it. The timeline scrubber is synchronized — jumping to a point on the timeline jumps the video to the corresponding moment.

---

## 14. Assessment & Evaluation

### 14.1 Two Separate Assessments Per Session

- **Physician → evaluates primary resident** (form_type: "resident")
- **Midwife supervisor → evaluates primary midwife** (form_type: "midwife")

The assessment form is identical to the current implementation (rubric with 3 sections, 11 items, each rated 0/1/2, plus free text). No changes to the `sim_assessments` table structure except linking to participant instead of just session.

### 14.2 Assessment Links to Participant

```sql
ALTER TABLE sim_assessments ADD COLUMN IF NOT EXISTS participant_id INT REFERENCES sim_session_participants(id);
ALTER TABLE sim_assessments ADD COLUMN IF NOT EXISTS evaluator_id INT REFERENCES sim_staff(id);
```

### 14.3 Pre-populated Notes

The evaluator's timestamped notes and notepad content appear alongside the assessment form as reminders. The notepad text pre-fills the strengths/improvements fields as a starting point.

### 14.4 Trainee Access

Evaluated trainees can view their own assessment. The assessment appears in their history accessible from the session detail page.

### 14.5 PDF Export & Email

**Per-participant PDF:**
- Branded: Labor-AI Lab · Hadassah Mount Scopus
- Hebrew RTL
- Contains: participant name, role, scenario name, date, duration, all rubric scores, all notes, strengths/improvements/key message, instructor name
- Exportable from session detail or from participant history

**Email delivery:**
- After saving assessment, option to "שלח למשתתף" → sends PDF to participant's email address from the roster
- Uses Resend (already configured in the project)

---

## 15. AI Scenario Editor

### 15.1 Location

Inside `/tools/admin/simulator` as an additional tab or panel alongside the manual scenario/card editor.

### 15.2 System Prompt

```
You are an AI assistant for creating obstetric simulation scenarios for a delivery room training program at Hadassah Medical Center. You help instructors create realistic clinical scenarios with progressive cards.

You work with this data structure:

SCENARIO: name, case_story (Hebrew), expected_actions (Hebrew), phases (Hebrew)
CARDS: ordered list, each with:
  - card_number, title
  - clinical_description (Hebrew free text)
  - structured_data: JSON containing:
    - ctg: { fhr_baseline, fhr_variability, accelerations, decelerations, contraction_frequency, contraction_intensity, special }
    - vitals: { hr, bp_systolic, bp_diastolic, spo2, temp }
    - labs: { cbc: {...}, chemistry: {...}, coagulation: {...}, other: {...} }
    - abnormal_fields: [field names to highlight in red]
    - patient: { name, age, gravida, para, gestational_weeks, gestational_days, blood_type, allergies, history }

When creating a scenario:
1. Generate a realistic Hebrew case story
2. Create 3-5 progressive cards showing clinical escalation
3. Ensure vital signs and labs change realistically between cards
4. CTG parameters should match the clinical situation
5. Mark abnormal values explicitly in abnormal_fields
6. Patient info goes on card 1 only

Respond in Hebrew when addressed in Hebrew, English when addressed in English.
Output: JSON block with full scenario + cards, plus brief clinical rationale.

Available emergency types: PPH, shoulder dystocia, vacuum delivery, eclampsia/severe HTN, uterine rupture, preterm delivery, fetal bradycardia, maternal cardiac arrest/AFE, placental abruption, cord prolapse.
```

### 15.3 UI

Chat panel alongside a preview panel. When AI generates JSON, an "Apply" button loads it into the scenario form. Instructor reviews and edits before saving.

---

## 16. Pre-Populated Scenarios

Seed all 8 scenarios from the training documents on first setup. Full card data with structured_data JSON for each.

### Scenario 1: PPH — דימום אחרי לידה
Patient: רחל, age 32, G2P2, 39+4w. Vacuum delivery, complete placenta, increased bleeding.
5 cards: Card 1 (HR 92, BP 120/78, Hgb 11.2) → Card 2 (HR 109, BP 111/68, atonic uterus, Hgb 10.1) → Card 3 (HR 122, BP 94/62, no response to treatment, Hgb 9.9, INR 1.4) → Card 4 (HR 132, BP 87/49, massive bleeding, Hgb 8.1, INR 1.9) → Card 5 (OR, HR 142, BP 94/58 with support, Hgb 6.4, INR 2.3)

### Scenario 2: Shoulder Dystocia — פרע כתפיים
Patient: שירה, age 34, G3P2, 40+2w. GDM A1, BMI 35, EFW 3930g.
3 cards: Card 1 (pre-delivery, HR 92, normal CTG) → Card 2 (head delivered, no rotation, turtle sign, fetal brady 90) → Card 3 (>1 min, no release, fetal brady 70-80)

### Scenario 3: Vacuum Delivery — ואקום
Patient: נעמה, age 30, G1P0, 40+3w. Prolonged 2nd stage, epidural.
4 cards: Card 1 (assessment, station +1) → Card 2 (no progress 30 min) → Card 3 (2 pulls no descent, caput) → Card 4 (2nd pop-off, worsening decels)

### Scenario 4: Eclampsia — אקלמפסיה + יל"ד חמור
Patient: מיכל, age 27, G1P0, 36+6w. Headache, visual changes.
4 cards: Card 1 (BP 172/112, PLT 135, AST 85, ALT 92) → Card 2 (seizure, BP 185/118, SpO2 86%, fetal brady 80) → Card 3 (post-ictal, BP 178/108, PLT 110, AST 130, ALT 150) → Card 4 (recovering, BP 154/95)

### Scenario 5: Uterine Rupture — קרע ברחם
Patient: פאטמה, age 35, G8P7CS1VBAC4, 39+1w. TOLAC.
3 cards: Card 1 (normal labor, 7cm) → Card 2 (pain over scar, mild bleeding, 9cm, variable decels) → Card 3 (acute pain, HR 125, BP 92/58, Hgb 9.8, head ascending)

### Scenario 6: Preterm 26w — לידה מוקדמת
Patient: יעל, age 29, G2P1, 26+2w. Regular contractions.
4 cards: Card 1 (cervix 23mm, regular contractions) → Card 2 (3cm, 80% effaced) → Card 3 (ROM, 6cm, CRP 32, WBC 17) → Card 4 (full dilation, CRP 60, variable decels)

### Scenario 7: Fetal Bradycardia — ברדיקרדיה עוברית
Patient: הדס, age 33, G8P6, 40+1w. Active labor, 6-7cm, epidural ordered.
3 cards: Card 1 (normal, FHR 140) → Card 2 (sudden brady 70-80, >3 min, post epidural, tachysystole 7-8 contractions/10min) → Card 3 (no recovery, minimal variability)

### Scenario 8: Maternal Resuscitation — החייאה (AFE)
Patient: סמירה, age 41, G10P9, 39+0w. Full dilation, sudden dyspnea.
4 cards: Card 1 (HR 130, BP 88/54, SpO2 85%, fetal tachycardia) → Card 2 (pulseless, no SpO2, fetal severe brady) → Card 3 (BLS 4min, no pulse) → Card 4 (post-CS, DIC, PLT 85, INR 2.1, Fib 90)

---

## 17. File Structure (suggested)

```
components/tools/simulator/
  SimulatorScreen.tsx          — main layout orchestrator, role-based rendering
  CTGMonitor.tsx               — Canvas-based CTG waveform renderer
  WaveformGenerator.ts         — algorithms for FHR/toco waveform generation
  VitalSignsDisplay.tsx        — large numeric vital signs panel
  EHRLabsPanel.tsx             — tabular labs (ספירה, ביוכימיה, קרישה)
  PatientBanner.tsx            — top patient info bar
  InstructorControls.tsx       — card nav, overrides, timer
  LiveOverridePanel.tsx        — sliders/buttons for real-time changes
  NoteSystem.tsx               — timestamped notes + quick tags + notepad
  VideoRecorder.tsx            — MediaRecorder wrapper with consent UI
  DebriefView.tsx              — timeline, video playback, debrief notes
  AssessmentForm.tsx           — rubric form (resident/midwife variants)
  AudioEngine.ts               — Web Audio beep/alarm system
  PusherSync.ts                — Pusher connection and event handling
  SessionJoin.tsx              — join page for session code entry

components/tools/simulator/admin/
  AIScenarioEditor.tsx         — chat interface for AI-assisted editing
  StructuredDataEditor.tsx     — manual JSON editor for card data
  ScenarioPreview.tsx          — preview how a card renders on the monitor
  StaffRoster.tsx              — manage staff (all 4 roles + email)

lib/
  ctgPresets.ts                — preset CTG patterns for common scenarios
  labNormalRanges.ts           — normal ranges for red highlighting
  simulatorTypes.ts            — all TypeScript interfaces for simulator

app/tools/simulator/
  page.tsx                     — main simulator (role-based view)
  join/page.tsx                — session code join page
  live/[code]/page.tsx         — trainee display (no auth required)

app/api/simulator/
  (existing routes stay)
  pusher/auth/route.ts         — Pusher presence channel auth
  upload-video/route.ts        — video clip upload to Vercel Blob
  staff/route.ts               — CRUD for sim_staff
  staff/[id]/route.ts          — individual staff member
```

---

## 18. Dependencies to Add

```
pusher-js              — client-side Pusher SDK
pusher                 — server-side Pusher SDK (for auth + triggering)
@vercel/blob           — video clip storage
```

No other new dependencies needed. Canvas, MediaRecorder, Web Audio are all browser APIs.

---

## 19. Implementation Priority

| Phase | What | Notes |
|-------|------|-------|
| **Phase 1** | CTG Canvas renderer + vital signs + audio | Core visual — get this looking right first |
| **Phase 2** | EHR labs panel (Hebrew RTL tables) | Styling precision, match screenshots |
| **Phase 3** | Patient banner + instructor controls | Layout integration |
| **Phase 4** | Pusher sync + session codes + 3 role views | Multi-device architecture |
| **Phase 5** | Note system (quick tags + notepad) | During-simulation tools |
| **Phase 6** | Video recording | MediaRecorder + upload |
| **Phase 7** | Debriefing view (timeline + video playback) | Post-simulation |
| **Phase 8** | Assessment form updates (participant linking, email) | Evaluation |
| **Phase 9** | AI scenario editor | Admin tool |
| **Phase 10** | Seed 8 scenarios with full structured data | Content |
| **Phase 11** | Staff roster migration (sim_residents → sim_staff) | Data migration |

---

## 20. Reference Materials

- **EHR screenshots** (5 images): lab tables showing ספירה, ביוכימיה, מנגנון קרישה, and individual tests. Located in `sim_screenshots/slide1_img0.png` through `slide5_img4.png`.
- **CTG screenshots** (6 images): various CTG patterns from normal to bradycardia. Located in `sim_screenshots/slide6_img5.png` through `slide11_img10.png`. Each annotated with interpretation (Normal BL/V/A/D through to Tachy BL, reduced V, Moderate D, Bradycardia).
- **Scenario documents** (Hebrew): full text of 8 scenarios + cards + assessment forms. Located in the original .docx files.
- **Audio samples**: [to be provided — FHR beeping at normal and bradycardia rates, alarm tones]
