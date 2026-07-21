# 05 — Independence level

## Achieved level

`separate_call_same_provider_same_model`

| Dimension | Achieved |
|---|---|
| Separate runner instances | Yes |
| Separate provider calls | Yes |
| Separate prompts/contracts | Yes |
| Referee receives only referee input | Yes |
| No hidden shared call state | Yes |
| Same provider | `openai` |
| Same model id (default run) | `gpt-4o-mini` for both roles |

## Explicit non-claims

- Not “second-model” in the different-identity sense (model ids matched in the successful live run)
- Not different-vendor independence
- Env overrides can raise this to `separate_call_same_provider_different_model` without code change
