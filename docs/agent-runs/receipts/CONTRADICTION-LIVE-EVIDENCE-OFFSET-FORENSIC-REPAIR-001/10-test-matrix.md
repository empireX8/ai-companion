# 10 — Test matrix

Focused file: `lib/__tests__/contradiction-live-evidence-offset-forensic-repair.test.ts`

Covers required items 1–27 including:

1. CEQR-019 ASCII offset matrix
2–3. UTF-16 === code-point proof
4–13. validator pass/fail cases (punctuation, morni, surrogate, astral, combining marks)
14–16. sanitized diagnostics (offsets, failing side, no secrets)
17–18. source authority / no clamp
19–22. referee/writer isolation for malformed/compatible
23–24. CEQR-019 claim/receipt immutability
25–27. live guards unset; injectable offline adapter only; no account/DB

Plus adversarial: mid-word offset cannot be expressed via in-range boundary indices.
