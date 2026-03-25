/**
 * WhatsApp Cloud API helper — send messages via Meta's REST API.
 * Supports plain text, template messages, and audio download.
 */

const BASE_URL = "https://graph.facebook.com/v19.0";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TextMessage {
  type: "text";
  to: string;
  body: string;
}

export interface TemplateMessage {
  type: "template";
  to: string;
  templateName: string;
  languageCode: string;
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: "body";
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: "text";
  text: string;
}

// ── Core send ────────────────────────────────────────────────────────────────

async function send(payload: Record<string, unknown>): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN is not set");
  }

  const url = `${BASE_URL}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...payload,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${error}`);
  }
}

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * Send a plain text message to a phone number or group chat ID.
 */
export async function sendText(to: string, body: string): Promise<void> {
  await send({
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}

/**
 * Send the `zoom_invite` registered template.
 * Params: [date, time, joinUrl]
 */
export async function sendZoomInviteTemplate(
  to: string,
  date: string,
  time: string,
  joinUrl: string
): Promise<void> {
  await send({
    to,
    type: "template",
    template: {
      name: "zoom_invite",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: date },
            { type: "text", text: time },
            { type: "text", text: joinUrl },
          ],
        },
      ],
    },
  });
}

/**
 * Mark a message as read so the double-tick turns blue.
 */
export async function markAsRead(messageId: string): Promise<void> {
  await send({
    status: "read",
    message_id: messageId,
  });
}

/**
 * Download a media file (e.g. voice note) from Meta's CDN.
 * Returns the raw Buffer.
 */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("WHATSAPP_TOKEN is not set");

  // Step 1: get the download URL
  const metaRes = await fetch(`${BASE_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    throw new Error(`Could not fetch media metadata: ${await metaRes.text()}`);
  }
  const meta = (await metaRes.json()) as { url: string };

  // Step 2: download the actual bytes
  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Could not download media file: ${await fileRes.text()}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Webhook payload types ────────────────────────────────────────────────────

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: IncomingMessage[];
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface IncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "audio" | "image" | "video" | "document" | "sticker" | "reaction" | "unknown";
  text?: { body: string };
  audio?: { id: string; mime_type: string };
  context?: {
    from: string;
    id: string;
    group_id?: string;
  };
  // Group messages include this when sent to a group
  group_id?: string;
}
