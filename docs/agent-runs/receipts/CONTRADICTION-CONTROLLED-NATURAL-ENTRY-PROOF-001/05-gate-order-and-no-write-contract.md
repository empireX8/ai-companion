# 05 — Gate order and no-write contract

## Gate order

1. Selection (persisted-source construction + semantic + same-session + zero-or-one)
2. Lineage (exact quotes, ownership, session, hashes)
3. Confidence policy (referee continuation + candidate floor 0.5)
4. Persistence plan authorisation (local WeakSet mint)
5. Writer transaction
6. Presentation (read-only; post-write; failures do not rewrite persistence outcome)

## No persistence authority when

- compatible / context shift / temporal / aspiration-versus-behaviour
- ambiguous (>1 Class A)
- REQUEST_MORE_EVIDENCE / ABSTAIN / ROUTE_TO_DIFFERENT_OBJECT_TYPE
- below candidate floor
- invalid lineage / quote / hash / pure cross-session pool
- plan gate failure
- message-resolver exception before write

`writerInvoked` remains false and `$transaction` is not called until every pre-write gate passes.

## Cross-session mapping

- `cross_session` only when `sameSessionCount === 0` and a `cross_session_excluded` rejection exists
- Mixed pools (cross-session + same-session semantic non-match) → ordinary `no_candidate`

## Success semantics

On `created` / `reused`: `gateStoppedAt` is **null**.
