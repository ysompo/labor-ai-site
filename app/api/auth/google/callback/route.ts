import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
    (process.env.GOOGLE_REDIRECT_URI ?? "https://labor-ai.org/api/auth/google/callback").trim()
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
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
  <p class="label">Refresh Token — copy this into Vercel as <strong>GOOGLE_REFRESH_TOKEN</strong>:</p>
  <code>${tokens.refresh_token ?? "⚠️ No refresh token returned — try visiting /api/auth/google again"}</code>
  <p class="warn">Keep your refresh token secret — treat it like a password.</p>
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
