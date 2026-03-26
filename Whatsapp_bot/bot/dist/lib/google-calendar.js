"use strict";
/**
 * Google Calendar API client.
 * Uses the googleapis npm package with a pre-obtained refresh token.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCalendarEvent = createCalendarEvent;
exports.updateCalendarEvent = updateCalendarEvent;
exports.deleteCalendarEvent = deleteCalendarEvent;
exports.listCalendarEvents = listCalendarEvents;
exports.findFreeSlots = findFreeSlots;
const googleapis_1 = require("googleapis");
// ── Auth ─────────────────────────────────────────────────────────────────────
function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ??
        "https://labor-ai.org/api/auth/google/callback";
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN is not set");
    }
    const auth = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUri);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
}
function getCalendarClient() {
    return googleapis_1.google.calendar({ version: "v3", auth: getOAuth2Client() });
}
function calendarId() {
    return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}
// ── Create / update events ───────────────────────────────────────────────────
/**
 * Create a new event in Google Calendar.
 * Returns the created event ID.
 */
async function createCalendarEvent(event) {
    const cal = getCalendarClient();
    const resource = {
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
    if (!res.data.id)
        throw new Error("Google Calendar returned no event ID");
    return res.data.id;
}
/**
 * Update an existing Google Calendar event by ID.
 */
async function updateCalendarEvent(eventId, event) {
    const cal = getCalendarClient();
    const resource = {
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
async function deleteCalendarEvent(eventId) {
    const cal = getCalendarClient();
    await cal.events.delete({ calendarId: calendarId(), eventId });
}
/**
 * List events in a time range.
 */
async function listCalendarEvents(timeMin, timeMax) {
    const cal = getCalendarClient();
    const res = await cal.events.list({
        calendarId: calendarId(),
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
    });
    return (res.data.items ?? []);
}
/**
 * Find free time slots in the owner's calendar over the next N days.
 * Returns an array of { date, time } objects (Asia/Jerusalem).
 */
async function findFreeSlots(daysAhead = 7, slotDurationMinutes = 60, workdayStart = 9, workdayEnd = 18) {
    const now = new Date();
    const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const events = await listCalendarEvents(now.toISOString(), end.toISOString());
    const busyRanges = events
        .filter((e) => e.start?.dateTime)
        .map((e) => ({
        start: new Date(e.start.dateTime).getTime(),
        end: new Date(e.end?.dateTime ?? e.start.dateTime).getTime() + slotDurationMinutes * 60 * 1000,
    }));
    const slots = [];
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
            const isBusy = busyRanges.some((r) => slotStart < r.end && slotEnd > r.start);
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
//# sourceMappingURL=google-calendar.js.map