import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const listYourMapPublicEvidenceContinuityMock = vi.fn();

const prismaMock = {
  userMapConclusion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/components/AppShell", () => ({
  PageHeader: () => null,
  SectionLabel: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/orvek-workbench/OrvekMapPage", () => ({
  OrvekMapPage: () =>
    React.createElement(
      "div",
      { "data-testid": "orvek-map-page" },
      "Nothing on your map yet."
    ),
}));

vi.mock("@/components/inspector/InspectorSelectButton", () => ({
  MapDetailInspectorSync: () => null,
  InspectorSelectButton: ({ children }: { children: unknown }) => children,
  InspectorSelectFromHrefButton: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/lib/public-intelligence-safe-slice", async () => {
  const actual = await import("../public-intelligence-safe-slice");
  return actual;
});

vi.mock("@/lib/public-evidence-continuity", () => ({
  listYourMapPublicEvidenceContinuity: listYourMapPublicEvidenceContinuityMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

describe("Phase 3 Your Map page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValue(null);
    listYourMapPublicEvidenceContinuityMock.mockResolvedValue([]);
  });

  it("renders the map workbench for authenticated users", async () => {
    const page = await import("../../app/(root)/(routes)/your-map/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("orvek-map-page");
    expect(html).toContain("Nothing on your map yet.");
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
  });

  it("returns null for unauthenticated users", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const page = await import("../../app/(root)/(routes)/your-map/page");
    const element = await page.default();

    expect(element).toBeNull();
  });

  it("hides detail for missing, unowned, and internal-only records through the same not-found path", async () => {
    const page = await import("../../app/(root)/(routes)/your-map/[id]/page");

    await expect(
      page.default({ params: Promise.resolve({ id: "umc-missing" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      page.default({ params: Promise.resolve({ id: "umc-unowned" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      page.default({ params: Promise.resolve({ id: "umc-internal" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          id: "umc-missing",
          userId: "user-1",
          visibility: "user_visible",
        },
      })
    );
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "umc-unowned",
          userId: "user-1",
          visibility: "user_visible",
        },
      })
    );
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: {
          id: "umc-internal",
          userId: "user-1",
          visibility: "user_visible",
        },
      })
    );
  });

  it("redirects valid permalinks into the v0 map workbench with selection", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-1",
    });

    const page = await import("../../app/(root)/(routes)/your-map/[id]/page");

    await expect(
      page.default({ params: Promise.resolve({ id: "umc-1" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/your-map?selected=umc-1");

    expect(redirectMock).toHaveBeenCalledWith("/your-map?selected=umc-1");
    expect(listYourMapPublicEvidenceContinuityMock).not.toHaveBeenCalled();
  });
});
