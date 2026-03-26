/**
 * Google Calendar API client.
 * Uses the googleapis npm package with a pre-obtained refresh token.
 */
export interface CalendarEvent {
    id?: string;
    summary: string;
    location?: string;
    description?: string;
    startIso: string;
    endIso: string;
    attendeeEmails?: string[];
    extendedProps?: Record<string, string>;
}
export interface GoogleCalendarEvent {
    id: string;
    summary: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
    };
    location?: string;
    extendedProperties?: {
        private?: Record<string, string>;
    };
    updated?: string;
}
/**
 * Create a new event in Google Calendar.
 * Returns the created event ID.
 */
export declare function createCalendarEvent(event: CalendarEvent): Promise<string>;
/**
 * Update an existing Google Calendar event by ID.
 */
export declare function updateCalendarEvent(eventId: string, event: CalendarEvent): Promise<void>;
/**
 * Delete a Google Calendar event by ID.
 */
export declare function deleteCalendarEvent(eventId: string): Promise<void>;
/**
 * List events in a time range.
 */
export declare function listCalendarEvents(timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]>;
/**
 * Find free time slots in the owner's calendar over the next N days.
 * Returns an array of { date, time } objects (Asia/Jerusalem).
 */
export declare function findFreeSlots(daysAhead?: number, slotDurationMinutes?: number, workdayStart?: number, workdayEnd?: number): Promise<{
    date: string;
    time: string;
}[]>;
//# sourceMappingURL=google-calendar.d.ts.map