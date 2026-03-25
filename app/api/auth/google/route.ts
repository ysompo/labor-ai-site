/**
 * Google OAuth one-time setup flow.
 *
 * GET /api/auth/google          — redirects to Google consent screen
 * GET /api/auth/google/callback — exchanges code for tokens, displays refresh token
 *
 * After running this once, copy the refresh_token to GOOGLE_REFRESH_TOKEN in .env.local
 * and you never need to run this flow again.
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    "https://labor-ai.org/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── Initiate flow ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(req.url);

  // Handle callback at /api/auth/google/callback
  if (pathname.endsWith("/callback")) {
    return handleCallback(req);
  }

  // Otherwise, redirect to Google consent screen
  try {
    const auth = getOAuth2Client();
    const url = auth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",   // Force refresh_token to be returned
      scope: SCOPES,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Configuration error: ${message}`, { status: 500 });
  }
}

// ── Handle callback ──────────────────────────────────────────────────────────

async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body><h2>OAuth Error</h2><pre>${error}</pre></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new NextResponse("Missing authorization code", { status: 400 });
  }

  try {
    const auth = getOAuth2Client();
    const { tokens } = await auth.getToken(code);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Google OAuth — Refresh Token</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 700px; margin: 60px auto; padding: 0 20px; }
    code { background: #f4f4f4; padding: 12px 16px; display: block; border-radius: 6px; word-break: break-all; font-size: 13px; }
    .label { font-weight: 600; margin-top: 24px; }
    .warn { color: #b00; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Google OAuth Setup — Complete</h1>
  <p class="label">Refresh Token (copy this into <code>.env.local</code> as GOOGLE_REFRESH_TOKEN):</p>
  <code>${tokens.refresh_token ?? "⚠️ No refresh token returned — make sure prompt=consent was set"}</code>
  <p class="label">Access Token (expires in ~1 hour, no need to save):</p>
  <code>${tokens.access_token}</code>
  <p class="warn">Keep your refresh token secret — treat it like a password.</p>
  <p>You can now close this page and delete <code>/api/auth/google</code> route if desired.</p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html><body><h2>Token exchange failed</h2><pre>${message}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
