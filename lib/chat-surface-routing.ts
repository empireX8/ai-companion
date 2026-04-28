export type SessionSurfaceType = "journal_chat" | "explore_chat";

export type ChatSurfaceSwitcherItem = {
  label: "Journal Chat" | "Explore";
  href: string;
  surfaceType: SessionSurfaceType;
  isActive: boolean;
};

export const CHAT_SURFACE_SEARCH_PARAM = "surface";
export const DEFAULT_CHAT_SURFACE_TYPE: SessionSurfaceType = "explore_chat";

export function isSessionSurfaceType(
  value: string | null | undefined
): value is SessionSurfaceType {
  return value === "journal_chat" || value === "explore_chat";
}

export function resolveSessionSurfaceType(
  value: string | null | undefined
): SessionSurfaceType {
  if (!isSessionSurfaceType(value)) {
    return DEFAULT_CHAT_SURFACE_TYPE;
  }
  return value;
}

export function buildChatRouteHref(surfaceType: SessionSurfaceType): string {
  return `/chat?${CHAT_SURFACE_SEARCH_PARAM}=${surfaceType}`;
}

export function buildAppSessionListUrl(
  surfaceType: SessionSurfaceType | null
): string {
  if (!surfaceType) {
    return "/api/session/list?origin=app";
  }

  return `/api/session/list?origin=app&surfaceType=${surfaceType}`;
}

export function buildAppSessionCreateRequestInit(
  surfaceType: SessionSurfaceType | null
): RequestInit {
  if (!surfaceType) {
    return { method: "POST" };
  }

  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surfaceType }),
  };
}

export function buildChatSurfaceSwitcherItems(
  surfaceType: SessionSurfaceType | null,
  mode: "chat-query" | "route-aliases" = "route-aliases"
): ChatSurfaceSwitcherItem[] {
  if (!surfaceType) {
    return [];
  }

  const journalHref =
    mode === "chat-query" ? buildChatRouteHref("journal_chat") : "/journal-chat";
  const exploreHref =
    mode === "chat-query" ? buildChatRouteHref("explore_chat") : "/explore";

  return [
    {
      label: "Journal Chat",
      href: journalHref,
      surfaceType: "journal_chat",
      isActive: surfaceType === "journal_chat",
    },
    {
      label: "Explore",
      href: exploreHref,
      surfaceType: "explore_chat",
      isActive: surfaceType === "explore_chat",
    },
  ];
}
