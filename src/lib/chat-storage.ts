// Shared helpers for the discover-chat persistence so both the chat
// component and any "exit" point (landing button, language switch, back
// nav) can clear it consistently.

export const CHAT_STORAGE_KEY = "bloom_chat";

// Persisted chats older than this are treated as stale and discarded on
// restore — so coming back after a day always starts fresh, but an
// accidental refresh mid-conversation is preserved.
export const CHAT_STALE_MS = 30 * 60 * 1000; // 30 minutes

export function clearBloomChat(): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
