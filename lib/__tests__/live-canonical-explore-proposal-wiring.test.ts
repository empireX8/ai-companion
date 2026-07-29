import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isExploreMovementSemanticEnabled,
  isExploreMovementSemanticEnabledForUser,
  resolveExploreMovementProviderConfig,
} from "../explore-movement-live-provider-adapters";
import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../canonical-model-authority-flag";
import { ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED_ENV } from "../explore-movement-live-provider-adapters";
import { EXPLORE_CHAT_SYSTEM_PROMPT_ADDENDUM } from "../assistant/system-prompt";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("live canonical Explore proposal wiring", () => {
  it("enables semantic movement for canonical allowlisted users without the global semantic flag", () => {
    const userId = "user_tea_allowlisted";
    const env = {
      [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
      [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: userId,
      OPENAI_API_KEY: "sk-test",
    };

    expect(isExploreMovementSemanticEnabled(env)).toBe(false);
    expect(isExploreMovementSemanticEnabledForUser(userId, env)).toBe(true);
    expect(isExploreMovementSemanticEnabledForUser("user_other", env)).toBe(false);

    const config = resolveExploreMovementProviderConfig(env, { forceEnabled: true });
    expect(config.ok).toBe(true);
  });

  it("preserves fail-closed behaviour when both gates are off", () => {
    expect(isExploreMovementSemanticEnabledForUser("user_x", {})).toBe(false);
    expect(
      resolveExploreMovementProviderConfig({
        OPENAI_API_KEY: "sk-test",
      }).ok,
    ).toBe(false);
  });

  it("keeps global semantic flag as an independent enablement path", () => {
    const env = {
      [ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED_ENV]: "1",
      OPENAI_API_KEY: "sk-test",
    };
    expect(isExploreMovementSemanticEnabledForUser("any-user", env)).toBe(true);
  });

  it("wires /api/message explore_chat replies through grounding orchestration after persist", () => {
    const route = readSource("app/api/message/route.ts");
    expect(route).toContain("orchestrateExploreReplyGrounding");
    expect(route).toContain("createProposalWhenSufficient: true");
    expect(route).toContain('session.surfaceType === "explore_chat"');
    expect(route).toContain("EXPLORE_CHAT_SYSTEM_PROMPT_ADDENDUM");
    expect(route).toContain("persistAssistantReply");
    expect(route).toContain("await persistAssistantReply(finalText, userMessage.id)");
  });

  it("uses user-aware semantic enablement inside the grounding orchestrator", () => {
    const orchestrator = readSource("lib/explore-grounding-orchestrator.ts");
    expect(orchestrator).toContain("isExploreMovementSemanticEnabledForUser");
    expect(orchestrator).toContain("forceEnabled: true");
    expect(orchestrator).toContain("createOrReuseSemanticExploreMovementProposal");
  });

  it("keeps Explore honesty rules from claiming pre-publication updates", () => {
    expect(EXPLORE_CHAT_SYSTEM_PROMPT_ADDENDUM).toMatch(/Never claim/i);
    expect(EXPLORE_CHAT_SYSTEM_PROMPT_ADDENDUM).toMatch(/proposed model update/i);
    expect(EXPLORE_CHAT_SYSTEM_PROMPT_ADDENDUM).not.toMatch(/silently updated/i);
  });

  it("surfaces proposal review controls on the production canonical Explore page", () => {
    const explore = readSource("components/orvek-v0-canonical/pages/explore.tsx");
    expect(explore).toContain("ExploreMovementProposalCard");
    expect(explore).toContain("exploreLatestGrounding");
    expect(explore).toContain("freeExploreChatSessionId");
  });
});
