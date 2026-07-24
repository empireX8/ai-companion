import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/components/orvek-v0-canonical/canonical-live-runtime-entry", () => ({
  CanonicalLiveRuntimeEntry: () =>
    React.createElement(
      "div",
      { "data-testid": "canonical-live-runtime-entry" },
      "canonical-live-runtime-entry",
    ),
}));

describe("OrvekWorkbenchShell route allowlist", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  async function renderAt(pathname: string): Promise<string> {
    usePathnameMock.mockReturnValue(pathname);
    const { OrvekWorkbenchShell } = await import(
      "../../components/orvek-workbench/OrvekWorkbenchShell"
    );
    return renderToStaticMarkup(
      <OrvekWorkbenchShell>
        <div data-testid="route-child">route-child</div>
      </OrvekWorkbenchShell>,
    );
  }

  it.each(["/", "/your-map", "/actions", "/timeline", "/explore"])(
    "renders canonical workbench on %s",
    async (pathname) => {
      const html = await renderAt(pathname);

      expect(html).toContain("canonical-live-runtime-entry");
      expect(html).not.toContain("route-child");
    },
  );

  it("renders the real route child for candidate review", async () => {
    const html = await renderAt("/contradictions/candidates");

    expect(html).toContain("route-child");
    expect(html).not.toContain("canonical-live-runtime-entry");
  });

  it.each([
    "/contradictions",
    "/contradictions/contr-1",
    "/contradictions/candidates/contr-1",
    "/journal-chat",
  ])("does not bypass canonical workbench for %s", async (pathname) => {
    const html = await renderAt(pathname);

    expect(html).toContain("canonical-live-runtime-entry");
    expect(html).not.toContain("route-child");
  });
});
