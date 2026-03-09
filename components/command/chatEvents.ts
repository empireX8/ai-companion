export const CHAT_EVENTS = {
  NEW_SESSION: "chat:new-session",
  FOCUS_COMPOSER: "chat:focus-composer",
  TOGGLE_MEMORY: "chat:toggle-memory",
  TOGGLE_SESSIONS: "chat:toggle-sessions",
  TOGGLE_CONTEXT: "chat:toggle-context",
} as const;

export type ChatEventName = (typeof CHAT_EVENTS)[keyof typeof CHAT_EVENTS];

export function dispatchChatEvent(name: ChatEventName): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(name));
  }
}
