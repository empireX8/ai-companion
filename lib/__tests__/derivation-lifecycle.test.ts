import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ALLOWED_ARTIFACT_TYPES_BY_SCOPE,
  DerivationError,
  assertAllowedType,
  completeDerivationRun,
  computeMessageSetHash,
  createDerivationArtifact,
  createDerivationRun,
  ensureEvidenceSpan,
  promoteArtifact,
  rejectArtifact,
} from "../derivation-layer";

// ── Mock DB factory ───────────────────────────────────────────────────────────

type RunRow = {
  id: string;
  userId: string;
  scope: string;
  processorVersion: string;
  inputMessageSetHash: string;
  status: string;
  createdAt: Date;
};

type SpanRow = {
  id: string;
  userId: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  contentHash: string;
};

type ArtifactRow = {
  id: string;
  userId: string;
  runId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  confidenceScore: number | null;
};

type PromotionRow = {
  artifactId: string;
  entityType: string;
  entityId: string;
};

let idSeq = 0;
const nextId = () => `id_${++idSeq}`;

function makeMockDb(opts: {
  run?: Partial<RunRow> | null;
  span?: Partial<SpanRow> | null;
  artifact?: Partial<ArtifactRow> | null;
  promotion?: Partial<PromotionRow> | null;
} = {}) {
  const runs: RunRow[] = [];
  const spans: SpanRow[] = [];
  const artifacts: ArtifactRow[] = [];
  const promotions: PromotionRow[] = [];

  // Seed from opts
  if (opts.run) {
    runs.push({ id: "run_1", userId: "u1", scope: "import", processorVersion: "v1", inputMessageSetHash: "hash", status: "created", createdAt: new Date(), ...opts.run });
  }
  if (opts.artifact) {
    artifacts.push({ id: "art_1", userId: "u1", runId: "run_1", type: "reference_candidate", status: "candidate", payload: {}, confidenceScore: null, ...opts.artifact });
  }
  if (opts.promotion) {
    promotions.push({ artifactId: "art_1", entityType: "reference", entityId: "ref_1", ...opts.promotion });
  }

  const db = {
    derivationRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: RunRow = { id: nextId(), userId: data.userId as string, scope: data.scope as string, processorVersion: data.processorVersion as string, inputMessageSetHash: data.inputMessageSetHash as string, status: (data.status as string) ?? "created", createdAt: new Date() };
        runs.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id?: string } }) => {
        return runs.find((r) => r.id === where.id) ?? null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = runs.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("run not found");
        runs[idx] = { ...runs[idx]!, ...data } as RunRow;
        return runs[idx]!;
      },
    },
    evidenceSpan: {
      findUnique: async ({ where }: { where: { messageId_charStart_charEnd_contentHash?: { messageId: string; charStart: number; charEnd: number; contentHash: string } } }) => {
        const key = where.messageId_charStart_charEnd_contentHash;
        if (!key) return null;
        return spans.find(s => s.messageId === key.messageId && s.charStart === key.charStart && s.charEnd === key.charEnd && s.contentHash === key.contentHash) ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: SpanRow = { id: nextId(), userId: data.userId as string, messageId: data.messageId as string, charStart: data.charStart as number, charEnd: data.charEnd as number, contentHash: data.contentHash as string };
        spans.push(row);
        return row;
      },
    },
    derivationArtifact: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: ArtifactRow = { id: nextId(), userId: data.userId as string, runId: data.runId as string, type: data.type as string, status: (data.status as string) ?? "candidate", payload: (data.payload as Record<string, unknown>) ?? {}, confidenceScore: (data.confidenceScore as number | null) ?? null };
        artifacts.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id?: string } }) => {
        return artifacts.find(a => a.id === where.id) ?? null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = artifacts.findIndex(a => a.id === where.id);
        if (idx === -1) throw new Error("artifact not found");
        artifacts[idx] = { ...artifacts[idx]!, ...data } as ArtifactRow;
        return artifacts[idx]!;
      },
    },
    artifactPromotionLink: {
      findUnique: async ({ where }: { where: { entityType_entityId?: { entityType: string; entityId: string } } }) => {
        const key = where.entityType_entityId;
        if (!key) return null;
        return promotions.find(p => p.entityType === key.entityType && p.entityId === key.entityId) ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: PromotionRow = { artifactId: data.artifactId as string, entityType: data.entityType as string, entityId: data.entityId as string };
        promotions.push(row);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => {
      return Promise.all(ops);
    },
    _spans: spans,
    _runs: runs,
    _artifacts: artifacts,
    _promotions: promotions,
  };

  return db as unknown as PrismaClient & {
    _spans: SpanRow[];
    _runs: RunRow[];
    _artifacts: ArtifactRow[];
    _promotions: PromotionRow[];
  };
}

// ── computeMessageSetHash ─────────────────────────────────────────────────────

describe("computeMessageSetHash", () => {
  it("is deterministic regardless of input order", () => {
    const h1 = computeMessageSetHash(["msg_a", "msg_b", "msg_c"]);
    const h2 = computeMessageSetHash(["msg_c", "msg_a", "msg_b"]);
    expect(h1).toBe(h2);
  });

  it("differs for different message sets", () => {
    const h1 = computeMessageSetHash(["msg_a", "msg_b"]);
    const h2 = computeMessageSetHash(["msg_a", "msg_x"]);
    expect(h1).not.toBe(h2);
  });

  it("produces a 64-char hex string (sha256)", () => {
    const h = computeMessageSetHash(["msg_a"]);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── assertAllowedType ─────────────────────────────────────────────────────────

describe("assertAllowedType", () => {
  it("passes for valid import types", () => {
    expect(() => assertAllowedType("import", "reference_candidate")).not.toThrow();
    expect(() => assertAllowedType("import", "contradiction_candidate")).not.toThrow();
    expect(() => assertAllowedType("import", "pattern_signal")).not.toThrow();
  });

  it("throws for import scope with native-only type", () => {
    expect(() => assertAllowedType("import", "drift_event")).toThrow(DerivationError);
    expect(() => assertAllowedType("import", "escalation_event")).toThrow(DerivationError);
  });

  it("passes for native-only types in native scope", () => {
    expect(() => assertAllowedType("native", "drift_event")).not.toThrow();
    expect(() => assertAllowedType("native", "cognitive_load_metric")).not.toThrow();
  });

  it("throws for unknown scope", () => {
    expect(() => assertAllowedType("unknown_scope", "reference_candidate")).toThrow(DerivationError);
  });

  it("throws for unknown type", () => {
    expect(() => assertAllowedType("native", "made_up_type")).toThrow(DerivationError);
  });

  it("ALLOWED_ARTIFACT_TYPES_BY_SCOPE import is a strict subset of native", () => {
    const importTypes = ALLOWED_ARTIFACT_TYPES_BY_SCOPE["import"]!;
    const nativeTypes = ALLOWED_ARTIFACT_TYPES_BY_SCOPE["native"]!;
    for (const t of importTypes) {
      expect(nativeTypes).toContain(t);
    }
  });
});

// ── createDerivationRun ───────────────────────────────────────────────────────

describe("createDerivationRun", () => {
  it("creates a run with computed hash and status=created", async () => {
    const db = makeMockDb();
    const run = await createDerivationRun({ userId: "u1", scope: "import", processorVersion: "v1", messageIds: ["msg_b", "msg_a"] }, db);

    expect(run.status).toBe("created");
    expect(run.scope).toBe("import");
    // hash should be same as sorted
    expect(run.inputMessageSetHash).toBe(computeMessageSetHash(["msg_a", "msg_b"]));
  });
});

// ── completeDerivationRun ─────────────────────────────────────────────────────

describe("completeDerivationRun", () => {
  it("marks run as completed", async () => {
    const db = makeMockDb({ run: { id: "run_1", status: "created" } });
    const updated = await completeDerivationRun("run_1", db);
    expect(updated.status).toBe("completed");
  });

  it("throws if run is already completed", async () => {
    const db = makeMockDb({ run: { id: "run_1", status: "completed" } });
    await expect(completeDerivationRun("run_1", db)).rejects.toThrow(DerivationError);
  });

  it("throws if run does not exist", async () => {
    const db = makeMockDb();
    await expect(completeDerivationRun("nonexistent", db)).rejects.toThrow(DerivationError);
  });
});

// ── ensureEvidenceSpan idempotency ────────────────────────────────────────────

describe("ensureEvidenceSpan", () => {
  const spanArgs = { userId: "u1", messageId: "msg_1", charStart: 0, charEnd: 42, contentHash: "abc123" };

  it("creates a new span on first call", async () => {
    const db = makeMockDb();
    const id = await ensureEvidenceSpan(spanArgs, db);
    expect(id).toBeTruthy();
    expect(db._spans).toHaveLength(1);
  });

  it("is idempotent — returns same id on repeated calls", async () => {
    const db = makeMockDb();
    const id1 = await ensureEvidenceSpan(spanArgs, db);
    const id2 = await ensureEvidenceSpan(spanArgs, db);
    expect(id1).toBe(id2);
    expect(db._spans).toHaveLength(1);
  });

  it("creates distinct spans for different content hashes", async () => {
    const db = makeMockDb();
    const id1 = await ensureEvidenceSpan({ ...spanArgs, contentHash: "hash_a" }, db);
    const id2 = await ensureEvidenceSpan({ ...spanArgs, contentHash: "hash_b" }, db);
    expect(id1).not.toBe(id2);
    expect(db._spans).toHaveLength(2);
  });
});

// ── createDerivationArtifact ──────────────────────────────────────────────────

describe("createDerivationArtifact", () => {
  it("creates an artifact with status=candidate", async () => {
    const db = makeMockDb({ run: { id: "run_1", status: "created", scope: "import" } });
    const artifactId = await createDerivationArtifact({ userId: "u1", runId: "run_1", type: "reference_candidate", payload: { foo: "bar" } }, db);
    expect(artifactId).toBeTruthy();
    expect(db._artifacts[0]!.status).toBe("candidate");
  });

  it("throws when run is completed — cannot add artifacts after completion", async () => {
    const db = makeMockDb({ run: { id: "run_1", status: "completed", scope: "import" } });
    await expect(
      createDerivationArtifact({ userId: "u1", runId: "run_1", type: "reference_candidate", payload: {} }, db)
    ).rejects.toThrow(DerivationError);
  });

  it("throws for type not allowed in scope", async () => {
    const db = makeMockDb({ run: { id: "run_1", status: "created", scope: "import" } });
    await expect(
      createDerivationArtifact({ userId: "u1", runId: "run_1", type: "drift_event", payload: {} }, db)
    ).rejects.toThrow(DerivationError);
  });

  it("throws if run does not exist", async () => {
    const db = makeMockDb();
    await expect(
      createDerivationArtifact({ userId: "u1", runId: "nonexistent", type: "reference_candidate", payload: {} }, db)
    ).rejects.toThrow(DerivationError);
  });
});

// ── promoteArtifact ───────────────────────────────────────────────────────────

describe("promoteArtifact", () => {
  it("transitions artifact to promoted and creates promotion link", async () => {
    const db = makeMockDb({ artifact: { id: "art_1", status: "candidate" } });
    await promoteArtifact({ artifactId: "art_1", entityType: "reference", entityId: "ref_42" }, db);
    expect(db._artifacts[0]!.status).toBe("promoted");
    expect(db._promotions).toHaveLength(1);
    expect(db._promotions[0]!.entityId).toBe("ref_42");
  });

  it("throws if artifact is not a candidate", async () => {
    const db = makeMockDb({ artifact: { id: "art_1", status: "promoted" } });
    await expect(
      promoteArtifact({ artifactId: "art_1", entityType: "reference", entityId: "ref_1" }, db)
    ).rejects.toThrow(DerivationError);
  });

  it("enforces uniqueness — throws if entity already has a promotion link", async () => {
    const db = makeMockDb({
      artifact: { id: "art_1", status: "candidate" },
      promotion: { artifactId: "art_other", entityType: "reference", entityId: "ref_1" },
    });
    await expect(
      promoteArtifact({ artifactId: "art_1", entityType: "reference", entityId: "ref_1" }, db)
    ).rejects.toThrow(DerivationError);
  });

  it("throws if artifact does not exist", async () => {
    const db = makeMockDb();
    await expect(
      promoteArtifact({ artifactId: "nonexistent", entityType: "reference", entityId: "ref_1" }, db)
    ).rejects.toThrow(DerivationError);
  });
});

// ── rejectArtifact ────────────────────────────────────────────────────────────

describe("rejectArtifact", () => {
  it("sets artifact status to rejected", async () => {
    const db = makeMockDb({ artifact: { id: "art_1", status: "candidate" } });
    await rejectArtifact("art_1", db);
    expect(db._artifacts[0]!.status).toBe("rejected");
  });

  it("throws if artifact does not exist", async () => {
    const db = makeMockDb();
    await expect(rejectArtifact("nonexistent", db)).rejects.toThrow(DerivationError);
  });
});
