import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("canonical fixture route Server/Client boundary", () => {
  it("server page renders only the client entry with no provider props", () => {
    const page = readSource("app/dev/orvek-v0-canonical-reference/page.tsx");

    expect(page).toContain("CanonicalFixtureEntry");
    expect(page).toContain(
      'from "@/components/orvek-v0-canonical/canonical-fixture-entry"',
    );
    expect(page).not.toContain("createCanonicalFixtureRuntimeData");
    expect(page).not.toContain("CanonicalWorkbench");
    expect(page).not.toContain("buildCanonicalLiveRuntimeData");
    expect(page).not.toContain("useOrvekHybridWorkbenchDataApi");
    expect(page).not.toContain("from \"lucide-react\"");
    expect(page).not.toMatch(/data=\{/);
    expect(page).not.toMatch(/getObject/);
    expect(page).not.toMatch(/getObjects/);
  });

  it("client entry constructs the fixture provider inside the client graph", () => {
    const entry = readSource(
      "components/orvek-v0-canonical/canonical-fixture-entry.tsx",
    );

    expect(entry).toMatch(/^["']use client["']/m);
    expect(entry).toContain("createCanonicalFixtureRuntimeData");
    expect(entry).toContain("CanonicalWorkbench");
    expect(entry).toContain('data-testid="orvek-v0-canonical-reference-route"');
    expect(entry).not.toContain("buildCanonicalLiveRuntimeData");
  });

  it("fixture provider is a client module that owns Lucide icons and getObject", () => {
    const fixture = readSource("components/orvek-v0-canonical/fixture-provider.ts");

    expect(fixture).toMatch(/^["']use client["']/m);
    expect(fixture).toContain("from \"lucide-react\"");
    expect(fixture).toContain("getObject");
    expect(fixture).toContain("getObjects");
    expect(fixture).toContain("referenceSurface: true");
    expect(fixture).toContain('leadId: "d1"');
    expect(fixture).toContain('reportId: "rep-weekly"');
  });
});
