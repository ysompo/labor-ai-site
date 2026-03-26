# Labi — WhatsApp Scheduling Bot

Labi is a WhatsApp bot that schedules Zoom meetings, runs group availability polls, and transcribes voice messages. It runs as a standalone Node.js process using [Baileys](https://github.com/WhiskeySockets/Baileys) (no Meta Cloud API required).

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| `ZOOM_ACCOUNT_ID` | Zoom Marketplace → Server-to-Server OAuth app |
| `ZOOM_CLIENT_ID` | Same Zoom app |
| `ZOOM_CLIENT_SECRET` | Same Zoom app |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials |
| `GOOGLE_CLIENT_SECRET` | Same Google project |
| `GOOGLE_REFRESH_TOKEN` | Run the auth flow on labor-ai.org once: `GET /api/auth/google` |
| `GOOGLE_CALENDAR_ID` | `primary` (default) or a specific calendar ID |
| `OWNER_PHONE` | Your WhatsApp number, digits only, no `+` (e.g. `972546288294`) |
| `KV_REST_API_URL` | Vercel KV dashboard |
| `KV_REST_API_TOKEN` | Vercel KV dashboard |

### 3. First run — scan QR code

```bash
npm run dev
```

A QR code will appear in the terminal. Open WhatsApp on your GlobalSim number → Linked Devices → Link a device → scan the QR code.

The session is saved to `./auth_info/`. On subsequent runs the bot connects without showing a QR code.

### 4. Normal development run

```bash
npm run dev
```

---

## Build for production

```bash
npm run build   # compiles TypeScript → dist/
npm start       # runs dist/index.js
```

---

## Deploy to Railway

1. Push this folder to a GitHub repository (or a subfolder of one).
2. Create a new Railway project → **Deploy from GitHub repo**.
3. Add all environment variables from `.env` in the Railway dashboard under **Variables**.
4. Railway will build the Docker image automatically using the `Dockerfile`.

> **Important:** Railway provides ephemeral storage by default. To persist the WhatsApp session across restarts, attach a Railway **Volume** mounted at `/app/auth_info`.

---

## How to use (trigger words)

| Intent | Examples |
|---|---|
| Schedule a Zoom | `Labi, schedule a zoom with Avi on Thursday at 14:00` |
| Schedule in-person | `Labi, book a meeting in the office on Monday at 10:00` |
| Group poll | `@Labi find a time for a meeting this week` |
| Vote in poll | Reply with numbers: `1,3` |
| Close poll | `Labi close poll` / `לאבי סגור סקר` |
| Transcribe voice | Send a voice message to the bot |

### Group chat rules

Labi only responds to group messages that:
- Mention **labi** or **לאבי** (case-insensitive), OR
- Are a direct reply to one of Labi's own messages.

---

## Architecture

```
src/
  index.ts          — Baileys connection, QR, reconnect logic
  handler.ts        — Message routing + feature implementations
  whatsapp.ts       — sendText / sendTextToGroup helpers
  lib/
    claude-parser.ts  — NLP intent detection + scheduling parser (Claude API)
    zoom.ts           — Zoom Server-to-Server OAuth + meeting creation
    google-calendar.ts — Google Calendar event CRUD + free-slot finder
    poll-manager.ts   — Vercel KV poll state management
    contacts.ts       — Vercel KV contact store
```
