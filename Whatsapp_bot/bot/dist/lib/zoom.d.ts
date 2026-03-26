/**
 * Zoom REST API client — Server-to-Server OAuth.
 * Fetches a short-lived access token, then creates meetings.
 */
export interface ZoomMeeting {
    id: number;
    topic: string;
    start_time: string;
    duration: number;
    join_url: string;
    start_url: string;
    password: string;
}
export interface CreateMeetingOptions {
    topic: string;
    startTime: string;
    durationMinutes?: number;
    timezone?: string;
}
/**
 * Create a Zoom meeting and return its details including join/start URLs.
 */
export declare function createZoomMeeting(options: CreateMeetingOptions): Promise<ZoomMeeting>;
/**
 * Delete a Zoom meeting by ID (used for cleanup on error).
 */
export declare function deleteZoomMeeting(meetingId: number): Promise<void>;
//# sourceMappingURL=zoom.d.ts.map