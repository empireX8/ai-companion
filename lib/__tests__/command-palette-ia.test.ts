import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("command palette IA", () => {
  it("groups primary workbench routes ahead of legacy support", () => {
    const source = readSource("components/command/CommandPalette.tsx");

    expect(source).toContain("V1_PRIMARY_ROUTES");
    expect(source).toContain("V1_LAYER_ROUTES");
    expect(source).toContain("V1_LEGACY_SUPPORT_ROUTES");
    expect(source).toContain('primary: "Workbench"');
    expect(source).toContain('legacy: "Legacy & support"');
    expect(source).not.toContain("V1_CORE_ROUTES");
  });

  it("does not list Chat in the primary workbench group", () => {
    const source = readSource("components/command/CommandPalette.tsx");
    const primaryBlock = source.slice(
      source.indexOf("V1_PRIMARY_ROUTES.map"),
      source.indexOf("VISIBLE_LAYER_ROUTES.map")
    );
    expect(primaryBlock).not.toContain("Chat");
  });
});
