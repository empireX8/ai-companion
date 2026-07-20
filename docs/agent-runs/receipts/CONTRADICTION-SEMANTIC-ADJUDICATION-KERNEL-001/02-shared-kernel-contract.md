# 02 — Shared kernel contract

**Versions**

| Constant | Value |
|----------|-------|
| `KERNEL_CONTRACT_VERSION` | `orvek-intelligence-kernel-v1` |
| First proof object | `ContradictionNode` |

## Reusable concepts

1. Evidence/context input — `KernelEvidenceContext`, `KernelSourceUnit`
2. Source identity and session/message lineage — fields on `KernelSourceUnit`
3. Exact source-text span claims — `ExactEvidenceClaim`
4. Model contract version — `KERNEL_CONTRACT_VERSION`
5. Prompt version — object-specific (contradiction prompt version)
6. Structured model execution — `StructuredModelRunner`
7. Object-specific adjudication output — `KernelAdjudicationResult<TSemantic>`
8. Referee outcome — `ObjectivityRefereeOutcome`
9. Deterministic validation result — `DeterministicValidationResult`
10. Abstention/failure result — outcome kinds + `KernelAbstentionCode`
11. Versioned audit metadata — `KernelAuditMetadata`

## Provider boundary

- Domain types do **not** import OpenAI or any concrete model.
- Production adapter `createAiSdkStructuredModelRunner` accepts an injected model + provider/model ids.
- Uses installed AI SDK 6: `generateText` + `Output.object({ schema })`.
- Automated tests use injected fakes only.
