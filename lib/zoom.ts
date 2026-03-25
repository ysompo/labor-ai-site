/**
 * Zoom REST API client — Server-to-Server OAuth.
 * Fetches a short-lived access token, then creates meetings.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ZoomMeeting {
  id: number;
  topic: string;
  start_time: string;   // ISO 8601 in UTC
  duration: number;     // minutes
  join_url: string;
  start_url: string;
  password: string;
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ── Token cache (module-level, survives within a single Lambda invocation) ───

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 10_000) {
    return cachedToken;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, or ZOOM_CLIENT_SECRET is not set");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Zoom token request failed ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as ZoomTokenResponse;
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ── Meeting creation ─────────────────────────────────────────────────────────

export interface CreateMeetingOptions {
  topic: string;
  startTime: string;  // ISO 8601 UTC, e.g. "2024-05-01T14:00:00Z"
  durationMinutes?: number;
  timezone?: string;
}

/**
 * Create a Zoom meeting and return its details including join/start URLs.
 */
export async function createZoomMeeting(
  options: CreateMeetingOptions
): Promise<ZoomMeeting> {
  const token = await getAccessToken();

  const body = {
    topic: options.topic,
    type: 2, // Scheduled meeting
    start_time: options.startTime,
    duration: options.durationMinutes ?? 60,
    timezone: options.timezone ?? "Asia/Jerusalem",
    settings: {
      join_before_host: true,
      waiting_room: false,
      mute_upon_entry: false,
      auto_recording: "none",
    },
  };

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Zoom create meeting failed ${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as ZoomMeeting;
}

/**
 * Delete a Zoom meeting by ID (used for cleanup on error).
 */
export async function deleteZoomMeeting(meetingId: number): Promise<void> {
  const token = await getAccessToken();

  await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
