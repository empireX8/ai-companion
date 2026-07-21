# 02 — Provider decision

## Decision

**Use the repository-sanctioned OpenAI path.**

| Field | Value |
|---|---|
| Provider | `openai` |
| SDK | `@ai-sdk/openai` + `ai` |
| Runner factory | `createAiSdkStructuredModelRunner` |
| Credential | `OPENAI_API_KEY` |
| Default adjudicator model | `gpt-4o-mini` |
| Default referee model | `gpt-4o-mini` |

## Why this is locked (not a free vendor choice)

1. Only OpenAI AI-SDK provider package is installed.
2. Production chat / title / pattern paths already use `@ai-sdk/openai`.
3. Kernel docs name `createAiSdkStructuredModelRunner` as the production adapter.
4. `.env.example` documents `OPENAI_API_KEY` as the LLM credential.

No Anthropic / DeepSeek / Z.ai decision was required or made.

## Independence default

Same provider + same default model identity, **separate runner instances and separate calls**:

`separate_call_same_provider_same_model`

Different model IDs may be selected via env overrides; that upgrades the reported independence level without changing vendor.
