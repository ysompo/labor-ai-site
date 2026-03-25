# WhatsApp Bot — Claude Code Build Specification

## Project Overview
Build a WhatsApp bot that:
1. Schedules Zoom meetings from natural language commands (private chat or group chat)
2. Runs a mini Doodle poll in group chats to find a meeting time, then schedules automatically
3. Syncs Hadassah Outlook calendar → Google Calendar every hour (background job)
4. Transcribes voice messages (Hebrew + English) — Feature 2, build after Feature 1 is complete

The bot is built as **Next.js API routes** deployed on the existing **labor-ai.org Vercel project**.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js (existing labor-ai.org project) |
| WhatsApp | Meta Cloud API (direct, no Twilio) |
| Meeting creation | Zoom REST API (Server-to-Server OAuth) |
| User's calendar | Google Calendar API |
| Outlook sync | Microsoft Graph API |
| NLP parsing | Anthropic Claude API (claude-sonnet-4-20250514) |
| Voice transcription | OpenAI Whisper API |
| Cron trigger | cron-job.org (external, hits a Vercel API route) |
| Bot state (polls) | Vercel KV |
| Language | TypeScript |

---

## Environment Variables Required

Create a `.env.local` file with the following — values to be filled in by the user:

```
# Meta / WhatsApp
WHATSAPP_TOKEN=                  # Permanent access token from Meta Developer App
WHATSAPP_PHONE_NUMBER_ID=        # Phone Number ID from Meta Developer App
WHATSAPP_VERIFY_TOKEN=           # Any random string you choose for webhook verification

# Zoom (Server-to-Server OAuth)
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=            # Obtained via one-time OAuth flow (see setup instructions)
GOOGLE_CALENDAR_ID=primary       # Use 'primary' for personal calendar

# Microsoft Graph (Outlook / Hadassah)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REFRESH_TOKEN=         # Obtained via one-time OAuth flow (see setup instructions)

# Anthropic
ANTHROPIC_API_KEY=

# OpenAI (Whisper)
OPENAI_API_KEY=

# Cron security
CRON_SECRET=                     # Any random string to secure the cron endpoint
```

---

## File Structure to Create

```
/app/api/
  whatsapp/
    route.ts          # Main webhook: receives all WhatsApp messages
  zoom/
    create/
      route.ts        # Creates a Zoom meeting and returns join URL
  calendar/
    google/
      route.ts        # Creates/updates events in Google Calendar
    sync/
      route.ts        # Hourly cron job: Outlook → Google Calendar sync
  auth/
    google/
      route.ts        # One-time OAuth flow to get Google refresh token
    microsoft/
      route.ts        # One-time OAuth flow to get Microsoft refresh token

/lib/
  whatsapp.ts         # Send WhatsApp messages helper
  zoom.ts             # Zoom API client
  google-calendar.ts  # Google Calendar API client
  microsoft-graph.ts  # Microsoft Graph API client
  claude-parser.ts    # NLP: parse natural language commands using Claude API
  poll-manager.ts     # Manage poll state in Vercel KV
  contacts.ts         # Build contacts map from group message activity
```

---

## Feature 1: Schedule a Zoom Meeting

### Trigger (private or group chat)
User sends: `"Bot, schedule a zoom with Avi and Sarah on Thursday at 14:00"`
Or in a group: `"@Bot schedule a zoom with everyone on Thursday at 14:00"`

### Flow
1. Webhook receives message at `POST /api/whatsapp`
2. Detect if it's a scheduling command (contains "schedule", "zoom", "meeting" in Hebrew or English)
3. Pass message text to Claude API for parsing → extract:
   - Participant names or "everyone" (for group chats)
   - Date and time
   - Optional: meeting title/topic
4. Resolve participant phone numbers:
   - If "everyone" → use all known contacts from group (built from message history stored in Vercel KV)
   - If named → look up in contacts map
5. Call Zoom API → create meeting → get join URL and start URL
6. Call Google Calendar API → create event with:
   - Title, date, time, duration (default 1 hour)
   - Zoom join URL in location field
   - Participant emails if available (triggers Google Calendar invites automatically)
7. Send WhatsApp message to each participant with the Zoom join URL
8. Reply to the original chat confirming the meeting was scheduled

### Claude Parser Prompt (in `lib/claude-parser.ts`)
```
System: You are a meeting scheduling assistant. Extract structured data from natural language scheduling requests in Hebrew or English.
Return JSON only, no explanation.
Format: { "participants": ["name1", "name2"] or "everyone", "date": "YYYY-MM-DD", "time": "HH:MM", "topic": "string or null" }
If date is relative (e.g. "Thursday", "tomorrow"), resolve it relative to today's date which is provided.
If any field cannot be determined, set it to null.
```

---

## Feature 2: Mini Doodle Poll (Group Chat Only)

### Permission Model
- **Anyone** in the group can trigger a poll
- **Only the bot owner** (defined by `OWNER_PHONE` env variable) can close the poll and schedule

### Trigger
Anyone in group sends: `"@Bot find a time for a meeting this week"`

### Flow
1. Bot reads owner's Google Calendar (and Outlook via sync) to find free slots
2. Bot proposes 3-5 options based on available times in the next 7 days
3. Bot sends poll message to group:
```
📅 When can everyone meet?
Reply with the numbers you're available for (e.g. "1,3"):

1. Thursday 14:00
2. Thursday 16:00  
3. Friday 10:00
4. Friday 14:00
```
4. Store open poll in Vercel KV with:
   - Group ID
   - Options (date/time list)
   - Votes: `{ phoneNumber: [optionNumbers] }`
   - Status: "open"
5. When participants reply with numbers → update vote tally in KV
6. When owner sends `"@Bot close poll"` or `"@Bot סגור סקר"`:
   - Find winning slot (most votes, owner's preference wins ties)
   - Proceed with same flow as Feature 1 (Zoom + Calendar + WhatsApp invites)
   - Mark poll as closed in KV

### Poll State Schema (Vercel KV)
```typescript
interface Poll {
  groupId: string;
  options: { index: number; date: string; time: string }[];
  votes: Record<string, number[]>; // phoneNumber → chosen option indices
  status: "open" | "closed";
  createdAt: string;
}
```

---

## Feature 3: Outlook → Google Calendar Sync (Background Job)

### Trigger
`GET /api/calendar/sync` — called every hour by cron-job.org
Protected by `Authorization: Bearer CRON_SECRET` header

### Flow
1. Verify cron secret header
2. Fetch all events from Hadassah Outlook calendar for next 30 days via Microsoft Graph API:
   `GET https://graph.microsoft.com/v1.0/me/calendars/{main-calendar-id}/events`
3. Fetch all events from Google Calendar for same 30-day window
4. Compare by event title + start time:
   - **New in Outlook, missing in Google** → create in Google Calendar
   - **Updated in Outlook** → update in Google Calendar (compare `lastModifiedDateTime`)
   - **Cancelled/deleted in Outlook** → delete from Google Calendar
5. Log sync results (count of added/updated/deleted)

### Notes
- Tag all synced events in Google Calendar with `extendedProperties.private.source = "outlook-sync"` so the bot knows which events it manages
- Never modify the original Outlook events

---

## Feature 4: Voice Message Transcription

### Trigger
User sends a voice note to the bot (private or group)

### Flow
1. Webhook receives message with `type: "audio"`
2. Download audio file from Meta's media URL using the WhatsApp token
3. Send `.ogg` audio file to OpenAI Whisper API with `language: null` (auto-detect Hebrew/English)
4. Reply with transcript text in the same chat

---

## WhatsApp Webhook (`/api/whatsapp/route.ts`)

### GET — Webhook Verification (one-time Meta setup)
```typescript
// Meta sends: hub.mode, hub.verify_token, hub.challenge
// Verify token matches WHATSAPP_VERIFY_TOKEN, return hub.challenge
```

### POST — Incoming Messages
```typescript
// Parse incoming message
// Determine message type: text | audio | other
// Determine chat type: individual | group
// Route to appropriate handler:
//   - Scheduling command → Feature 1
//   - Poll trigger → Feature 2
//   - Poll vote (number reply in group with open poll) → update votes
//   - Close poll command → close and schedule
//   - Audio message → Feature 4
//   - Unknown → ignore silently
// Always return 200 immediately (Meta requires fast response)
// Process async after returning 200
```

---

## Contacts Management (`/lib/contacts.ts`)

- Every incoming message stores `{ name (display name), phoneNumber }` in Vercel KV under key `contacts:{groupId}`
- Used to resolve participant names to phone numbers for WhatsApp messaging
- Display names come from Meta webhook payload (`contacts[0].profile.name`)

---

## One-Time Setup Flows

### Google OAuth (`/api/auth/google/route.ts`)
- `GET /api/auth/google` → redirects to Google OAuth consent screen
- `GET /api/auth/google/callback` → exchanges code for tokens, displays refresh token for user to copy to `.env.local`

### Microsoft OAuth (`/api/auth/microsoft/route.ts`)
- Same pattern as Google but using Microsoft identity platform
- Scopes needed: `Calendars.Read`, `offline_access`

---

## WhatsApp Message Templates

For sending to participants who haven't messaged the bot first, register this template in Meta Business Manager:

**Template name:** `zoom_invite`
**Body:**
```
You've been invited to a Zoom meeting on {{1}} at {{2}}.
Join here: {{3}}
```

---

## Key Implementation Notes

1. **Always return HTTP 200 immediately** from the WhatsApp webhook — process everything asynchronously using `waitUntil` or background processing
2. **Hebrew support** — all command detection must support both Hebrew and English trigger words
3. **Timezone** — default to `Asia/Jerusalem` for all date/time operations
4. **Vercel timeout** — all API routes must complete within 10 seconds (easily achievable for this workload)
5. **Error handling** — if any API call fails, send a WhatsApp message back to the user explaining what went wrong in plain language
6. **Idempotency** — the sync job must handle being called multiple times without creating duplicate events

---

## Hebrew Trigger Words to Detect

| Intent | Hebrew | English |
|---|---|---|
| Schedule meeting | תזמן פגישה / תקבע זום | schedule zoom / book meeting |
| Find time | מצא זמן / מתי נוכל | find a time / when can we |
| Close poll | סגור סקר / קבע לפי ההצבעה | close poll / schedule it |
| Transcribe | תתמלל | transcribe |

---

## Build Order

1. Environment setup + `.env.local` template
2. WhatsApp webhook verification (GET handler)
3. Basic message receiving + logging (POST handler)
4. Claude parser for scheduling commands
5. Zoom meeting creation
6. Google Calendar event creation
7. WhatsApp message sending helper
8. End-to-end Feature 1 (private chat scheduling)
9. Contacts store
10. Poll manager (Vercel KV)
11. Feature 2 (group poll + scheduling)
12. Microsoft Graph OAuth + calendar reading
13. Feature 3 (hourly sync job)
14. Feature 4 (voice transcription)
15. One-time OAuth setup routes

---

## Setup Instructions for User

After Claude Code builds the project, the user needs to:

1. **Meta Developer App** — create app, add WhatsApp product, get Phone Number ID and permanent token, set webhook URL to `https://labor-ai.org/api/whatsapp`
2. **Zoom** — create Server-to-Server OAuth app at marketplace.zoom.us, copy Account ID / Client ID / Client Secret
3. **Google OAuth** — create OAuth credentials at console.cloud.google.com, enable Calendar API, run `/api/auth/google` once to get refresh token
4. **Microsoft OAuth** — register app at portal.azure.com, add Calendar.Read scope, run `/api/auth/microsoft` once to get refresh token
5. **Vercel KV** — enable Vercel KV in the Vercel dashboard for the labor-ai.org project
6. **cron-job.org** — create a free account, add a job: `GET https://labor-ai.org/api/calendar/sync` every 60 minutes with header `Authorization: Bearer {CRON_SECRET}`
7. **WhatsApp template** — submit `zoom_invite` template in Meta Business Manager
