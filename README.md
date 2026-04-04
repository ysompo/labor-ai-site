# Labor-AI Lab

Website and tooling platform for the Labor-AI research lab at **Hadassah Mount Scopus Medical Center** and the **Hebrew University of Jerusalem** — developing explainable, reliable AI decision-support tools for obstetrics.

---

## Overview

The platform serves two audiences:

- **Public** — lab website with research overview, team, publications, and contact form.
- **Clinical / Research** — password-protected tools for lab members and study participants, including a CTG simulation environment and an AI-powered research assistant.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript |
| Database | PostgreSQL (Neon / Vercel Postgres) |
| Real-time | Pusher |
| Auth | Custom JWT (jose) + bcrypt |
| AI | Anthropic Claude, OpenAI (Whisper) |
| Email | Resend |
| Storage | Vercel Blob |
| Calendar | Google Calendar API, Microsoft Graph API |
| Video | Zoom (Server-to-Server OAuth) |
| Deployment | Vercel |

---

## Project Structure

```
labor-ai-site/
├── app/                     # Next.js App Router
│   ├── api/                 # API routes
│   │   ├── auth/            # Google & Microsoft OAuth
│   │   ├── calendar/sync/   # Calendar sync cron
│   │   ├── chat/            # AI chat endpoint
│   │   ├── contact/         # Contact form (Resend)
│   │   ├── pusher/          # Real-time trigger & config
│   │   ├── research/        # Research assistant API
│   │   ├── simulator/       # Simulator auth, sessions, assessments
│   │   ├── whatsapp/        # WhatsApp webhook
│   │   └── zoom/            # Zoom meeting management
│   ├── tools/
│   │   ├── simulator/       # CTG Simulator (instructor + participant views)
│   │   ├── research/        # AI Research Assistant
│   │   └── admin/           # User management dashboard
│   ├── about/
│   ├── contact/
│   ├── publications/
│   ├── research/
│   └── team/
├── components/              # Shared React components
├── lib/                     # Server utilities & API clients
├── sql/                     # Database schema
├── scripts/                 # Dev/maintenance scripts
├── Whatsapp_bot/            # Standalone WhatsApp scheduling bot
└── public/                  # Static assets
```

---

## Features

### Public Website
- Home page with hero, figure carousel, and featured publication
- Team page with bios and photos
- Research overview and publications list
- Contact form (sends via Resend)

### CTG Simulator (`/tools/simulator`)
A clinical training environment for obstetric simulation sessions.

- **Instructor view** — configures CTG parameters, vitals, and lab values in real time; controls scenario cards and audio
- **Participant view** — receives a live CTG trace, patient banner, EHR-style labs panel, and scenario prompts on their own device (join via QR code or direct link)
- **Real-time sync** — instructor changes propagate instantly to all connected participants via Pusher
- **Video recording** — optional per-device video capture with timeline-aligned clips
- **Debrief** — post-session timeline review with notes and events
- **Assessments** — post-session forms emailed automatically via Resend
- **Admin panel** — invite users, approve self-registrations, manage cohorts

### AI Research Assistant (`/tools/research`)
- Claude-powered assistant for exploring research protocols and literature
- Authenticated, session-based; conversation history stored in PostgreSQL
- Protocol export to `.docx`

### WhatsApp Scheduling Bot (`Whatsapp_bot/`)
A standalone Node/TypeScript bot for coordinating simulation session scheduling.

- Parses availability via WhatsApp messages using Claude NLP
- Checks Google Calendar and Zoom for conflicts
- Creates Zoom meetings and Google Calendar events automatically
- Manages contacts and poll state via Vercel KV

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.8+ (for the `detect-secrets` pre-commit hook)
- A PostgreSQL database (Neon recommended for Vercel deployment)

### 1. Clone and install

```bash
git clone <repo-url>
cd labor-ai-site
npm install
pip install detect-secrets   # required for the pre-commit hook
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values. See `.env.example` for descriptions of every variable. The minimum set needed for local development:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Signs JWT session tokens |
| `ANTHROPIC_API_KEY` | Powers the AI chat and research tools |
| `POSTGRES_URL` | Database connection |
| `RESEND_API_KEY` | Email delivery |
| `PUSHER_*` | Real-time sync in the simulator |

### 3. Initialize the database

```bash
node scripts/run-schema.mjs
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

All variables are documented in `.env.example` with placeholder values. **Never commit `.env.local` or any file containing real credentials** — `.gitignore` excludes all `.env*` files automatically.

---

## WhatsApp Bot

The bot lives in `Whatsapp_bot/bot/` and runs as a separate process.

```bash
cd Whatsapp_bot/bot
cp .env.example .env.local   # fill in WhatsApp, Zoom, Google, and KV vars
npm install
npm run dev
```

See `Whatsapp_bot/bot/.env.example` for the bot-specific variables.

---

## Security

- **Pre-commit hook** — every commit is scanned by `detect-secrets` via Husky. Commits are blocked if new API keys, tokens, or credential patterns are detected.
- **Baseline** — `.secrets.baseline` whitelists known false positives (placeholder values in example files).
- **To audit a flagged finding:**
  ```bash
  python -m detect_secrets audit .secrets.baseline
  ```
- **To update the baseline** after marking false positives as safe:
  ```bash
  python -m detect_secrets scan > .secrets.baseline
  git add .secrets.baseline
  ```

---

## Deployment

The site is deployed on **Vercel**. Push to `main` triggers an automatic production deploy.

Environment variables are managed in the Vercel project dashboard — they do not need to be in any committed file.

The WhatsApp bot is deployed separately (e.g., a Vercel serverless function or a persistent Node process).

---

## License

Internal research software — Hadassah Mount Scopus / Hebrew University of Jerusalem. Not licensed for public redistribution.
