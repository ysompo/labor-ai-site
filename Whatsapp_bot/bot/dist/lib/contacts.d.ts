/**
 * Contacts store — persists display-name → phone number mappings in Vercel KV.
 *
 * Key schema:
 *   contacts:{chatId}   →  Record<string, Contact>   (phone → Contact)
 *   contacts:global     →  Record<string, Contact>   (phone → Contact, merged across all chats)
 */
export interface Contact {
    phone: string;
    name: string;
    lastSeen: string;
    chatIds: string[];
}
/**
 * Record a sender in the contacts store.
 * Called every time we receive an incoming message.
 */
export declare function upsertContact(phone: string, name: string, chatId: string): Promise<void>;
/**
 * Get all contacts for a specific chat/group.
 */
export declare function getContactsForChat(chatId: string): Promise<Contact[]>;
/**
 * Resolve a list of display names to phone numbers.
 * Searches the global contacts index using case-insensitive name matching.
 * Returns an array of phone numbers for names that could be resolved.
 */
export declare function resolveNamesToPhones(names: string[]): Promise<{
    name: string;
    phone: string | null;
}[]>;
/**
 * Look up a contact by phone number (global index).
 */
export declare function getContactByPhone(phone: string): Promise<Contact | null>;
//# sourceMappingURL=contacts.d.ts.map