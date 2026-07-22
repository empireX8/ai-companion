/**
 * CEQR-013 — receipt / invariant tests for the controlled live diagnostic rerun.
 * Does not invoke the live provider. Reads landed receipt artifacts only.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2,
  CONTRADICTION_LIVE_MAX_RETRIES,
  CONTRADICTION_LIVE_MAX_TOTAL_CALLS,
  CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
} from "../contradiction-live-provider-adapters";

const RECEIPT_DIR = join(
  process.cwd(),
  "docs/agent-runs/receipts/CONTRADICTION-LIVE-DIAGNOSTIC-RERUN-001",
);

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(RECEIPT_DIR, name), "utf8")) as T;
}

type LiveReceipt = {
  ran: boolean;
  providerId: string;
  adjudicatorModelId: string;
  refereeModelId: string;
  maxRetries: number;
  timeoutMs: number;
  adjudicatorPromptAddendumVersion: string;
  adjudicatorCallCount: number;
  refereeCallCount: number;
  totalCallCount: number;
  maxTotalCalls: number;
  evidenceOutputMutated: boolean;
  realAccountMutated: boolean;
  productionIngestionWired: boolean;
  productionReady: boolean;
  unsafeMutationDetected: boolean;
  cases: Array<{
    caseId: string;
    status: string;
    gateStoppedAt: string | null;
    writerInvoked: boolean;
    writeExecuted: boolean;
    adjudicatorCallCount: number;
    refereeCallCount: number;
    sanitizedAdjudicationDiagnostics: {
      earliestGate: string;
      validationErrorCodes: string[];
      failingFieldPaths: string[];
      evidenceFailureSide: string | null;
      exactQuoteMatched: { sideA: boolean | null; sideB: boolean | null };
      offsetsMatched: { sideA: boolean | null; sideB: boolean | null };
    } | null;
  }>;
};

type AccountGate = {
  userId: string;
  matchesExpected: boolean;
  mutationsPerformed: boolean;
  observed: Record<string, unknown>;
};

const REQUIRED_RECEIPTS = [
  "00-intake-and-boundaries.md",
  "01-pre-run-static-audit.md",
  "02-before-account-gate.md",
  "03-live-execution-command.md",
  "04-provider-and-budget-result.md",
  "05-clear-case-diagnostics.md",
  "06-compatible-case-diagnostics.md",
  "07-ambiguous-case-diagnostics.md",
  "08-referee-execution-result.md",
  "09-persistence-and-mutation-result.md",
  "10-after-account-gate.md",
  "11-fact-vs-inference.md",
  "12-root-cause-evidence.md",
  "13-tests-and-validation.md",
  "14-changed-files-list.md",
  "15-result-and-limitations.md",
  "16-next-slice-boundary.md",
  "live-execution-receipt.json",
  "account-gate-before.json",
  "account-gate-after.json",
  "validation-summary.json",
  "changed-files.txt",
] as const;

describe("CEQR-013 live diagnostic rerun receipts", () => {
  it("receipt directory contains all required artifacts", () => {
    expect(existsSync(RECEIPT_DIR)).toBe(true);
    for (const name of REQUIRED_RECEIPTS) {
      expect(existsSync(join(RECEIPT_DIR, name))).toBe(true);
    }
  });

  it("live receipt records exactly one safe diagnostic run shape", () => {
    const receipt = readJson<LiveReceipt>("live-execution-receipt.json");
    expect(receipt.ran).toBe(true);
    expect(receipt.providerId).toBe("openai");
    expect(receipt.maxRetries).toBe(CONTRADICTION_LIVE_MAX_RETRIES);
    expect(receipt.maxRetries).toBe(0);
    expect(receipt.timeoutMs).toBe(CONTRADICTION_LIVE_DEFAULT_TIMEOUT_MS);
    expect(receipt.timeoutMs).toBe(45_000);
    expect(receipt.maxTotalCalls).toBe(CONTRADICTION_LIVE_MAX_TOTAL_CALLS);
    expect(receipt.maxTotalCalls).toBe(8);
    expect(receipt.adjudicatorPromptAddendumVersion).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v1",
    );
    // Historical CEQR-013 receipt retains v1; historical v2 identity retained;
    // current code is CEQR-016 v3.
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v2",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v3",
    );
    expect(receipt.adjudicatorPromptAddendumVersion).not.toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
    );
    expect(receipt.adjudicatorPromptAddendumVersion).not.toBe(
      CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V2,
    );
    expect(receipt.totalCallCount).toBe(
      receipt.adjudicatorCallCount + receipt.refereeCallCount,
    );
    expect(receipt.totalCallCount).toBeLessThanOrEqual(receipt.maxTotalCalls);
    expect(receipt.evidenceOutputMutated).toBe(false);
    expect(receipt.realAccountMutated).toBe(false);
    expect(receipt.unsafeMutationDetected).toBe(false);
    expect(receipt.productionIngestionWired).toBe(false);
    expect(receipt.productionReady).toBe(false);
  });

  it("each synthetic case retains sanitized earliest-gate diagnostics", () => {
    const receipt = readJson<LiveReceipt>("live-execution-receipt.json");
    expect(receipt.cases).toHaveLength(3);
    for (const c of receipt.cases) {
      expect(c.sanitizedAdjudicationDiagnostics).not.toBeNull();
      const d = c.sanitizedAdjudicationDiagnostics!;
      expect(d.earliestGate).toBe("deterministic_validation");
      expect(d.validationErrorCodes.length).toBeGreaterThan(0);
      expect(c.gateStoppedAt).toBe("selection");
      expect(c.writerInvoked).toBe(false);
      expect(c.writeExecuted).toBe(false);
      expect(c.refereeCallCount).toBe(0);
    }

    const byId = Object.fromEntries(
      receipt.cases.map((c) => [c.caseId, c]),
    );
    expect(
      byId.clear_contradiction_candidate.sanitizedAdjudicationDiagnostics!
        .validationErrorCodes,
    ).toEqual(
      expect.arrayContaining([
        "fabricated_quote",
        "clear_contradiction_requires_valid_spans",
      ]),
    );
    expect(
      byId.compatible_contextual.sanitizedAdjudicationDiagnostics!
        .validationErrorCodes,
    ).toEqual(expect.arrayContaining(["fabricated_quote"]));
    expect(
      byId.ambiguous_insufficient.sanitizedAdjudicationDiagnostics!
        .validationErrorCodes,
    ).toEqual(expect.arrayContaining(["source_id_mismatch"]));
  });

  it("unlabelled evidence failures do not invent Side A/B attribution", () => {
    const receipt = readJson<LiveReceipt>("live-execution-receipt.json");
    for (const c of receipt.cases) {
      const side =
        c.sanitizedAdjudicationDiagnostics!.evidenceFailureSide;
      expect(side === "unknown" || side === null).toBe(true);
      expect(side).not.toBe("sideA");
      expect(side).not.toBe("sideB");
    }
  });

  it("account gates match before/after and stay redacted", () => {
    const before = readJson<AccountGate>("account-gate-before.json");
    const after = readJson<AccountGate>("account-gate-after.json");
    expect(before.userId).toBe("[REDACTED_ACCOUNT_ID]");
    expect(after.userId).toBe("[REDACTED_ACCOUNT_ID]");
    expect(before.matchesExpected).toBe(true);
    expect(after.matchesExpected).toBe(true);
    expect(before.mutationsPerformed).toBe(false);
    expect(after.mutationsPerformed).toBe(false);
    expect(after.observed).toEqual(before.observed);
  });

  it("validation-summary encodes diagnostic classification invariants", () => {
    const summary = readJson<Record<string, unknown>>(
      "validation-summary.json",
    );
    expect(summary.campaignSlice).toBe("CEQR-013");
    expect(summary.liveRunCountThisSlice).toBe(1);
    expect(summary.runtimePromptChanged).toBe(false);
    expect(summary.providerOutputMutation).toBe(false);
    expect(summary.databaseMutation).toBe(false);
    expect(summary.refereeLiveExecutionOccurred).toBe(false);
    expect(summary.productionReady).toBe(false);
    expect(summary.optInEnv).toBe(
      CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
    );
    expect(summary.classification).toBe(
      "PASS_LIVE_DIAGNOSTIC_ROOT_CAUSE_OBTAINED",
    );
  });

  it("receipt corpus does not embed secret or account-id shaped values", () => {
    const files = readdirSync(RECEIPT_DIR);
    const secretLike =
      /\b(sk-[A-Za-z0-9_\-]{8,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/;
    const clerkUserLike = /\buser_[A-Za-z0-9]{20,}\b/;
    for (const name of files) {
      const text = readFileSync(join(RECEIPT_DIR, name), "utf8");
      expect(secretLike.test(text)).toBe(false);
      expect(clerkUserLike.test(text)).toBe(false);
      expect(text.includes("OPENAI" + "_API_KEY=")).toBe(false);
    }
  });
});
