/**
 * POST /api/zoom/create
 *
 * Internal API endpoint — creates a Zoom meeting.
 * Can be called directly for testing or from other server-side code.
 *
 * Body: { topic: string; startTime: string; durationMinutes?: number }
 * Returns: ZoomMeeting object
 */

import { NextRequest, NextResponse } from "next/server";
import { createZoomMeeting } from "@/lib/zoom";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { topic?: string; startTime?: string; durationMinutes?: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, startTime, durationMinutes } = body;

  if (!topic || !startTime) {
    return NextResponse.json(
      { error: "topic and startTime are required" },
      { status: 400 }
    );
  }

  try {
    const meeting = await createZoomMeeting({
      topic,
      startTime,
      durationMinutes: durationMinutes ?? 60,
      timezone: "Asia/Jerusalem",
    });

    return NextResponse.json({
      id: meeting.id,
      topic: meeting.topic,
      start_time: meeting.start_time,
      duration: meeting.duration,
      join_url: meeting.join_url,
      start_url: meeting.start_url,
      password: meeting.password,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[zoom/create]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
