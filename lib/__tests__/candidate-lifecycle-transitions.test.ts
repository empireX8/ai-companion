/**
 * candidate-lifecycle-transitions.test.ts
 *
 * Phase 2K — Focused unit tests for CandidateLifecycleStatus transition rules.
 *
 * Tests cover:
 * - All allowed transitions
 * - All forbidden transitions
 * - Null semantics (null means legacy/pre-lifecycle)
 * - Terminal state detection
 * - Dead-end state detection
 * - getAllowedNextStatuses
 * - transitionOrThrow error handling
 */

import { CandidateLifecycleStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  canTransition,
  getAllowedNextStatuses,
  isDeadEndStatus,
  isTerminalStatus,
  transitionOrThrow,
} from "../candidate-lifecycle-transitions";

describe("canTransition", () => {
  // ── Allowed transitions ──────────────────────────────────────────

  it("allows proposed → held_for_more_evidence", () => {
    const result = canTransition(
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.held_for_more_evidence
    );
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.nextStatus).toBe(CandidateLifecycleStatus.held_for_more_evidence);
    }
  });

  it("allows proposed → rejected", () => {
    const result = canTransition(
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.rejected
    );
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.nextStatus).toBe(CandidateLifecycleStatus.rejected);
    }
  });

  it("allows proposed → expired", () => {
    const result = canTransition(
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.expired
    );
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.nextStatus).toBe(CandidateLifecycleStatus.expired);
    }
  });

  it("allows held_for_more_evidence → proposed", () => {
    const result = canTransition(
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.proposed
    );
    expect(result.allowed).toBe(true);
  });

  it("allows held_for_more_evidence → rejected", () => {
    const result = canTransition(
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.rejected
    );
    expect(result.allowed).toBe(true);
  });

  it("allows held_for_more_evidence → expired", () => {
    const result = canTransition(
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.expired
    );
    expect(result.allowed).toBe(true);
  });

  it("allows held_for_more_evidence → promoted", () => {
    const result = canTransition(
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.promoted
    );
    expect(result.allowed).toBe(true);
  });

  it("allows rejected → proposed (new candidate cycle)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.rejected,
      CandidateLifecycleStatus.proposed
    );
    expect(result.allowed).toBe(true);
  });

  it("allows promoted → superseded", () => {
    const result = canTransition(
      CandidateLifecycleStatus.promoted,
      CandidateLifecycleStatus.superseded
    );
    expect(result.allowed).toBe(true);
  });

  it("allows expired → proposed (new candidate cycle)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.expired,
      CandidateLifecycleStatus.proposed
    );
    expect(result.allowed).toBe(true);
  });

  // ── Forbidden transitions ────────────────────────────────────────

  it("forbids null → any status", () => {
    const result = canTransition(null, CandidateLifecycleStatus.proposed);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("null");
    }
  });

  it("forbids promoted → proposed (can't un-promote)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.promoted,
      CandidateLifecycleStatus.proposed
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids promoted → rejected", () => {
    const result = canTransition(
      CandidateLifecycleStatus.promoted,
      CandidateLifecycleStatus.rejected
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids promoted → expired", () => {
    const result = canTransition(
      CandidateLifecycleStatus.promoted,
      CandidateLifecycleStatus.expired
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids promoted → held_for_more_evidence", () => {
    const result = canTransition(
      CandidateLifecycleStatus.promoted,
      CandidateLifecycleStatus.held_for_more_evidence
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids superseded → any status (terminal)", () => {
    const allStatuses = Object.values(CandidateLifecycleStatus);
    for (const to of allStatuses) {
      const result = canTransition(CandidateLifecycleStatus.superseded, to);
      expect(result.allowed).toBe(false);
    }
  });

  it("forbids rejected → held_for_more_evidence", () => {
    const result = canTransition(
      CandidateLifecycleStatus.rejected,
      CandidateLifecycleStatus.held_for_more_evidence
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids rejected → promoted", () => {
    const result = canTransition(
      CandidateLifecycleStatus.rejected,
      CandidateLifecycleStatus.promoted
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids rejected → expired", () => {
    const result = canTransition(
      CandidateLifecycleStatus.rejected,
      CandidateLifecycleStatus.expired
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids expired → held_for_more_evidence", () => {
    const result = canTransition(
      CandidateLifecycleStatus.expired,
      CandidateLifecycleStatus.held_for_more_evidence
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids expired → promoted", () => {
    const result = canTransition(
      CandidateLifecycleStatus.expired,
      CandidateLifecycleStatus.promoted
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids expired → rejected", () => {
    const result = canTransition(
      CandidateLifecycleStatus.expired,
      CandidateLifecycleStatus.rejected
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids proposed → promoted (must go through held_for_more_evidence)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.promoted
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids proposed → superseded (must go through promoted)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.superseded
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids held_for_more_evidence → superseded (must go through promoted)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.superseded
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids proposed → proposed (self-transition)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.proposed
    );
    expect(result.allowed).toBe(false);
  });

  it("forbids promoted → promoted (self-transition)", () => {
    const result = canTransition(
      CandidateLifecycleStatus.promoted,
      CandidateLifecycleStatus.promoted
    );
    expect(result.allowed).toBe(false);
  });
});

describe("transitionOrThrow", () => {
  it("returns next status for allowed transitions", () => {
    const result = transitionOrThrow(
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.rejected
    );
    expect(result).toBe(CandidateLifecycleStatus.rejected);
  });

  it("throws for forbidden transitions", () => {
    expect(() =>
      transitionOrThrow(
        CandidateLifecycleStatus.promoted,
        CandidateLifecycleStatus.proposed
      )
    ).toThrow("not allowed");
  });

  it("throws for null transitions", () => {
    expect(() =>
      transitionOrThrow(null, CandidateLifecycleStatus.proposed)
    ).toThrow("null");
  });
});

describe("getAllowedNextStatuses", () => {
  it("returns 3 options for proposed", () => {
    const next = getAllowedNextStatuses(CandidateLifecycleStatus.proposed);
    expect(next.size).toBe(3);
    expect(next.has(CandidateLifecycleStatus.held_for_more_evidence)).toBe(true);
    expect(next.has(CandidateLifecycleStatus.rejected)).toBe(true);
    expect(next.has(CandidateLifecycleStatus.expired)).toBe(true);
  });

  it("returns 4 options for held_for_more_evidence", () => {
    const next = getAllowedNextStatuses(
      CandidateLifecycleStatus.held_for_more_evidence
    );
    expect(next.size).toBe(4);
    expect(next.has(CandidateLifecycleStatus.proposed)).toBe(true);
    expect(next.has(CandidateLifecycleStatus.rejected)).toBe(true);
    expect(next.has(CandidateLifecycleStatus.expired)).toBe(true);
    expect(next.has(CandidateLifecycleStatus.promoted)).toBe(true);
  });

  it("returns 1 option for rejected (proposed)", () => {
    const next = getAllowedNextStatuses(CandidateLifecycleStatus.rejected);
    expect(next.size).toBe(1);
    expect(next.has(CandidateLifecycleStatus.proposed)).toBe(true);
  });

  it("returns 1 option for promoted (superseded)", () => {
    const next = getAllowedNextStatuses(CandidateLifecycleStatus.promoted);
    expect(next.size).toBe(1);
    expect(next.has(CandidateLifecycleStatus.superseded)).toBe(true);
  });

  it("returns 0 options for superseded (terminal)", () => {
    const next = getAllowedNextStatuses(CandidateLifecycleStatus.superseded);
    expect(next.size).toBe(0);
  });

  it("returns 1 option for expired (proposed)", () => {
    const next = getAllowedNextStatuses(CandidateLifecycleStatus.expired);
    expect(next.size).toBe(1);
    expect(next.has(CandidateLifecycleStatus.proposed)).toBe(true);
  });

  it("returns empty set for null", () => {
    const next = getAllowedNextStatuses(null);
    expect(next.size).toBe(0);
  });
});

describe("isTerminalStatus", () => {
  it("returns true for superseded", () => {
    expect(isTerminalStatus(CandidateLifecycleStatus.superseded)).toBe(true);
  });

  it("returns false for proposed", () => {
    expect(isTerminalStatus(CandidateLifecycleStatus.proposed)).toBe(false);
  });

  it("returns false for held_for_more_evidence", () => {
    expect(
      isTerminalStatus(CandidateLifecycleStatus.held_for_more_evidence)
    ).toBe(false);
  });

  it("returns false for rejected", () => {
    expect(isTerminalStatus(CandidateLifecycleStatus.rejected)).toBe(false);
  });

  it("returns false for promoted", () => {
    expect(isTerminalStatus(CandidateLifecycleStatus.promoted)).toBe(false);
  });

  it("returns false for expired", () => {
    expect(isTerminalStatus(CandidateLifecycleStatus.expired)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTerminalStatus(null)).toBe(false);
  });
});

describe("isDeadEndStatus", () => {
  it("returns true for rejected", () => {
    expect(isDeadEndStatus(CandidateLifecycleStatus.rejected)).toBe(true);
  });

  it("returns true for expired", () => {
    expect(isDeadEndStatus(CandidateLifecycleStatus.expired)).toBe(true);
  });

  it("returns true for superseded", () => {
    expect(isDeadEndStatus(CandidateLifecycleStatus.superseded)).toBe(true);
  });

  it("returns false for proposed", () => {
    expect(isDeadEndStatus(CandidateLifecycleStatus.proposed)).toBe(false);
  });

  it("returns false for held_for_more_evidence", () => {
    expect(
      isDeadEndStatus(CandidateLifecycleStatus.held_for_more_evidence)
    ).toBe(false);
  });

  it("returns false for promoted", () => {
    expect(isDeadEndStatus(CandidateLifecycleStatus.promoted)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isDeadEndStatus(null)).toBe(false);
  });
});
