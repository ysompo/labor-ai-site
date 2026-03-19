# RESEARCH-TOOLS-SPEC.md
# Labor-AI Research Tools — Claude Code Implementation Specification
# Version 3.0 — Final with curated 154-variable catalog

> **Document purpose:** Authoritative spec for building the Research Tools module on labor-ai.org. Claude Code reads this before any implementation and follows it phase by phase.
>
> **Critical instruction:** The existing simulator section under `/tools/` already implements authentication (NextAuth v5, credentials provider, self-registration, admin approval, JWT sessions). Copy that exact authentication pattern — do not build auth from scratch.

---

## 1. Project Context

### 1.1 What We're Building
A 6-module AI-powered research workspace for OB/GYN residents at Hadassah Mount Scopus Medical Center, integrated into labor-ai.org under `/tools/*`. Every AI module is a Claude agent that knows the departmental data catalog (130K+ deliveries, 2015–2024, 154 curated variables in the resident-facing catalog, ~955 total available on request).

### 1.2 The 6 Modules
| # | Module | Type | Description |
|---|--------|------|-------------|
| 1 | Research Ideation | AI Agent | Claude guides residents from clinical observation → formal research proposal |
| 2 | Data Explorer | Tool + AI | Browse departmental variable catalog + upload own data for analysis |
| 3 | Literature Search | AI Agent | PubMed query building, abstract screening, critical appraisal |
| 4 | Statistical Advisor | AI Agent | Analysis plans, code generation (R/Python/Stata), power calculations |
| 5 | Manuscript Builder | AI Agent | Abstracts, manuscripts, reviewer responses, journal formatting |
| 6 | Research Schedule | AI + Manual | Task manager with AI-suggested milestones across 6 research phases |

### 1.3 Platform Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Database:** Vercel Postgres (already provisioned) — raw SQL via `@vercel/postgres`, no Prisma
- **AI Backend:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Email:** Resend (already configured)
- **Auth:** NextAuth v5 — copy from simulator section
- **Bilingual:** Hebrew (RTL) + English (LTR)

### 1.4 Architecture Principles
- Claude **never** sees raw patient-level data rows. It receives only: variable catalog metadata (names, types, descriptions, coverage) and computed summary statistics from resident-uploaded data.
- Both the catalog AND any uploaded dataset summaries are automatically injected as context into all AI modules.
- Every AI conversation has a PDF export button generating a branded document (Labor-AI Lab · Hadassah Mount Scopus).
- The admin (ysompo@gmail.com) can edit the catalog at any time via `/tools/admin/catalog`.

---

## 2. Authentication & Access Control

### 2.1 Copy from Simulator
The simulator section of the project already implements:
- `/tools/register` — self-registration (name, email, password)
- Admin approval workflow at `/tools/admin`
- NextAuth v5 with credentials provider
- bcrypt (12 rounds) password hashing
- JWT sessions (30 days)
- Resend email notifications on new registration
- Admin account: `ysompo@gmail.com` (pre-seeded)

**Claude Code:** Examine the simulator's auth implementation and replicate it exactly for the research tools section. Share the same users table and auth middleware — a user approved for the simulator should also have access to research tools, and vice versa.

### 2.2 Route Protection
- All `/tools/*` routes protected by middleware
- Public site (labor-ai.org) completely untouched
- API routes under `/api/research/*` require valid session

---

## 3. Data Catalog

### 3.1 Overview
The departmental database contains **130K+ deliveries (2015–2024)** with ~955 total variables. The **resident-facing catalog** exposes **154 curated variables** — the clinically relevant subset that residents need for study design and feasibility assessment. The full dataset (cervical time-series, detailed prior pregnancy records, additional lab tests, etc.) remains available and is noted in the catalog as "available on request."

The curated catalog is defined in the accompanying file `variable_catalog_final.xlsx` (the authoritative source). Claude Code should seed the database from this file. Below is a summary.

### 3.2 Curated Catalog (154 variables)

#### Demographics (7 vars)
- `MOM_AGE_AT_BIRTH` — Maternal age at delivery (continuous, 22-48)
- `blood_type` — Maternal blood type (categorical)
- `mother_height` — Height in cm
- `mother_weight_pre_pregnancy` — Pre-pregnancy weight (kg)
- `mother_weight_during_pregnancy` — Weight during pregnancy (kg)
- `BMI_pre_prgnancy` — Pre-pregnancy BMI (derived)
- `BMI_during_pregnancy` — BMI during pregnancy (derived)

#### Obstetric History (14 vars)
- `G` — Gravidity (0-30)
- `P` — Parity (0-20)
- `AB` — Abortions (0-20)
- `LC` — Live children (0-30)
- `EUP` — Ectopic pregnancies (0-10)
- `prev_CS` — Previous cesarean sections (0-10)
- `VBACS` — Previous VBACs (0-20)
- `primipara` — First birth (binary, derived from P=0)
- `previous_cd`, `previous_vd`, `previous_ivd` — Previous delivery mode counts
- `vd_after_cd_in_the_past` — VBAC history (binary)
- `last_delivery_GA` — GA at last delivery (weeks)
- `inter_pregnancy_interval_from_last_delivery` — Inter-pregnancy interval

#### Current Pregnancy (22 vars)
- `GA_week`, `GA_days` — Gestational age at delivery (weeks + days)
- `pre-term_term` — Preterm (<37w) vs. term classification
- `multiple_gestation` — Singleton/multiple
- `mode_of_conception_cat` — Conception method (spont/IVF/IUI/ovulation_induction)
- `NT` — Nuchal translucency (normalNT/noNT)
- `TT` — Triple test screening (normalTT/noTT)
- `GDM_test` — GDM screening performed (binary)
- `GDM` — Gestational diabetes diagnosis (binary; OGTT thresholds: 0h>95, 1h>180, 2h>155, 3h>140)
- `smoking`, `alcohol`, `drugs` — Substance use during pregnancy (binary)
- `HDP` — Hypertensive disease of pregnancy (binary)
- `Proteinuria` — Proteinuria level (None/Mild/Severe)
- `estimated_weight_ultra_sound` — US estimated fetal weight (grams)
- `estimated_weight_clinical` — Clinical estimated fetal weight (grams)
- `fetal_death_during_pregnancy` — IUFD (binary)
- `FHC` — Fetal head circumference (cm)
- `early_scan_system` — Early anatomical US findings (15-16 weeks)
- `late_scan_system` — Late anatomical US findings (20-24 weeks)
- `detailed_scan_system` — Targeted ultrasound findings
- `minor_major` — Fetal anomaly classification (minor/major)

#### Labor & Delivery (23 vars)
- `mode_start_new` — Labor onset mode (Spontaneous/pitocin/balloon/prostaglandin/combined) — **this is the clean/final version**
- `mode_of_end` — Final delivery mode (NVD/IVD/UCD/ECD)
- `anesth_type_cat` — Anesthesia type (no_anesth/epidural/spinal/general)
- `Bishop_Score` — Bishop score on admission (0-13)
- `Meconium` — Amniotic fluid character (clear/meconium1/meconium2/meconium3/bloody)
- `maternal_contraction` — Contractions present (binary)
- `full_dilation_time` — Timestamp of reaching 10 cm dilation
- `first_stage_length`, `second_stage_length`, `third_stage_length` — Labor stage durations
- `prolonged_second_stage` — Prolonged second stage (binary)
- `cd_during_second_stage` — Cesarean during second stage (binary)
- `time of ROM` — Time of rupture of membranes
- `time_ROM_delivery` — ROM to delivery interval
- `CS_urgency` — Cesarean urgency (Urgent/Elective)
- `CS_uterine_cut` — Uterine incision type (LSTSC/other)
- `CS_uterine_malformations` — Uterine findings at cesarean
- `obstetrical_bleeding` — Postpartum hemorrhage (binary)
- `tear_or_episiotomy` — Perineal trauma (binary)
- `degree_of_tear_or_episiotomy` — Laceration grade (0-4)
- `admission` — Admission timestamp
- `birth_year` — Year of delivery (2015-2024)
- `birth_month` — Month of delivery (1-12)

#### Cervical Exam Snapshots (9 vars)
- `first_check_dilation` — Dilation at admission (cm, 0-10)
- `first_check_effacement` — Effacement at admission (%, 0-100)
- `first_check_station` — Fetal station at admission (-4 to +3)
- `First_Cervical_Check_Record_Date` — Timestamp of first cervical exam
- `dilation_before_rapture` — Dilation at ROM (0-10)
- `dilation_after_rapture` — Dilation after ROM (0-10)
- `station_before_rapture` — Station at ROM (-4 to +3)
- `station_after_rapture` — Station after ROM (-4 to +3)
- `dilation_difference` — Dilation change with ROM (after minus before)

#### Neonatal Outcomes — Fetus 1 & 2 (18 vars) + General (6 vars) = 24 vars
Per fetus (f1, f2):
- `f[N]_birthweight` — Birthweight (grams)
- `f[N]_presentation` — Presentation (vertex/breech/other)
- `f[N]_mode_delivery` — Delivery mode per fetus
- `f[N]_sex` — Sex
- `f[N]_apgar1`, `f[N]_apgar5`, `f[N]_apgar10` — Apgar scores at 1, 5, 10 min
- `f[N]_perinatal_mortality` — Perinatal death (binary)
- `f[N]_delivery_time` — Delivery timestamp

General neonatal:
- `max_fetus_number` — Number of fetuses delivered (1-4)
- `sga` — Small for gestational age (binary, Dollberg tables, ≤10th percentile)
- `lga` — Large for gestational age (binary, Dollberg tables, ≥90th percentile)
- `NICU` — NICU admission (binary)
- `PH` — Umbilical cord arterial pH (continuous, 6.8-7.45)
- `SANO` — Severe Adverse Neonatal Outcome (composite: Apgar5≤7 OR pH≤7.1 OR NICU admission)

#### Key Blood Results (51 vars)
Selected clinically important lab tests from 248 available:
- **CBC (9):** HGB, HCT, WBC, PLT, RBC, MCV, MCH, RDW, MPV
- **Metabolic (8):** Glucose, Creatinine, BUN, Uric Acid, Calcium, Magnesium, Sodium, Potassium
- **Liver (8):** AST, ALT, Alk Phos, GGT, Total Bilirubin, Direct Bilirubin, LDH, Albumin
- **Coagulation (5):** PT (sec), INR, PTT, Fibrinogen, D-Dimer
- **Iron (3):** Iron, Ferritin, Transferrin
- **Thyroid (2):** TSH, Free T4
- **Preeclampsia (4):** sFlt-1, PlGF, Bile Acids, Protein/Creatinine Ratio
- **GDM (1):** HbA1c
- **APS Panel (4):** Anticardiolipin IgG/IgM, Anti-β2GP1 IgG/IgM
- **Autoimmune (1):** ANA
- **Inflammation (2):** CRP, ESR
- **Pregnancy (1):** β-hCG
- **Vitamins (3):** Vitamin B12, Folic Acid, Vitamin D

#### Grouped Data (available on request, not individually listed)
- **Vital signs** (~28 cols) — Pulse, systolic BP, diastolic BP, temperature with first/last/min/max/mean/count aggregates
- **Previous delivery summaries** (~29 cols) — Aggregate stats on prior birthweights, GA, IPI, preterm counts (avg/min/max/std)
- **Detailed prior pregnancy records** (~200 cols) — Per-pregnancy details for up to 20 prior pregnancies (conception, delivery mode, GA, weight, sex, outcome)
- **Fetus 3 & 4 data** (~18 cols) — Same attributes as f1/f2
- **Cervical exam time-series** (~273 cols) — Full temporal progression of dilation, effacement, station, consistency, position
- **Additional lab tests** (~195 cols) — Drug screening, specialized immunology, rare metabolic tests, etc.

### 3.3 Database Schema for Catalog

Store the catalog in Vercel Postgres. Admin edits it via `/tools/admin/catalog`.

```sql
CREATE TABLE catalog_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,           -- e.g., "Demographics", "Obstetric History"
  display_order INT NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE catalog_variables (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES catalog_categories(id) ON DELETE CASCADE,
  variable_name VARCHAR(255) NOT NULL,    -- e.g., "MOM_AGE_AT_BIRTH"
  display_name VARCHAR(255),              -- e.g., "Maternal Age at Birth"
  description TEXT,                       -- e.g., "Mother's age in years at time of delivery"
  variable_type VARCHAR(50) NOT NULL,     -- continuous, categorical, binary, date, text
  sample_values TEXT,                     -- e.g., "22-48" or "NVD, IVD, UCD, ECD"
  unit VARCHAR(50),                       -- e.g., "years", "grams", "mmHg"
  coverage_start INT,                     -- e.g., 2015
  coverage_end INT,                       -- e.g., 2024
  notes TEXT,                             -- e.g., "Derived from P column. Values 0-20."
  source VARCHAR(50),                     -- "master" or "blood_results"
  service_panel VARCHAR(255),             -- For blood results: Hebrew panel name
  is_active BOOLEAN DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Database-level metadata (editable by admin)
CREATE TABLE catalog_metadata (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed metadata
INSERT INTO catalog_metadata (key, value) VALUES
  ('total_deliveries', '130000+'),
  ('coverage_years', '2015-2024'),
  ('institution', 'Hadassah Mount Scopus Medical Center'),
  ('last_updated', '2024-12-01');
```

### 3.4 Context Injection Strategy

The curated catalog (154 variables) is small enough to inject a meaningful summary into every Claude prompt:

1. **Full catalog summary** — Always injected (~1500 tokens). Lists every category with variable names, types, and key notes. Format:
   ```
   Available Data: Hadassah Mt. Scopus, 130K+ deliveries, 2015-2024

   Demographics (7): MOM_AGE_AT_BIRTH (continuous), blood_type (categorical), mother_height, mother_weight_pre_pregnancy, mother_weight_during_pregnancy, BMI_pre_prgnancy, BMI_during_pregnancy

   Obstetric History (14): G, P, AB, LC, EUP, prev_CS, VBACS, primipara (binary), previous_cd, previous_vd, previous_ivd, vd_after_cd_in_the_past (binary), last_delivery_GA, inter_pregnancy_interval

   [... all categories ...]

   Additional data available on request: vital signs (~28 cols), previous delivery summaries (~29 cols), detailed prior pregnancies (~200 cols), cervical time-series (~273 cols), 195+ additional lab tests, fetus 3-4 data
   ```

2. **On-demand detail** — When the AI needs specifics (e.g., exact sample values, units, notes), it uses the `search_catalog` tool to query the DB.

3. **Uploaded data summary** — When a resident uploads a CSV/Excel, compute descriptive stats server-side and inject the summary (variable names, types, N, missing%, means/frequencies) into the AI context.

### 3.5 Admin Catalog Management (`/tools/admin/catalog`)

Provide a UI for the admin to:
- Add/edit/remove categories
- Add/edit/remove variables (with all fields from the schema)
- Bulk import from CSV (to bootstrap the catalog from the uploaded files)
- Edit database overview metadata (total deliveries, coverage years, etc.)
- Toggle variables active/inactive (hide without deleting)
- Search and filter variables by name, category, type

**Initial seed:** Claude Code should seed the catalog database from `variable_catalog_final.xlsx` (provided alongside this spec). The xlsx contains the full curated list of 154 variables with categories, display names, types, descriptions, and sample values. Parse Sheet 1 and insert into `catalog_categories` and `catalog_variables` tables.

---

## 4. Module Specifications

### 4.1 Module 1: Research Ideation

**Type:** Claude agent (conversational)

**Behavior:** The agent proactively engages the resident. Instead of static conversation starters, it opens with an exploratory question like:
- "What clinical pattern or outcome have you been curious about lately?"
- "Have you noticed anything surprising in your recent cases?"
- "Is there a practice in the department you think we should be studying?"

The agent then guides the conversation through:
1. **Exploring the observation** — asking clarifying questions, narrowing focus
2. **PICO framework** — structuring into Population, Intervention/Exposure, Comparison, Outcome
3. **FINER assessment** — Feasible, Interesting, Novel, Ethical, Relevant
4. **Study design suggestion** — recommending appropriate designs (retrospective cohort, case-control, RCT, systematic review) with OB/GYN-specific pros/cons
5. **Confounder & bias identification** — specific to the proposed study
6. **Ethical considerations** — especially for pregnant populations
7. **Feasibility check** — using the `search_catalog` tool to verify variable availability

**System prompt emphasis:**
- OB/GYN domain expertise: common research questions, typical confounders (maternal age, BMI, parity, GA), ethical constraints in pregnancy research
- Always check the data catalog when discussing feasibility
- Never fabricate variable availability — use the tool

### 4.2 Module 2: Data Explorer

**Type:** Two-tab tool with AI integration

#### Tab A: Available Data (Catalog Browser)
- Searchable, filterable list of all catalog variables
- Group by category with expand/collapse
- Each variable shows: name, display name, description, type, sample values, unit, coverage, notes
- Search by free text across all fields
- Filter by category, variable type, coverage period

#### Tab B: Upload & Explore
- Residents upload their own CSV/Excel files
- Server-side processing (never send raw data to Claude):
  - Auto-detect variable types (continuous/categorical/binary)
  - Compute descriptive statistics:
    - Numeric: n, missing count/%, mean, SD, median, IQR, min, max, range
    - Categorical: n, missing count/%, frequency counts per level, proportions
  - Generate visualizations:
    - Numeric: histogram
    - Categorical: bar chart
  - Show missing data rates per variable
- Upload persists per-project (stored in Vercel Postgres or a file store)
- Summary statistics automatically injected into AI context for all modules

**AI integration:** Both tabs feed into the AI context. When a resident asks the Ideation or Stats agent "is BMI available?", the agent knows the answer from the catalog.

### 4.3 Module 3: Literature Search

**Type:** Claude agent (conversational)

**Capabilities:**
1. **PubMed search string builder** — Given a topic or PICO, generate optimized search strings with MeSH terms, Boolean operators, and filters. Output both sensitive (broad) and specific (narrow) versions.
2. **Abstract screening** — Resident pastes/uploads abstracts. AI screens against inclusion/exclusion criteria, outputs: Include/Exclude/Uncertain + one-line rationale per abstract.
3. **Critical appraisal** — Structured appraisal using appropriate tools: Cochrane RoB (RCTs), Newcastle-Ottawa Scale (cohort/case-control), AMSTAR-2 (systematic reviews).
4. **Evidence summary table** — Build structured tables (author, year, design, population, intervention, outcomes, findings, quality).
5. **Gap analysis** — Identify how the proposed study fills gaps in existing literature.

**Important:** No live PubMed API in v1. The AI generates search strings and the resident runs them. Design the architecture to allow PubMed API integration later.

**Safety:** AI must clearly flag that all references must be independently verified. Never fabricate citations.

### 4.4 Module 4: Statistical Advisor

**Type:** Claude agent (conversational)

**Capabilities:**
1. **Test selection** — Based on study design, outcome type, and number of groups. Explain assumptions in plain language.
2. **Variable classification** — Help categorize as dependent/independent, continuous/categorical/ordinal.
3. **Statistical Analysis Plan (SAP)** — Generate a full SAP document:
   - Descriptive statistics plan
   - Primary and secondary analyses
   - Subgroup analyses with justification
   - Sensitivity analyses
   - Missing data handling (complete case, multiple imputation)
   - Multiplicity adjustment
   - Pre-specified significance level and CI width
4. **Code generation** — Starter code in **R, Python, or Stata** with comments. Use:
   - R: tidyverse + broom
   - Python: pandas + statsmodels + scipy
   - Stata: standard syntax
5. **Power/sample size calculations** — Interactive. Support:
   - Two-proportion comparison (e.g., cesarean rates)
   - Two-sample means (e.g., birthweight)
   - Time-to-event / log-rank
   - Non-inferiority / equivalence

**Output flexibility:** The agent should ask what format the resident wants: narrative SAP for IRB submission, code, or both.

**Catalog awareness:** The agent knows the variable types from the catalog and can suggest appropriate tests based on whether a variable is continuous, categorical, or binary.

### 4.5 Module 5: Manuscript Builder

**Type:** Claude agent (conversational)

**Capabilities:**
1. **Structured abstract** — Generate in CONSORT/STROBE/PRISMA format, per the study design. Support both English and Hebrew output.
2. **Manuscript outline** — Paragraph-by-paragraph guidance for each section.
3. **Section drafting:**
   - **Introduction:** Based on lit review and gap analysis
   - **Methods:** Based on study design and SAP from earlier modules
   - **Results:** Given actual numbers, draft with proper reporting (e.g., "aOR 0.XX, 95% CI 0.XX–0.XX; p=0.0XX"). If no data yet, generate templates with [placeholders].
   - **Discussion:** Clinical implications, limitations, future directions. Push for clear "why should a clinician care?"
4. **Journal targeting** — Suggest appropriate journals and apply their formatting rules. Maintain a database of common OB/GYN journals: AJOG, BJOG, Obstetrics & Gynecology, JMFNM, Placenta, etc.
5. **Revision response drafter** — Given reviewer comments, generate point-by-point responses with suggested manuscript edits.

**Style:** Precise, direct academic prose. Do not soften limitations. Support British vs. American English per target journal.

**Safety:** Never invent statistics or results. If resident hasn't provided data, ask for it. Always flag uncertain content.

### 4.6 Module 6: Research Schedule

**Type:** AI-suggested + manually editable task manager

**6 Research Phases:**
1. Idea & Literature Review
2. Protocol & IRB
3. Data Collection
4. Data Analysis
5. Writing & Submission
6. Revision & Resubmission

**Task model:**
```sql
CREATE TABLE research_tasks (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  phase INT NOT NULL CHECK (phase BETWEEN 1 AND 6),
  due_date DATE,
  completed_at TIMESTAMP,
  is_ai_suggested BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**AI suggestion flow:**
- When a resident creates a new project and completes the Ideation module (has a PICO and study design), the AI auto-generates a suggested task list with realistic due dates.
- Resident can accept, modify, or delete any task.
- Tasks are fully manually editable — add, edit, reorder, change dates, mark complete.

**Notifications:**
- Overdue task email alerts via Resend
- Daily check (cron or Vercel cron) for tasks past due date but not completed
- Email format: branded (Labor-AI Lab), lists overdue tasks with project name and days overdue

**UI:**
- Phase-grouped view with progress bars per phase
- Overdue tasks highlighted in red
- Upcoming deadlines section (next 7 days)
- Kanban or list view (resident preference)

---

## 5. Claude API Integration

### 5.1 Shared Chat Endpoint: `/api/research/chat/route.ts`

```typescript
interface ChatRequest {
  moduleId: 'ideation' | 'lit-search' | 'stats' | 'manuscript';
  messages: Message[];
  projectContext: ProjectContext;  // PICO, design, SAP if available
  catalogSummary: string;         // Compressed catalog (always injected)
  uploadedDataSummary?: string;   // Stats from uploaded CSV if any
  language: 'he' | 'en';
}
```

- Stream responses using Anthropic SDK `client.messages.stream()`
- Module-specific system prompt selected based on `moduleId`
- Inject project context + catalog summary into system prompt
- Register tools per module (see 5.2)
- Handle tool calls server-side, feed results back

### 5.2 Claude Tools

```typescript
// Available in ALL AI modules
search_catalog: {
  description: 'Search the departmental variable catalog. Returns matching variables with type, description, sample values, and coverage.',
  input: { query: string, category?: string, variable_type?: string }
}

// Module 4: Statistical Advisor
calculate_sample_size: {
  description: 'Calculate required sample size or power.',
  input: { test_type: string, parameters: object, alpha: number, power: number, solve_for: 'sample_size' | 'power' }
}

// Module 6: Research Schedule
suggest_tasks: {
  description: 'Generate suggested research tasks based on study design and PICO.',
  input: { study_design: string, pico: object }
}
```

### 5.3 Model Selection
- Default: `claude-sonnet-4-20250514` for all modules
- Environment variable `RESEARCH_ASSISTANT_MODEL` to override globally

---

## 6. PDF Export

### 6.1 Conversation PDF
Every AI chat module has a **PDF** button. Clicking it generates a branded PDF:

**Header:** Labor-AI Lab · Hadassah Mount Scopus · Hebrew University of Jerusalem
**Content:** All messages formatted cleanly (user messages in one style, AI responses in another)
**Footer:** "Generated by Labor-AI Research Assistant for educational purposes. All outputs must be reviewed by a supervising physician-researcher." + generation date

**Implementation:** Use a server-side PDF generation library (e.g., `@react-pdf/renderer` or `puppeteer` for HTML→PDF). The `/api/research/export/pdf` endpoint accepts conversation messages and returns a PDF buffer.

### 6.2 Specific Output Exports
- **SAP documents** → .docx export (use `docx` npm package)
- **Evidence tables** → .xlsx export (use `exceljs` or `xlsx` package)
- **Checklists** → .docx export

These are triggered from specific module outputs, not the general PDF button.

---

## 7. Project Persistence

### 7.1 Database Schema

```sql
CREATE TABLE research_projects (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',  -- draft, active, irb-submitted, completed, archived
  pico JSONB,                          -- { population, intervention, comparison, outcome, secondaryOutcomes, researchQuestion }
  design_decisions JSONB,              -- { selectedDesign, inclusionCriteria, exclusionCriteria, ... }
  analysis_plan JSONB,                 -- { primaryAnalysis, secondaryAnalyses, ... }
  language VARCHAR(2) DEFAULT 'he',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE research_conversations (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES research_projects(id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL,      -- ideation, lit-search, stats, manuscript
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE uploaded_datasets (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  summary JSONB,                       -- Computed descriptive stats
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Admin Panel (`/tools/admin`)

### 8.1 Existing (from simulator)
- User management: approve/reject registrations, view active users

### 8.2 New for Research Tools
- **Catalog management:**
  - CRUD for categories and variables
  - Bulk import from CSV
  - Edit database metadata (total deliveries, years, etc.)
  - Search/filter variables
  - Toggle active/inactive
- **Research overview (future):**
  - See all active projects across residents
  - Monitor API usage

---

## 9. File & Folder Structure

```
src/app/tools/research/
├── page.tsx                          # Main workspace layout
├── layout.tsx                        # Layout wrapper (auth check)
├── components/
│   ├── ResearchChat.tsx              # Reusable streaming chat interface
│   ├── ChatMessage.tsx               # Message bubble
│   ├── ChatInput.tsx                 # Input with send, file upload, language toggle
│   ├── PdfExportButton.tsx           # PDF export per conversation
│   ├── ModuleTabs.tsx                # Tab navigation for 6 modules
│   ├── ProjectSidebar.tsx            # Project list, context, progress
│   ├── LanguageToggle.tsx            # HE/EN toggle
│   ├── ExportMenu.tsx                # .docx / .xlsx export dropdown
│   │
│   ├── ideation/
│   │   └── IdeationAgent.tsx         # Module 1 wrapper
│   ├── data-explorer/
│   │   ├── CatalogBrowser.tsx        # Tab A: searchable catalog
│   │   ├── DataUploader.tsx          # Tab B: upload & analyze
│   │   └── DescriptiveStats.tsx      # Stats display component
│   ├── lit-search/
│   │   ├── LitSearchAgent.tsx        # Module 3 wrapper
│   │   ├── AbstractScreener.tsx      # Screening results table
│   │   └── EvidenceTable.tsx         # Evidence summary table
│   ├── stats/
│   │   ├── StatsAdvisor.tsx          # Module 4 wrapper
│   │   ├── PowerCalculator.tsx       # Interactive power calc
│   │   └── CodeViewer.tsx            # Syntax-highlighted code
│   ├── manuscript/
│   │   ├── ManuscriptBuilder.tsx     # Module 5 wrapper
│   │   └── RevisionResponse.tsx      # Reviewer response builder
│   └── schedule/
│       ├── ResearchSchedule.tsx      # Module 6 wrapper
│       └── TaskList.tsx              # Phase-grouped task view
│
├── lib/
│   ├── claude-client.ts              # Claude API wrapper with streaming
│   ├── system-prompts.ts             # Module-specific system prompts
│   ├── tools.ts                      # Claude tool definitions
│   ├── catalog.ts                    # Catalog DB queries + context builder
│   ├── data-analysis.ts              # Uploaded CSV/Excel analysis
│   ├── power-calculations.ts         # Sample size/power formulas
│   ├── pdf-export.ts                 # Conversation → branded PDF
│   ├── export-docx.ts               # SAP/checklist → .docx
│   ├── export-xlsx.ts               # Evidence table → .xlsx
│   └── types.ts                      # All TypeScript types
│
├── api/
│   ├── chat/route.ts                 # POST: Claude streaming endpoint
│   ├── catalog/
│   │   ├── route.ts                  # GET: catalog query/search
│   │   └── admin/route.ts            # POST/PUT/DELETE: admin CRUD
│   ├── upload/route.ts               # POST: CSV/Excel upload + analysis
│   ├── export/
│   │   ├── pdf/route.ts              # POST: conversation → PDF
│   │   ├── docx/route.ts             # POST: content → .docx
│   │   └── xlsx/route.ts             # POST: table → .xlsx
│   ├── projects/
│   │   ├── route.ts                  # GET/POST: list/create projects
│   │   └── [id]/route.ts             # GET/PUT/DELETE: single project
│   └── schedule/
│       ├── route.ts                  # GET/POST: tasks CRUD
│       └── notify/route.ts           # POST: overdue email check (cron)

src/app/tools/admin/
├── catalog/
│   └── page.tsx                      # Catalog management UI
```

---

## 10. Environment Variables

```env
# Existing (already configured)
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...             # Vercel Postgres
RESEND_API_KEY=re_...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...

# New for Research Tools
RESEARCH_ASSISTANT_MODEL=claude-sonnet-4-20250514
RESEARCH_ASSISTANT_DAILY_LIMIT=100      # Messages per user per day
ADMIN_EMAIL=ysompo@gmail.com
```

---

## 11. Implementation Order

### Phase 1: Foundation
1. Copy auth pattern from simulator section
2. Create database tables (catalog, projects, conversations, tasks, uploads)
3. Build the `/tools/research/page.tsx` layout with module tabs and project sidebar
4. Build `ResearchChat.tsx` with streaming support
5. Build the Claude chat API route with streaming
6. Verify: user authenticates → sees research workspace → types message → gets streamed response

### Phase 2: Data Catalog
1. Create database tables (catalog_categories, catalog_variables, catalog_metadata)
2. Write seed script to parse `variable_catalog_final.xlsx` and populate the catalog tables
3. Build catalog DB query functions (`lib/catalog.ts`)
4. Build the `search_catalog` Claude tool
5. Build `CatalogBrowser.tsx` (Tab A of Data Explorer)
6. Build admin catalog management UI (`/tools/admin/catalog`)
7. Build the catalog summary generator for AI context injection (all 154 vars formatted)
8. Verify: admin edits catalog → changes reflected in browser → AI agent can search catalog

### Phase 3: Module 1 — Research Ideation
1. Write the Ideation system prompt with OB/GYN domain expertise
2. Integrate catalog context injection
3. Build `IdeationAgent.tsx`
4. Build PDF export for conversations
5. Verify: resident describes a clinical observation → AI guides through PICO → checks catalog for feasibility → produces structured output → exports to PDF

### Phase 4: Data Explorer Tab B
1. Build file upload endpoint with CSV/Excel parsing
2. Implement auto-detection and descriptive statistics computation
3. Build `DataUploader.tsx` and `DescriptiveStats.tsx`
4. Inject upload summary into AI context
5. Verify: resident uploads CSV → sees stats and charts → AI modules aware of uploaded data

### Phase 5: Module 3 — Literature Search
1. Write the Lit Search system prompt
2. Build `LitSearchAgent.tsx`, `AbstractScreener.tsx`, `EvidenceTable.tsx`
3. Build .xlsx export for evidence tables
4. Verify: AI generates PubMed strings, screens abstracts, builds evidence table

### Phase 6: Module 4 — Statistical Advisor
1. Implement `lib/power-calculations.ts`
2. Register `calculate_sample_size` tool
3. Write the Stats Advisor system prompt (with Stata support)
4. Build `StatsAdvisor.tsx`, `PowerCalculator.tsx`, `CodeViewer.tsx`
5. Build .docx export for SAP documents
6. Verify: AI generates SAP, runs power calcs, produces R/Python/Stata code

### Phase 7: Module 5 — Manuscript Builder
1. Write the Manuscript Builder system prompt
2. Build journal format database (`lib/journal-formats.ts`)
3. Build `ManuscriptBuilder.tsx` and `RevisionResponse.tsx`
4. Build .docx export for manuscripts
5. Verify: AI drafts sections, handles reviewer responses, applies journal formatting

### Phase 8: Module 6 — Research Schedule
1. Build task CRUD endpoints
2. Write AI task suggestion logic
3. Build `ResearchSchedule.tsx` and `TaskList.tsx`
4. Set up overdue notification cron job with Resend
5. Verify: AI suggests tasks → resident edits → overdue emails sent

### Phase 9: Polish
1. Full RTL/Hebrew testing pass
2. Responsive design testing (desktop-first, tablet-acceptable, mobile-basic)
3. Rate limiting implementation
4. Educational disclaimer on all exports
5. End-to-end testing across all modules

---

## 12. Guardrails & Safety

- **No data fabrication:** Every system prompt includes "Never fabricate statistics, p-values, confidence intervals, or references."
- **No raw data to Claude:** Only catalog metadata and computed summaries.
- **No PHI in the system:** The platform never prompts residents to enter patient-identifiable information. Upload UI warns: "Upload only de-identified data."
- **Educational framing:** All exports include: "Generated by Labor-AI Research Assistant for educational purposes. All content must be reviewed by a supervising physician-researcher."
- **Citation integrity:** All literature-related outputs flag that references must be independently verified.
- **Rate limiting:** 100 messages/day per user (configurable via env).

---

*End of specification. Claude Code: implement this document phase by phase, starting with Phase 1. Read the simulator's auth code first before writing anything.*
