import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  PATTERN_LLM_LF_PROMPT_VERSION,
  normalizePatternLlmLfArtifactPayload,
  parsePatternLlmLfOutput,
  runPatternLlmLfShadowPass,
  selectPatternLlmLfInputUnits,
} from "../pattern-llm-labeling-function";
import { compareLlmLfOutputs } from "../eval/pattern-evaluator";
import type { AdjudicationEntry } from "../eval/eval-types";

type RunRow = {
  id: string;
  status: string;
  scope: string;
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

type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
};

let artifactSeq = 0;
const nextArtifactId = () => `artifact_${++artifactSeq}`;

function makeMockDb(messages: MessageRow[]) {
  const artifacts: ArtifactRow[] = [];
  const runs: RunRow[] = [{ id: "run_1", status: "running", scope: "native" }];

  const db = {
    derivationRun: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        runs.find((run) => run.id === where.id) ?? null,
    },
    derivationArtifact: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: ArtifactRow = {
          id: nextArtifactId(),
          userId: data.userId as string,
          runId: data.runId as string,
          type: data.type as string,
          status: (data.status as string) ?? "candidate",
          payload: (data.payload as Record<string, unknown>) ?? {},
          confidenceScore: (data.confidenceScore as number | null) ?? null,
        };
        artifacts.push(row);
        return row;
      },
    },
    message: {
      findMany: async () => messages,
    },
    _artifacts: artifacts,
  };

  return db as unknown as PrismaClient & { _artifacts: ArtifactRow[] };
}

function makeMessage(content: string, overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: "msg_1",
    sessionId: "sess_1",
    role: "user",
    content,
    createdAt: new Date("2026-03-16T10:00:00.000Z"),
    ...overrides,
  };
}

function makeEntry(overrides: Partial<AdjudicationEntry> = {}): AdjudicationEntry {
  return {
    id: "entry_1",
    text: "I always start appeasing people when they seem upset with me.",
    source: "live_user",
    behavioral_label: "behavioral",
    family_label: "trigger_condition",
    quote_label: "suitable",
    should_abstain: false,
    ...overrides,
  };
}

describe("selectPatternLlmLfInputUnits", () => {
  it("keeps bounded behavioral user messages only", () => {
    const inputs = selectPatternLlmLfInputUnits([
      makeMessage("I always shut down when conflict starts."),
      makeMessage("Can you explain triggers?", { id: "msg_2" }),
      makeMessage("Thanks for helping", { id: "msg_3", role: "assistant" }),
    ]);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.inputUnitId).toBe("msg_1");
  });
});

describe("parsePatternLlmLfOutput", () => {
  it("normalizes parsed abstain output without forcing a family label", () => {
    const input = selectPatternLlmLfInputUnits([
      makeMessage("I keep doubting myself before every decision."),
    ])[0]!;

    const parsed = parsePatternLlmLfOutput({
      rawOutput:
        '{"label":"abstain","abstain":true,"confidence":0.42,"rationale":"Too ambiguous for a safe family label."}',
      modelId: "gpt-4o-mini",
      input,
    });

    expect(parsed.label).toBe("abstain");
    expect(parsed.abstain).toBe(true);
    expect(parsed.parseStatus).toBe("parsed");
  });
});

describe("runPatternLlmLfShadowPass", () => {
  it("stores parsed structured output with audit fields", async () => {
    const db = makeMockDb([
      makeMessage("I always start people-pleasing when people are disappointed in me."),
    ]);

    await runPatternLlmLfShadowPass({
      userId: "u1",
      runId: "run_1",
      messageIds: ["msg_1"],
      db,
      invoker: async () => ({
        rawOutput:
          '{"label":"trigger_condition","abstain":false,"confidence":0.84,"rationale":"The message describes a first-person trigger and appeasing response."}',
      }),
    });

    const payload = db._artifacts[0]?.payload;
    expect(payload).toMatchObject({
      kind: "pattern_llm_labeling_function",
      promptVersion: PATTERN_LLM_LF_PROMPT_VERSION,
      modelId: "gpt-4o-mini",
      inputUnitId: "msg_1",
      label: "trigger_condition",
      rationale: "The message describes a first-person trigger and appeasing response.",
      confidence: 0.84,
      abstain: false,
      parseStatus: "parsed",
      shadowMode: true,
      usedForProductDecision: false,
    });

    const normalized = normalizePatternLlmLfArtifactPayload(payload);
    expect(normalized).toMatchObject({
      entryId: "msg_1",
      label: "trigger_condition",
      parseStatus: "parsed",
      shadowMode: true,
      usedForProductDecision: false,
    });
  });

  it("rejects malformed output safely and stores parse failure", async () => {
    const db = makeMockDb([
      makeMessage("I'm useless at following through when anything matters."),
    ]);

    await runPatternLlmLfShadowPass({
      userId: "u1",
      runId: "run_1",
      messageIds: ["msg_1"],
      db,
      invoker: async () => ({ rawOutput: "not-json-at-all" }),
    });

    const payload = db._artifacts[0]?.payload;
    expect(payload).toMatchObject({
      label: "abstain",
      abstain: true,
      parseStatus: "malformed_json",
      usedForProductDecision: false,
    });
  });

  it("preserves explicit abstain output", async () => {
    const db = makeMockDb([
      makeMessage("I doubt myself a lot before I commit, but this is still ambiguous."),
    ]);

    await runPatternLlmLfShadowPass({
      userId: "u1",
      runId: "run_1",
      messageIds: ["msg_1"],
      db,
      invoker: async () => ({
        rawOutput:
          '{"label":"abstain","abstain":true,"confidence":0.31,"rationale":"The message is self-referential but not specific enough for one safe family."}',
      }),
    });

    const payload = db._artifacts[0]?.payload;
    expect(payload).toMatchObject({
      label: "abstain",
      abstain: true,
      parseStatus: "parsed",
    });
  });
});

describe("normalizePatternLlmLfArtifactPayload", () => {
  it("normalizes a stored artifact payload into comparison input", () => {
    const normalized = normalizePatternLlmLfArtifactPayload({
      kind: "pattern_llm_labeling_function",
      lfVersion: "shadow-v1",
      promptVersion: PATTERN_LLM_LF_PROMPT_VERSION,
      modelId: "gpt-4o-mini",
      inputUnitId: "tc-003",
      messageId: "msg_tc_003",
      sessionId: "sess_tc_003",
      label: "trigger_condition",
      rationale: "Repeated trigger-response framing.",
      confidence: 0.8,
      abstain: false,
      parseStatus: "parsed",
      parseError: null,
      rawOutput: "{\"label\":\"trigger_condition\"}",
      heuristicVotes: { trigger_condition: true, inner_critic: false },
      createdAt: new Date().toISOString(),
      shadowMode: true,
      usedForProductDecision: false,
    });

    expect(normalized).toMatchObject({
      entryId: "tc-003",
      label: "trigger_condition",
      shadowMode: true,
      usedForProductDecision: false,
    });
  });

  it("rejects malformed stored payloads safely", () => {
    expect(
      normalizePatternLlmLfArtifactPayload({
        kind: "pattern_llm_labeling_function",
        inputUnitId: "tc-003",
      })
    ).toBeNull();
  });
});

describe("compareLlmLfOutputs", () => {
  it("includes side-by-side LLM vs heuristic metrics and inspectable disagreements", () => {
    const report = compareLlmLfOutputs(
      [
        makeEntry(),
        makeEntry({
          id: "entry_2",
          text: "I'm not sure I can do this well, and I always overthink every decision.",
          family_label: "inner_critic",
        }),
      ],
      [
        {
          entryId: "entry_1",
          modelId: "gpt-4o-mini",
          promptVersion: PATTERN_LLM_LF_PROMPT_VERSION,
          label: "trigger_condition",
          rationale: "Clear trigger-response description.",
          confidence: 0.81,
          abstain: false,
          parseStatus: "parsed",
          shadowMode: true,
          usedForProductDecision: false,
        },
        {
          entryId: "entry_2",
          modelId: "gpt-4o-mini",
          promptVersion: PATTERN_LLM_LF_PROMPT_VERSION,
          label: "abstain",
          rationale: "Too uncertain to classify safely.",
          confidence: 0.33,
          abstain: true,
          parseStatus: "parsed",
          shadowMode: true,
          usedForProductDecision: false,
        },
      ]
    );

    expect(report.totalCompared).toBe(2);
    expect(report.familyMetrics.find((metric) => metric.family === "trigger_condition")?.precision).toBe(1);
    expect(report.disagreements).toHaveLength(1);
    expect(report.falsePositiveExamples).toHaveLength(0);
    expect(report.disagreements[0]).toMatchObject({
      entryId: "entry_2",
      heuristicLabel: "inner_critic",
      llmLabel: "abstain",
    });
  });
});
