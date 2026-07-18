import { describe, expect, it, vi, afterEach } from "vitest";

import {
  isIsolatedWorkbenchPath,
  resolveWorkbenchRoutePath,
  updateWorkbenchHistory,
} from "../orvek-v0/workbench-route-history";

describe("workbench route isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLocation(pathname: string) {
    const url = new URL(`http://localhost:3000${pathname}`);
    const history = {
      state: null as unknown,
      replaceState: vi.fn((_s: unknown, _t: string, next?: string) => {
        if (typeof next === "string") {
          const parsed = new URL(next, url.origin);
          url.pathname = parsed.pathname;
          url.search = parsed.search;
        }
      }),
      pushState: vi.fn((_s: unknown, _t: string, next?: string) => {
        if (typeof next === "string") {
          const parsed = new URL(next, url.origin);
          url.pathname = parsed.pathname;
          url.search = parsed.search;
        }
      }),
    };
    vi.stubGlobal("window", {
      location: {
        get pathname() {
          return url.pathname;
        },
        get search() {
          return url.search;
        },
        get href() {
          return url.toString();
        },
      },
      history,
      dispatchEvent: vi.fn(),
    });
    return { url, history };
  }

  it("treats canonical-live and canonical-reference as isolated paths", () => {
    expect(isIsolatedWorkbenchPath("/dev/orvek-v0-canonical-live")).toBe(true);
    expect(isIsolatedWorkbenchPath("/dev/orvek-v0-canonical-reference")).toBe(true);
    expect(isIsolatedWorkbenchPath("/")).toBe(false);
    expect(isIsolatedWorkbenchPath("/your-map")).toBe(false);
  });

  it("does not push production pathnames while on canonical-live", () => {
    const { url, history } = stubLocation("/dev/orvek-v0-canonical-live");
    updateWorkbenchHistory("/");
    updateWorkbenchHistory("/your-map?selected=x");
    updateWorkbenchHistory("/actions");
    updateWorkbenchHistory("/explore");
    expect(url.pathname).toBe("/dev/orvek-v0-canonical-live");
    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(resolveWorkbenchRoutePath("map")).toBe("/dev/orvek-v0-canonical-live");
  });

  it("still resolves production paths on root", () => {
    stubLocation("/");
    expect(resolveWorkbenchRoutePath("today")).toBe("/");
    expect(resolveWorkbenchRoutePath("map")).toBe("/your-map");
    expect(resolveWorkbenchRoutePath("decisions")).toBe("/actions");
  });
});
