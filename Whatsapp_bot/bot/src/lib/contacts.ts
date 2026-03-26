/**
 * Contacts store — persists display-name → phone number mappings in Vercel KV.
 *
 * Key schema:
 *   contacts:{chatId}   →  Record<string, Contact>   (phone → Contact)
 *   contacts:global     →  Record<string, Contact>   (phone → Contact, merged across all chats)
 */

import { kv } from "@vercel/kv";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Contact {
  phone: string;          // WhatsApp phone number (no +)
  name: string;           // Display name from Baileys push name
  preferredName?: string; // Name explicitly set by the contact themselves
  lastSeen: string;       // ISO timestamp
  chatIds: string[];      // All group/chat IDs this contact was seen in
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function chatKey(chatId: string): string {
  return `contacts:${chatId}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a sender in the contacts store.
 * Called every time we receive an incoming message.
 */
export async function upsertContact(
  phone: string,
  name: string,
  chatId: string
): Promise<void> {
  const key = chatKey(chatId);

  const existing = await kv.hget<Contact>(key, phone);

  const updated: Contact = {
    phone,
    name: name || existing?.name || phone,
    preferredName: existing?.preferredName, // never overwrite a self-set name
    lastSeen: new Date().toISOString(),
    chatIds: Array.from(new Set([...(existing?.chatIds ?? []), chatId])),
  };

  await kv.hset(key, { [phone]: updated });

  // Also write to global index
  const globalExisting = await kv.hget<Contact>("contacts:global", phone);
  const globalUpdated: Contact = {
    ...updated,
    chatIds: Array.from(
      new Set([...(globalExisting?.chatIds ?? []), chatId])
    ),
  };
  await kv.hset("contacts:global", { [phone]: globalUpdated });
}

/**
 * Get all contacts for a specific chat/group.
 */
export async function getContactsForChat(
  chatId: string
): Promise<Contact[]> {
  const map = await kv.hgetall<Record<string, Contact>>(chatKey(chatId));
  if (!map) return [];
  return Object.values(map);
}

/**
 * Resolve a list of display names to phone numbers.
 * Searches the global contacts index using case-insensitive name matching.
 * Returns an array of phone numbers for names that could be resolved.
 */
export async function resolveNamesToPhones(
  names: string[]
): Promise<{ name: string; phone: string | null }[]> {
  const allContacts = await kv.hgetall<Record<string, Contact>>("contacts:global");
  const contactList: Contact[] = allContacts ? Object.values(allContacts) : [];

  return names.map((name) => {
    const lower = name.toLowerCase().trim();
    const match = contactList.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        lower.includes(c.name.toLowerCase())
    );
    return { name, phone: match?.phone ?? null };
  });
}

/**
 * Look up a contact by phone number (global index).
 */
export async function getContactByPhone(
  phone: string
): Promise<Contact | null> {
  return kv.hget<Contact>("contacts:global", phone);
}

/**
 * Set a contact's preferred display name (self-assigned, never overwritten by push name).
 * Updates both the global index and all per-chat keys for this contact.
 */
export async function setPreferredName(phone: string, preferredName: string): Promise<void> {
  const existing = await kv.hget<Contact>("contacts:global", phone);
  if (!existing) return; // unknown contact — ignore

  const updated: Contact = { ...existing, preferredName };
  await kv.hset("contacts:global", { [phone]: updated });

  // Propagate to all per-chat keys so name resolution stays consistent
  for (const chatId of existing.chatIds) {
    const chatContact = await kv.hget<Contact>(chatKey(chatId), phone);
    if (chatContact) {
      await kv.hset(chatKey(chatId), { [phone]: { ...chatContact, preferredName } });
    }
  }
}

/**
 * Returns preferredName if set, otherwise falls back to push name.
 */
export function displayName(contact: Contact): string {
  return contact.preferredName ?? contact.name;
}
