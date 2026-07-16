import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthState = { userId: string | null };
type MiddlewareAuth = (() => Promise<AuthState>) & {
  protect: ReturnType<typeof vi.fn>;
};

const createRouteMatcherMock = vi.fn(
  (patterns: string[]) => (request: { nextUrl: { pathname: string } }) => {
    const pathname = request.nextUrl.pathname;
    return patterns.some((pattern) => {
      if (pattern === "/sign-in(.*)") return pathname.startsWith("/sign-in");
      if (pattern === "/sign-up(.*)") return pathname.startsWith("/sign-up");
      return pathname === pattern;
    });
  }
);

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher: createRouteMatcherMock,
}));

function makeAuth(userId: string | null): MiddlewareAuth {
  const auth = vi.fn(async () => ({ userId })) as unknown as MiddlewareAuth;
  auth.protect = vi.fn(async () => undefined);
  return auth;
}

function makeRequest(pathname: string) {
  return { nextUrl: { pathname } };
}

describe("middleware authenticated legacy surface access", () => {
  beforeEach(() => {
    vi.resetModules();
    createRouteMatcherMock.mockClear();
  });

  it("allows authenticated active-questions routes through the quarantine", async () => {
    const middleware = (await import("../../middleware")).default as unknown as (
      auth: MiddlewareAuth,
      request: ReturnType<typeof makeRequest>
    ) => Promise<Response | void>;
    const auth = makeAuth("user-1");

    const response = await middleware(auth, makeRequest("/active-questions/inv-1"));

    expect(response).toBeUndefined();
    expect(auth.protect).not.toHaveBeenCalled();
  });

  it("allows authenticated watch-for routes through the quarantine", async () => {
    const middleware = (await import("../../middleware")).default as unknown as (
      auth: MiddlewareAuth,
      request: ReturnType<typeof makeRequest>
    ) => Promise<Response | void>;
    const auth = makeAuth("user-1");

    const response = await middleware(auth, makeRequest("/watch-for/fw-1"));

    expect(response).toBeUndefined();
    expect(auth.protect).not.toHaveBeenCalled();
  });

  it("keeps unauthenticated active-questions routes masked as not found", async () => {
    const middleware = (await import("../../middleware")).default as unknown as (
      auth: MiddlewareAuth,
      request: ReturnType<typeof makeRequest>
    ) => Promise<Response | void>;
    const auth = makeAuth(null);

    const response = await middleware(auth, makeRequest("/active-questions"));

    expect(response?.status).toBe(404);
    expect(auth.protect).not.toHaveBeenCalled();
  });

  it("keeps unrelated blocked legacy routes quarantined even for authenticated users", async () => {
    const middleware = (await import("../../middleware")).default as unknown as (
      auth: MiddlewareAuth,
      request: ReturnType<typeof makeRequest>
    ) => Promise<Response | void>;
    const auth = makeAuth("user-1");

    const response = await middleware(auth, makeRequest("/patterns"));

    expect(response?.status).toBe(404);
    expect(auth.protect).not.toHaveBeenCalled();
  });
});
