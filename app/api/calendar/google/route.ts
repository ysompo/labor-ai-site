/**
 * POST /api/calendar/google
 *
 * Internal API endpoint — creates an event in Google Calendar.
 * Can be called directly for testing.
 *
 * Body: {
 *   summary: string;
 *   startIso: string;
 *   endIso: string;
 *   location?: string;
 *   description?: string;
 *   attendeeEmails?: string[];
 * }
 * Returns: { eventId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createCalendarEvent } from "@/lib/google-calendar";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    summary?: string;
    startIso?: string;
    endIso?: string;
    location?: string;
    description?: string;
    attendeeEmails?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { summary, startIso, endIso, location, description, attendeeEmails } = body;

  if (!summary || !startIso || !endIso) {
    return NextResponse.json(
      { error: "summary, startIso, and endIso are required" },
      { status: 400 }
    );
  }

  try {
    const eventId = await createCalendarEvent({
      summary,
      startIso,
      endIso,
      location,
      description,
      attendeeEmails,
    });

    return NextResponse.json({ eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[calendar/google]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
