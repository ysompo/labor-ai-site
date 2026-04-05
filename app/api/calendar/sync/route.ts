/**
 * GET /api/calendar/sync
 *
 * Hourly cron job endpoint: syncs Hadassah Outlook calendar → Google Calendar.
 * Called by cron-job.org with header: Authorization: Bearer <CRON_SECRET>
 *
 * Idempotent — safe to call multiple times.
 * Outlook events are tagged in Google Calendar with:
 *   extendedProperties.private.source = "outlook-sync"
 *   extendedProperties.private.outlookId = <Outlook event ID>
 */

import { NextRequest, NextResponse } from "next/server";
import { getOutlookEvents, type OutlookEvent } from "@/lib/microsoft-graph";
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type GoogleCalendarEvent,
} from "@/lib/google-calendar";

// ── Auth guard ───────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TEMP DEBUG
  return NextResponse.json({
    received_header: req.headers.get("authorization") ?? "none",
    secret_length: process.env.CRON_SECRET?.length ?? 0,
    secret_prefix: process.env.CRON_SECRET?.slice(0, 6) ?? "unset",
  });
  // END TEMP DEBUG

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const timeMin = now.toISOString();
  const timeMax = thirtyDaysLater.toISOString();

  const microsoftConfigured =
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_REFRESH_TOKEN;

  if (!microsoftConfigured) {
    return NextResponse.json({ ok: true, skipped: "Microsoft credentials not configured" });
  }

  try {
    // Fetch events from both calendars in parallel
    const [outlookEvents, googleEvents] = await Promise.all([
      getOutlookEvents(timeMin, timeMax),
      listCalendarEvents(timeMin, timeMax),
    ]);

    const stats = await syncCalendars(outlookEvents, googleEvents);

    console.log("[calendar/sync] Done:", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[calendar/sync] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Sync logic ───────────────────────────────────────────────────────────────

interface SyncStats {
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
}

async function syncCalendars(
  outlookEvents: OutlookEvent[],
  googleEvents: GoogleCalendarEvent[]
): Promise<SyncStats> {
  const stats: SyncStats = { added: 0, updated: 0, deleted: 0, skipped: 0 };

  // Index Google events that were synced from Outlook
  // Key: outlookId → { googleEventId, lastModified }
  const googleByOutlookId = new Map<
    string,
    { googleEventId: string; lastModified: string }
  >();

  for (const ge of googleEvents) {
    const outlookId = ge.extendedProperties?.private?.outlookId;
    if (outlookId) {
      googleByOutlookId.set(outlookId, {
        googleEventId: ge.id,
        lastModified: ge.updated ?? "",
      });
    }
  }

  // Track which Outlook IDs we've seen (to detect deletions)
  const seenOutlookIds = new Set<string>();

  for (const oe of outlookEvents) {
    if (oe.isAllDay) {
      // Skip all-day events (not relevant for Zoom scheduling)
      stats.skipped++;
      continue;
    }

    seenOutlookIds.add(oe.id);

    const existing = googleByOutlookId.get(oe.id);
    const startIso = toJerusalemIso(oe.start.dateTime);
    const endIso = toJerusalemIso(oe.end.dateTime);

    const calEvent = {
      summary: oe.subject,
      location: oe.location?.displayName,
      description: oe.bodyPreview,
      startIso,
      endIso,
      extendedProps: {
        source: "outlook-sync",
        outlookId: oe.id,
        outlookLastModified: oe.lastModifiedDateTime,
      },
    };

    if (!existing) {
      // New in Outlook — create in Google
      if (!oe.isCancelled) {
        await createCalendarEvent(calEvent);
        stats.added++;
      }
    } else {
      // Already in Google — check if Outlook version is newer
      if (oe.isCancelled) {
        await deleteCalendarEvent(existing.googleEventId);
        stats.deleted++;
      } else if (
        oe.lastModifiedDateTime > existing.lastModified ||
        !existing.lastModified
      ) {
        await updateCalendarEvent(existing.googleEventId, calEvent);
        stats.updated++;
      } else {
        stats.skipped++;
      }
    }
  }

  // Delete Google events whose Outlook counterpart no longer exists
  for (const [outlookId, { googleEventId }] of googleByOutlookId.entries()) {
    if (!seenOutlookIds.has(outlookId)) {
      await deleteCalendarEvent(googleEventId);
      stats.deleted++;
    }
  }

  return stats;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a dateTime string (UTC or with timezone info) to an ISO string
 * with the +03:00 Jerusalem offset so Google Calendar displays it correctly.
 * (Assumes Microsoft Graph returns UTC datetimes.)
 */
function toJerusalemIso(dateTime: string): string {
  // Microsoft Graph returns datetimes without timezone info (UTC)
  const utc = new Date(
    dateTime.endsWith("Z") ? dateTime : dateTime + "Z"
  );
  // Jerusalem is UTC+3 (IST, no DST for our purposes — use +03:00)
  const offsetMs = 3 * 60 * 60 * 1000;
  const local = new Date(utc.getTime() + offsetMs);

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00+03:00`
  );
}
