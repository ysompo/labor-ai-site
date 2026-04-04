/**
 * GET /api/health
 *
 * Lightweight connectivity check for every external integration.
 * Protected by the same CRON_SECRET Bearer token as /api/calendar/sync.
 *
 * Returns 200 if all checks pass, 503 if any fail.
 * Each integration reports "ok" or a short error label — never raw messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { listCalendarEvents } from "@/lib/google-calendar";

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckResult = "ok" | "missing_config" | "token_expired" | "auth_failed" | "unreachable" | "error";

interface HealthReport {
  microsoft:  CheckResult;
  google:     CheckResult;
  zoom:       CheckResult;
  vercel_kv:  CheckResult;
  checked_at: string;
}

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Error classifier ──────────────────────────────────────────────────────────

function classify(err: unknown): CheckResult {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("is not set") || msg.includes("not configured"))  return "missing_config";
  if (msg.includes("invalid_grant") || msg.includes("token_expired")) return "token_expired";
  if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden")) return "auth_failed";
  if (msg.includes("enotfound") || msg.includes("econnrefused") || msg.includes("fetch failed")) return "unreachable";
  return "error";
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkMicrosoft(): Promise<CheckResult> {
  const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, MICROSOFT_REFRESH_TOKEN } = process.env;
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_TENANT_ID || !MICROSOFT_REFRESH_TOKEN) {
    return "missing_config";
  }

  try {
    // Step 1 — refresh token exchange
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          grant_type:    "refresh_token",
          refresh_token: MICROSOFT_REFRESH_TOKEN,
          scope:         "https://graph.microsoft.com/Calendars.Read offline_access",
        }).toString(),
      }
    );

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      return body.includes("invalid_grant") ? "token_expired" : "auth_failed";
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // Step 2 — lightweight Graph call: fetch the primary calendar metadata
    const calRes = await fetch("https://graph.microsoft.com/v1.0/me/calendar", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    return calRes.ok ? "ok" : "auth_failed";
  } catch (err) {
    return classify(err);
  }
}

async function checkGoogle(): Promise<CheckResult> {
  try {
    // listCalendarEvents with a 1-minute window: makes exactly one API call,
    // returns 0 events, confirms credentials and API reachability.
    const now = new Date();
    await listCalendarEvents(now.toISOString(), new Date(now.getTime() + 60_000).toISOString());
    return "ok";
  } catch (err) {
    // googleapis errors: "invalid_grant" → token_expired; GaxiosError with status → auth_failed
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes("invalid_grant")) return "token_expired";
    return classify(err);
  }
}

async function checkZoom(): Promise<CheckResult> {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) return "missing_config";

  try {
    // Step 1 — Server-to-Server OAuth token
    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!tokenRes.ok) return tokenRes.status === 401 ? "auth_failed" : "error";

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // Step 2 — /users/me confirms the token works and the account is active
    const userRes = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    return userRes.ok ? "ok" : "auth_failed";
  } catch (err) {
    return classify(err);
  }
}

async function checkVercelKV(): Promise<CheckResult> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return "missing_config";
  try {
    // Read a non-existent key — returns null if KV is reachable, throws if not
    await kv.get("health:ping");
    return "ok";
  } catch (err) {
    return classify(err);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [microsoft, google, zoom, vercel_kv] = await Promise.all([
    checkMicrosoft(),
    checkGoogle(),
    checkZoom(),
    checkVercelKV(),
  ]);

  const report: HealthReport = {
    microsoft,
    google,
    zoom,
    vercel_kv,
    checked_at: new Date().toISOString(),
  };

  const allOk = [microsoft, google, zoom, vercel_kv].every((v) => v === "ok");
  return NextResponse.json(report, { status: allOk ? 200 : 503 });
}
