/**
 * Google Calendar API client.
 * Uses the googleapis npm package with a pre-obtained refresh token.
 */

import { google, calendar_v3, tasks_v1 } from "googleapis";

// ── Auth ─────────────────────────────────────────────────────────────────────

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    "https://labor-ai.org/api/auth/google/callback";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN is not set"
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function getCalendarClient() {
  return google.calendar({ version: "v3", auth: getOAuth2Client() });
}

function getTasksClient() {
  return google.tasks({ version: "v1", auth: getOAuth2Client() });
}

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id?: string;
  summary: string;
  location?: string;
  description?: string;
  startIso: string;  // ISO 8601 with timezone, e.g. "2024-05-01T14:00:00+03:00"
  endIso: string;
  attendeeEmails?: string[];
  extendedProps?: Record<string, string>;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
  updated?: string;
}

// ── Create / update events ───────────────────────────────────────────────────

/**
 * Create a new event in Google Calendar.
 * Returns the created event ID.
 */
export async function createCalendarEvent(
  event: CalendarEvent
): Promise<string> {
  const cal = getCalendarClient();

  const resource: calendar_v3.Schema$Event = {
    summary: event.summary,
    location: event.location,
    description: event.description,
    start: { dateTime: event.startIso, timeZone: "Asia/Jerusalem" },
    end: { dateTime: event.endIso, timeZone: "Asia/Jerusalem" },
    attendees: event.attendeeEmails?.map((email) => ({ email })),
    ...(event.extendedProps
      ? {
          extendedProperties: {
            private: event.extendedProps,
          },
        }
      : {}),
  };

  const res = await cal.events.insert({
    calendarId: calendarId(),
    requestBody: resource,
    sendUpdates: event.attendeeEmails?.length ? "all" : "none",
  });

  if (!res.data.id) throw new Error("Google Calendar returned no event ID");
  return res.data.id;
}

/**
 * Update an existing Google Calendar event by ID.
 */
export async function updateCalendarEvent(
  eventId: string,
  event: CalendarEvent
): Promise<void> {
  const cal = getCalendarClient();

  const resource: calendar_v3.Schema$Event = {
    summary: event.summary,
    location: event.location,
    description: event.description,
    start: { dateTime: event.startIso, timeZone: "Asia/Jerusalem" },
    end: { dateTime: event.endIso, timeZone: "Asia/Jerusalem" },
    attendees: event.attendeeEmails?.map((email) => ({ email })),
    ...(event.extendedProps
      ? {
          extendedProperties: {
            private: event.extendedProps,
          },
        }
      : {}),
  };

  await cal.events.update({
    calendarId: calendarId(),
    eventId,
    requestBody: resource,
    sendUpdates: event.attendeeEmails?.length ? "all" : "none",
  });
}

/**
 * Delete a Google Calendar event by ID.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const cal = getCalendarClient();
  await cal.events.delete({ calendarId: calendarId(), eventId });
}

/**
 * List events in a time range.
 */
export async function listCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const cal = getCalendarClient();

  const res = await cal.events.list({
    calendarId: calendarId(),
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  return (res.data.items ?? []) as GoogleCalendarEvent[];
}

/**
 * Find free time slots in the owner's calendar over the next N days.
 * Returns an array of { date, time } objects (Asia/Jerusalem).
 */
export async function findFreeSlots(
  daysAhead = 7,
  slotDurationMinutes = 60,
  workdayStart = 9,
  workdayEnd = 18
): Promise<{ date: string; time: string }[]> {
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const events = await listCalendarEvents(
    now.toISOString(),
    end.toISOString()
  );

  const busyRanges = events
    .filter((e) => e.start?.dateTime)
    .map((e) => ({
      start: new Date(e.start.dateTime!).getTime(),
      end: new Date(e.end?.dateTime ?? e.start.dateTime!).getTime() + slotDurationMinutes * 60 * 1000,
    }));

  const slots: { date: string; time: string }[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1); // start from next hour

  while (cursor < end && slots.length < 5) {
    const hour = cursor.getHours();
    const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat

    // Skip Friday afternoon (after 14:00) and Saturday (Shabbat)
    if (dayOfWeek === 6) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(workdayStart, 0, 0, 0);
      continue;
    }
    if (dayOfWeek === 5 && hour >= 14) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(workdayStart, 0, 0, 0);
      continue;
    }

    if (hour >= workdayStart && hour < workdayEnd) {
      const slotStart = cursor.getTime();
      const slotEnd = slotStart + slotDurationMinutes * 60 * 1000;
      const isBusy = busyRanges.some(
        (r) => slotStart < r.end && slotEnd > r.start
      );
      if (!isBusy) {
        const isoDate = cursor.toISOString().slice(0, 10);
        const isoTime = `${String(hour).padStart(2, "0")}:00`;
        slots.push({ date: isoDate, time: isoTime });
      }
    }

    cursor.setHours(cursor.getHours() + 1);
  }

  return slots;
}

// ── Google Tasks ──────────────────────────────────────────────────────────────

export interface CreateTaskOptions {
  title: string;
  notes?: string;
  dueDate?: string; // YYYY-MM-DD
}

/**
 * Create a task in the user's default Google Tasks list.
 */
export async function createGoogleTask(options: CreateTaskOptions): Promise<tasks_v1.Schema$Task> {
  const tasks = getTasksClient();

  // Get the default task list (@default)
  const task: tasks_v1.Schema$Task = {
    title: options.title,
    notes: options.notes,
  };

  if (options.dueDate) {
    // Google Tasks due date must be RFC 3339 UTC midnight
    task.due = `${options.dueDate}T00:00:00.000Z`;
  }

  const res = await tasks.tasks.insert({
    tasklist: "@default",
    requestBody: task,
  });

  return res.data;
}
