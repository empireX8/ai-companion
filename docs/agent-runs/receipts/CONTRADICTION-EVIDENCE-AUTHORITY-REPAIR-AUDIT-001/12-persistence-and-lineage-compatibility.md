# 12 — Persistence and lineage compatibility

Persistence plan / dual-side lineage / repaired writer consume bound domain `ExactEvidenceClaim` from validated semantic — not raw provider transport.

Exact duplicate prevention and dual-source presentation remain unchanged.

No real Prisma transaction in this slice. Injected in-memory harness only where existing tests already use it.
