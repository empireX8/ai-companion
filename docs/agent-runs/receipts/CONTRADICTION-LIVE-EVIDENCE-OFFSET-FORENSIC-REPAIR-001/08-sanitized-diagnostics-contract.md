# 08 — Sanitized diagnostics contract

Future failed live receipts can record (sanitized):

- case id; provider/model/schema/prompt identities
- raw startBoundaryIndex / endBoundaryIndex and resolved startOffset / endOffset for A and B
- source length; selected span length
- failing side: A, B, or both
- validation code
- boundary categories before/at start and end (independently derived)
- surrogate-split flags; inside-alphanumeric-word flags (independently derived per endpoint)
- whether exactQuote would equal authoritative slice
- deterministic source-text hash
- raw provider-object SHA-256 fingerprint (runtime-wired from adjudication)
- earliest failed gate
- catalog limit side infos (lengths/hashes/computation mode; never raw oversize text)

Category-B resolve failures retain resolved offsets even though binding fails.
Category-A unresolved indices leave offsets null.

Start and end inside-word / surrogate / category flags are computed from each
endpoint independently — never inferred from a fail-first pair validation message.

Must not include: API keys, credentials, arbitrary raw account text,
provider-authored exactQuote as authority, full raw provider output in normal receipts.
