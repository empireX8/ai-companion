import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("canonical Today empty action/card identity guard", () => {
  it("keeps permanent slots and disables actions without owned identities", () => {
    const today = readSource("components/orvek-v0-canonical/pages/today.tsx");
    expect(today).not.toContain("if (!lead)");
    expect(today).toContain('data-today-slot="lead-card"');
    expect(today).toContain('data-today-slot="report-card"');
    expect(today).toContain('data-today-item="now-row"');
    expect(today).toContain('data-today-item="movement-card"');
    expect(today).toContain('data-today-item="receipt-row"');
    expect(today).toContain("disabled={!reportAvailable}");
    expect(today).toContain("onClick={reportAvailable ? () => openReport(today.reportId) : undefined}");
    expect(today).toContain("if (!getObject(id))");
  });

  it("live provider refuses heroSelectionId as blank report identity", () => {
    const live = readSource("components/orvek-v0-canonical/live-provider.ts");
    expect(live).toContain("Never fall back to heroSelectionId");
    expect(live).toContain("reportTitle &&");
  });
});
