/**
 * Microsoft OAuth one-time setup flow.
 *
 * GET /api/auth/microsoft          — redirects to Microsoft consent screen
 * GET /api/auth/microsoft/callback — exchanges code for tokens, displays refresh token
 *
 * After running this once, copy the refresh_token to MICROSOFT_REFRESH_TOKEN in .env.local
 * and you never need to run this flow again.
 *
 * Required Azure app settings:
 *   - Redirect URI: https://labor-ai.org/api/auth/microsoft/callback
 *   - Permissions: Calendars.Read, offline_access
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/microsoft-graph";

const SCOPES = "https://graph.microsoft.com/Calendars.Read offline_access";

function getAuthUrl(redirectUri: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  if (!clientId || !tenantId) {
    throw new Error("MICROSOFT_CLIENT_ID or MICROSOFT_TENANT_ID is not set");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES,
    prompt: "consent",
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ??
    "https://labor-ai.org/api/auth/microsoft/callback";

  // Handle callback
  if (url.pathname.endsWith("/callback")) {
    return handleCallback(req, redirectUri);
  }

  // Initiate flow
  try {
    const authUrl = getAuthUrl(redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Configuration error: ${message}`, { status: 500 });
  }
}

// ── Callback handler ─────────────────────────────────────────────────────────

async function handleCallback(
  req: NextRequest,
  redirectUri: string
): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return new NextResponse(
      `<html><body><h2>OAuth Error</h2><p>${error}</p><pre>${errorDescription}</pre></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new NextResponse("Missing authorization code", { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Microsoft OAuth — Refresh Token</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 700px; margin: 60px auto; padding: 0 20px; }
    code { background: #f4f4f4; padding: 12px 16px; display: block; border-radius: 6px; word-break: break-all; font-size: 13px; }
    .label { font-weight: 600; margin-top: 24px; }
    .warn { color: #b00; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Microsoft OAuth Setup — Complete</h1>
  <p class="label">Refresh Token (copy this into <code>.env.local</code> as MICROSOFT_REFRESH_TOKEN):</p>
  <code>${tokens.refresh_token ?? "⚠️ No refresh token returned — make sure offline_access scope was requested"}</code>
  <p class="label">Access Token (expires in ~1 hour, no need to save):</p>
  <code>${tokens.access_token}</code>
  <p class="warn">Keep your refresh token secret — treat it like a password.</p>
  <p>You can now close this page and delete <code>/api/auth/microsoft</code> route if desired.</p>
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
