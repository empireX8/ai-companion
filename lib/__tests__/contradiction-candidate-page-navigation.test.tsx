import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ContradictionListItem } from "../nodes-api";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/contradiction/ContradictionDualSourceView", () => ({
  ContradictionDualSourceView: () =>
    React.createElement("div", null, "mocked-dual-source-view"),
}));

vi.mock("@/components/command/candidateEvents", () => ({
  dispatchCandidatesUpdated: () => undefined,
}));

const sampleItem: ContradictionListItem = {
  id: "contr-123",
  title: "Candidate contradiction",
  sideA: "Side A interpretation",
  sideB: "Side B interpretation",
  type: "belief",
  status: "candidate",
  weight: 1,
  escalationLevel: 0,
  recommendedRung: null,
  lastEvidenceAt: null,
  lastTouchedAt: "2026-07-24T00:00:00.000Z",
  lastEscalatedAt: null,
  snoozedUntil: null,
  sourceSessionId: "sess-1",
  sessionOrigin: "APP",
};

async function renderLoadedReview(items: ContradictionListItem[] = [sampleItem]) {
  const { CandidateReviewContent } = await import(
    "../../app/(root)/(routes)/contradictions/candidates/page"
  );

  return renderToStaticMarkup(
    <CandidateReviewContent
      items={items}
      loading={false}
      error={null}
      busy={{}}
      isBatchRunning={false}
      onConfirmAll={() => undefined}
      onDismissAll={() => undefined}
      onConfirm={() => undefined}
      onDismiss={() => undefined}
    />,
  );
}

describe("candidate review page navigation quarantine", () => {
  it("renders only the canonical Map back navigation and no quarantined contradiction links", async () => {
    const page = await import("../../app/(root)/(routes)/contradictions/candidates/page");
    const html = await renderLoadedReview();

    expect(html).toContain(`href="${page.CANDIDATE_REVIEW_BACK_HREF}"`);
    expect(html).toContain(page.CANDIDATE_REVIEW_BACK_LABEL);
    expect(html).not.toContain('href="/contradictions"');
    expect(html).not.toMatch(/href="\/contradictions\/[^"]+"/);
    expect(html).not.toContain("All tensions");
    expect(html).toContain("Confirm");
    expect(html).toContain("Dismiss");
  });

  it("keeps the empty state free of quarantined contradiction navigation", async () => {
    const html = await renderLoadedReview([]);

    expect(html).toContain("No candidate tensions.");
    expect(html).not.toContain('href="/contradictions"');
    expect(html).not.toMatch(/href="\/contradictions\/[^"]+"/);
  });

  it("keeps candidate confirm and dismiss requests on the same mutation endpoints", async () => {
    const page = await import("../../app/(root)/(routes)/contradictions/candidates/page");
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await page.confirmCandidate("contr-123", fetchImpl as typeof fetch);
    await page.dismissCandidate("contr-123", fetchImpl as typeof fetch);

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "/api/contradiction/contr-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_candidate" }),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "/api/contradiction/contr-123", {
      method: "DELETE",
    });
  });
});
