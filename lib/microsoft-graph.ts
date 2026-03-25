/**
 * Microsoft Graph API client — reads Outlook calendar events.
 * Uses a pre-obtained refresh token (see /api/auth/microsoft).
 */

// ── Types ────────────────────────────────────────────────────────────────────

interface MsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  lastModifiedDateTime: string;
  isCancelled: boolean;
  isAllDay: boolean;
  location?: { displayName?: string };
  bodyPreview?: string;
}

// ── Token management ─────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 10_000) {
    return cachedToken;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const refreshToken = process.env.MICROSOFT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !tenantId || !refreshToken) {
    throw new Error(
      "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, or MICROSOFT_REFRESH_TOKEN is not set"
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/Calendars.Read offline_access",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    throw new Error(`Microsoft token refresh failed ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as MsTokenResponse;
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ── Calendar read ────────────────────────────────────────────────────────────

/**
 * Get the primary Outlook calendar ID.
 */
async function getMainCalendarId(): Promise<string> {
  const token = await getAccessToken();

  const res = await fetch("https://graph.microsoft.com/v1.0/me/calendar", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get main calendar: ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Fetch Outlook calendar events within a date range.
 * @param startIso   ISO 8601 string
 * @param endIso     ISO 8601 string
 */
export async function getOutlookEvents(
  startIso: string,
  endIso: string
): Promise<OutlookEvent[]> {
  const token = await getAccessToken();
  const calendarId = await getMainCalendarId();

  const params = new URLSearchParams({
    startDateTime: startIso,
    endDateTime: endIso,
    $select: "id,subject,start,end,lastModifiedDateTime,isCancelled,isAllDay,location,bodyPreview",
    $top: "250",
    $orderby: "start/dateTime",
  });

  const url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="Asia/Jerusalem"',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list Outlook events: ${await res.text()}`);
  }

  const data = (await res.json()) as { value: OutlookEvent[] };
  return data.value ?? [];
}

/**
 * Exchange an authorization code for tokens during the one-time OAuth flow.
 * Returns the token response including refresh_token.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<MsTokenResponse> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("Microsoft OAuth environment variables are not set");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "https://graph.microsoft.com/Calendars.Read offline_access",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  return (await res.json()) as MsTokenResponse;
}
