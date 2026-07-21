import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  dualSourceLineageNoticeCopy,
  dualSourceSideUnavailableCopy,
  type ContradictionDualSourcePresentation,
} from "../contradiction-dual-source-presentation-contract";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const completeVerified: ContradictionDualSourcePresentation = {
  lineageState: "complete_verified",
  sideA: {
    side: "A",
    availability: "available",
    spanId: "span-a",
    messageId: "msg-a",
    sessionId: "sess-a",
    sessionOrigin: "APP",
    sessionLabel: "Morning",
    exactQuote: "I keep the routine",
    charStart: 0,
    charEnd: 18,
    integrityVerified: true,
    recordedAt: "2026-07-01T00:00:00.000Z",
  },
  sideB: {
    side: "B",
    availability: "available",
    spanId: "span-b",
    messageId: "msg-b",
    sessionId: "sess-b",
    sessionOrigin: "IMPORTED_ARCHIVE",
    sessionLabel: "Archive",
    exactQuote: "I drop the routine",
    charStart: 0,
    charEnd: 18,
    integrityVerified: true,
    recordedAt: "2026-07-01T00:00:00.000Z",
  },
};

const legacyUnavailable: ContradictionDualSourcePresentation = {
  lineageState: "legacy_unavailable",
  sideA: {
    side: "A",
    availability: "unavailable",
    reason: "legacy_lineage_not_recorded",
    integrityVerified: false,
  },
  sideB: {
    side: "B",
    availability: "unavailable",
    reason: "legacy_lineage_not_recorded",
    integrityVerified: false,
  },
};

describe("CEQR-008/009 dual-source presentation surfaces", () => {
  it("26–27: candidate card separates interpretation from exact source and shows honest legacy copy", () => {
    const page = readSource(
      "app/(root)/(routes)/contradictions/candidates/page.tsx",
    );
    const view = readSource(
      "components/contradiction/ContradictionDualSourceView.tsx",
    );

    expect(page).toContain("includeDualSource=true");
    expect(page).toContain("ContradictionDualSourceView");
    expect(page).toContain('copySurface="candidate"');
    expect(page).toContain("Confirm");
    expect(page).toContain("Dismiss");
    expect(page).toContain('action: "confirm_candidate"');
    expect(page).toContain('method: "DELETE"');

    expect(view).toContain("contradiction-dual-source-presentation-contract");
    expect(view).not.toContain(
      'from "@/lib/contradiction-dual-source-presentation"',
    );
    expect(view).toContain("Side A interpretation");
    expect(view).toContain("Exact source excerpt");
    expect(view).toContain("{sideLabel} source");
    expect(view).toContain("dualSourceLineageNoticeCopy");

    expect(dualSourceLineageNoticeCopy(legacyUnavailable, "candidate")).toBe(
      "Exact source excerpts were not recorded for this legacy candidate.",
    );
    expect(dualSourceLineageNoticeCopy(legacyUnavailable, "generic")).toBe(
      "Exact source excerpts were not recorded for this legacy contradiction.",
    );
    expect(dualSourceLineageNoticeCopy(legacyUnavailable, "generic")).not.toContain(
      "candidate",
    );
  });

  it("28: ContradictionsInspectorPanel renders both ordered sources via shared view", () => {
    const panel = readSource(
      "components/inspector/panels/ContradictionsInspectorPanel.tsx",
    );
    expect(panel).toContain("ContradictionDualSourceView");
    expect(panel).toContain("interpretationA={detail.sideA}");
    expect(panel).toContain("dualSource={detail.dualSource}");
    expect(panel).toContain(
      "contradiction-dual-source-presentation-contract",
    );
    expect(panel).not.toContain('copySurface="candidate"');
  });

  it("29: shared selected-object Inspector renders both ordered sources", () => {
    const panel = readSource(
      "components/inspector/panels/SelectedObjectEvidencePanel.tsx",
    );
    expect(panel).toContain("ContradictionDualSourceView");
    expect(panel).toContain("interpretationA={item.sideA}");
    expect(panel).toContain("dualSource={item.dualSource}");
    expect(panel).toContain("DurableCorrectionControls");
    expect(panel).not.toContain('copySurface="candidate"');
  });

  it("30–31: no interpreted proposition labelled as exact quote; no raw IDs/hashes/reasons in copy helpers", () => {
    const view = readSource(
      "components/contradiction/ContradictionDualSourceView.tsx",
    );
    expect(view).toContain("Exact source excerpt");
    expect(view).toContain("side.exactQuote");
    expect(view).not.toMatch(/Exact source excerpt[\s\S]{0,80}\{interpretation\}/);
    expect(view).not.toContain("spanId");
    expect(view).not.toContain("contentHash");
    expect(view).not.toContain("content_hash_mismatch");
    expect(view).not.toContain("legacy_lineage_not_recorded");

    expect(dualSourceSideUnavailableCopy("content_hash_mismatch")).not.toContain(
      "content_hash_mismatch",
    );
    expect(dualSourceLineageNoticeCopy(completeVerified)).toBeNull();
  });

  it("32: candidate Confirm/Dismiss actions remain unchanged", () => {
    const page = readSource(
      "app/(root)/(routes)/contradictions/candidates/page.tsx",
    );
    expect(page).toContain("handleConfirm");
    expect(page).toContain("handleDismiss");
    expect(page).toContain('JSON.stringify({ action: "confirm_candidate" })');
  });

  it("33: Inspector correction/action behaviour remains unchanged", () => {
    const panel = readSource(
      "components/inspector/panels/SelectedObjectEvidencePanel.tsx",
    );
    expect(panel).toContain("supportsDurableCorrection");
    expect(panel).toContain("DurableCorrectionControls");
    expect(panel).toContain("DurableDecisionOutcomeControls");
  });

  it("shared projection module does not import prismadb or writers", () => {
    const mod = readSource("lib/contradiction-dual-source-presentation.ts");
    expect(mod).not.toContain('from "./prismadb"');
    expect(mod).not.toContain('from "@/lib/prismadb"');
    expect(mod).not.toContain("persistRepairedContradictionCandidate");
    expect(mod).not.toContain("buildContradictionPersistencePlan");
  });

  it("client-safe contract boundary: no crypto/prisma/lineage/writer imports", () => {
    const contract = readSource(
      "lib/contradiction-dual-source-presentation-contract.ts",
    );
    expect(contract).not.toMatch(/from\s+["']node:crypto["']/);
    expect(contract).not.toMatch(
      /from\s+["'][^"']*contradiction-dual-side-lineage["']/,
    );
    expect(contract).not.toMatch(/from\s+["'][^"']*prismadb["']/);
    expect(contract).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(contract).not.toContain("persistRepairedContradictionCandidate");
    expect(contract).not.toContain("buildContradictionPersistencePlan");

    const view = readSource(
      "components/contradiction/ContradictionDualSourceView.tsx",
    );
    const nodesApi = readSource("lib/nodes-api.ts");
    const inspectorApi = readSource("lib/inspector-object-api.ts");
    for (const src of [view, nodesApi, inspectorApi]) {
      expect(src).toContain("contradiction-dual-source-presentation-contract");
      expect(src).not.toMatch(
        /from ["']\.\/contradiction-dual-source-presentation["']/,
      );
      expect(src).not.toMatch(
        /from ["']@\/lib\/contradiction-dual-source-presentation["']/,
      );
    }
  });

  it("detail route does not use first-span-by-message as dual-source authority", () => {
    const detail = readSource("app/api/contradiction/[id]/route.ts");
    expect(detail).toContain("resolveContradictionDualSourcePresentation");
    expect(detail).toContain("sideASourceSpanId");
    expect(detail).toContain(
      "Do not use evidence[].spanId (legacy first-span-by-message heuristic)",
    );
  });
});
