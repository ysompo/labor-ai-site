"use strict";
/**
 * Contacts store — persists display-name → phone number mappings in Vercel KV.
 *
 * Key schema:
 *   contacts:{chatId}   →  Record<string, Contact>   (phone → Contact)
 *   contacts:global     →  Record<string, Contact>   (phone → Contact, merged across all chats)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertContact = upsertContact;
exports.getContactsForChat = getContactsForChat;
exports.resolveNamesToPhones = resolveNamesToPhones;
exports.getContactByPhone = getContactByPhone;
const kv_1 = require("@vercel/kv");
// ── Helpers ──────────────────────────────────────────────────────────────────
function chatKey(chatId) {
    return `contacts:${chatId}`;
}
// ── Public API ───────────────────────────────────────────────────────────────
/**
 * Record a sender in the contacts store.
 * Called every time we receive an incoming message.
 */
async function upsertContact(phone, name, chatId) {
    const key = chatKey(chatId);
    const existing = await kv_1.kv.hget(key, phone);
    const updated = {
        phone,
        name: name || existing?.name || phone,
        lastSeen: new Date().toISOString(),
        chatIds: Array.from(new Set([...(existing?.chatIds ?? []), chatId])),
    };
    await kv_1.kv.hset(key, { [phone]: updated });
    // Also write to global index
    const globalExisting = await kv_1.kv.hget("contacts:global", phone);
    const globalUpdated = {
        ...updated,
        chatIds: Array.from(new Set([...(globalExisting?.chatIds ?? []), chatId])),
    };
    await kv_1.kv.hset("contacts:global", { [phone]: globalUpdated });
}
/**
 * Get all contacts for a specific chat/group.
 */
async function getContactsForChat(chatId) {
    const map = await kv_1.kv.hgetall(chatKey(chatId));
    if (!map)
        return [];
    return Object.values(map);
}
/**
 * Resolve a list of display names to phone numbers.
 * Searches the global contacts index using case-insensitive name matching.
 * Returns an array of phone numbers for names that could be resolved.
 */
async function resolveNamesToPhones(names) {
    const allContacts = await kv_1.kv.hgetall("contacts:global");
    const contactList = allContacts ? Object.values(allContacts) : [];
    return names.map((name) => {
        const lower = name.toLowerCase().trim();
        const match = contactList.find((c) => c.name.toLowerCase().includes(lower) ||
            lower.includes(c.name.toLowerCase()));
        return { name, phone: match?.phone ?? null };
    });
}
/**
 * Look up a contact by phone number (global index).
 */
async function getContactByPhone(phone) {
    return kv_1.kv.hget("contacts:global", phone);
}
//# sourceMappingURL=contacts.js.map