import { describe, expect, it } from "vitest";

import {
  CHAT_SURFACE_SEARCH_PARAM,
  buildAppSessionCreateRequestInit,
  buildAppSessionListUrl,
  buildChatRouteHref,
  buildChatSurfaceSwitcherItems,
  resolveSessionSurfaceType,
} from "../chat-surface-routing";

describe("buildAppSessionListUrl", () => {
  it("returns the legacy APP sessions list url when surfaceType is null", () => {
    expect(buildAppSessionListUrl(null)).toBe("/api/session/list?origin=app");
  });

  it("returns journal_chat filtered list url", () => {
    expect(buildAppSessionListUrl("journal_chat")).toBe(
      "/api/session/list?origin=app&surfaceType=journal_chat"
    );
  });

  it("returns explore_chat filtered list url", () => {
    expect(buildAppSessionListUrl("explore_chat")).toBe(
      "/api/session/list?origin=app&surfaceType=explore_chat"
    );
  });
});

describe("buildAppSessionCreateRequestInit", () => {
  it("returns legacy POST init when surfaceType is null", () => {
    expect(buildAppSessionCreateRequestInit(null)).toEqual({ method: "POST" });
  });

  it("returns POST init with journal_chat body", () => {
    expect(buildAppSessionCreateRequestInit("journal_chat")).toEqual({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surfaceType: "journal_chat" }),
    });
  });

  it("returns POST init with explore_chat body", () => {
    expect(buildAppSessionCreateRequestInit("explore_chat")).toEqual({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surfaceType: "explore_chat" }),
    });
  });
});

describe("buildChatSurfaceSwitcherItems", () => {
  it("returns no switcher items for legacy /chat surface", () => {
    expect(buildChatSurfaceSwitcherItems(null)).toEqual([]);
  });

  it("builds /chat query links in chat-query mode", () => {
    expect(buildChatSurfaceSwitcherItems("journal_chat", "chat-query")).toEqual([
      {
        label: "Journal Chat",
        href: "/chat?surface=journal_chat",
        surfaceType: "journal_chat",
        isActive: true,
      },
      {
        label: "Explore",
        href: "/chat?surface=explore_chat",
        surfaceType: "explore_chat",
        isActive: false,
      },
    ]);
  });

  it("builds alias links in route-aliases mode", () => {
    expect(buildChatSurfaceSwitcherItems("explore_chat", "route-aliases")).toEqual([
      {
        label: "Journal Chat",
        href: "/journal-chat",
        surfaceType: "journal_chat",
        isActive: false,
      },
      {
        label: "Explore",
        href: "/explore",
        surfaceType: "explore_chat",
        isActive: true,
      },
    ]);
  });
});

describe("surface query helpers", () => {
  it("uses surface as the chat query param key", () => {
    expect(CHAT_SURFACE_SEARCH_PARAM).toBe("surface");
  });

  it("builds chat href for journal chat", () => {
    expect(buildChatRouteHref("journal_chat")).toBe(
      "/chat?surface=journal_chat"
    );
  });

  it("builds chat href for explore", () => {
    expect(buildChatRouteHref("explore_chat")).toBe("/chat?surface=explore_chat");
  });

  it("defaults to explore_chat for invalid or missing values", () => {
    expect(resolveSessionSurfaceType(null)).toBe("explore_chat");
    expect(resolveSessionSurfaceType("")).toBe("explore_chat");
    expect(resolveSessionSurfaceType("invalid")).toBe("explore_chat");
  });

  it("resolves valid values as-is", () => {
    expect(resolveSessionSurfaceType("journal_chat")).toBe("journal_chat");
    expect(resolveSessionSurfaceType("explore_chat")).toBe("explore_chat");
  });
});
