# 01 — Provider audit

## Classification after audit

`PASS_PROVIDER_PATH_FOUND`

## StructuredModelRunner

- Interface: `lib/orvek-intelligence-kernel/model-runner.ts`
- Production adapter already present: `createAiSdkStructuredModelRunner`
- Uses installed AI SDK 6 (`generateText` + `Output.object`)
- Domain code remains provider-agnostic; callers inject the model

## Provider packages present

From `package.json`:

- `@ai-sdk/openai`
- `@ai-sdk/react`
- `ai`
- `@langchain/openai`

No `@ai-sdk/anthropic`, DeepSeek, or Z.ai SDK packages are installed.

## Repository-sanctioned OpenAI usage

| Surface | Path |
|---|---|
| Chat message route | `app/api/message/route.ts` → `openai(modelName)` with allowed `gpt-4o-mini` / `gpt-4o` |
| Session title | `app/api/session/title/route.ts` → `openai("gpt-4o-mini")` |
| Pattern LLM labeling | `lib/pattern-llm-labeling-function.ts` → `openai(modelId)` gated by `OPENAI_API_KEY` |
| Eval patterns | `scripts/eval-patterns.ts` → `@ai-sdk/openai`, default `gpt-4o-mini` |
| Env example | `.env.example` documents `OPENAI_API_KEY` only among LLM keys |

## Objectivity Referee

- Interface + fail-closed wrapper: `lib/orvek-intelligence-kernel/objectivity-referee.ts`
- Explicit comment: “No shared AI referee implementation”
- CEQR-010 injects deterministic fakes only

## Environment variables (names only)

| Name | Role |
|---|---|
| `OPENAI_API_KEY` | Required for live OpenAI calls |
| `RUN_LIVE_CONTRADICTION_PROVIDER_PROOF` | Explicit opt-in for this proof (introduced) |
| `CONTRADICTION_LIVE_ADJUDICATOR_MODEL` | Optional override (default `gpt-4o-mini`) |
| `CONTRADICTION_LIVE_REFEREE_MODEL` | Optional override (default `gpt-4o-mini`) |
| `CONTRADICTION_LIVE_PROVIDER_TIMEOUT_MS` | Optional timeout |
| `CONTRADICTION_LIVE_MAX_TOTAL_CALLS` | Optional budget ≤ 8 |

## Credentials (presence only)

- Worktree `.env*` files: absent
- Parent `/Users/user/ai-companion/.env`: `OPENAI_API_KEY` nonempty present
- Process env at audit start: `OPENAI_API_KEY` absent until sourced from parent `.env`

## Timeout / abort / structured output

- `StructuredModelRunnerRequest.abortSignal` supported
- `createAiSdkStructuredModelRunner` maps AbortError → `model_timeout`
- OpenAI structured output requires every schema property in `required` (optional Zod fields must be expressed as required-nullable at the transport boundary)

## Live-script conventions

- Existing pattern: opt-in env flags + `ts-node` scripts (e.g. `eval:patterns`)
- Vitest must not call live providers
