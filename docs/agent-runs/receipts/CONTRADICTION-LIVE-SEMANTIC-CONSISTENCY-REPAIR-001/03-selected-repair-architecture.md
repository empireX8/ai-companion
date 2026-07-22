# 03 — Selected repair architecture

## Choice

Classification-discriminated provider transport variants via `z.union`
(`anyOf`), with OpenAI-strict envelope nesting.

## Why

1. Preferred architecture: structural variants, not prompt wording.
2. OpenAI forbids root `anyOf`/`oneOf` → wrap under
   `adjudication` (`CONTRADICTION_OPENAI_STRICT_ENVELOPE_KEY`).
3. Use `z.union` (emits `anyOf`) rather than `discriminatedUnion` (`oneOf`).
4. `clear_contradiction` variant uses `z.literal(false)` on every compatibility
   flag and `abstentionReason: z.null()`.
5. Classified non-clear variants require non-null supported classification and
   `abstentionReason: null`.
6. Abstention variant requires `classification: null` and nonblank
   `abstentionReason` (`/\S/` pattern; the pattern alone rejects empty and
   whitespace-only strings).
7. Live OpenAI wrapper unwraps the envelope; flat injected runners pass through.
8. Deterministic `collectSemanticConsistencyErrors` retained as defence in depth.
9. Domain schema remains flat post-binding (transport/domain separation preserved).

## HOLD check

Not held after Unicode lexical-boundary correction.

Provider-facing schema truly encodes the semantic contract (nested `anyOf` +
`const: false`). Lexical gate is code-point-aware (surrogate-pair fail-closed;
combining-mark attachment policy; astral `\p{L}`/`\p{N}` recognised) while
offsets remain UTF-16 `String.slice` indices.
