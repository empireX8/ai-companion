# Checkpoint 3 — Runtime Provenance Proof

**Result:** **PASS WITH RISKS**

---

## Environment

| Item | Value |
|---|---|
| Database | Local Postgres `postgresql://postgres:postgres@localhost:5432/companion` |
| User | `user_34TUYA53pI1QRLK73O22Kve1a1G` |
| Safety gate | `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1` |
| Script | `scripts/run-movement-assault-runtime-proof.ts` |
| Fixture module | `lib/model-movement-runtime-fixture.ts` |

**Risk:** HTTP/browser replay against running Next dev server not recorded in this receipt; DB + service-level proof only.

---

## Representative runtime IDs (this run)

| Family | ID |
|---|---|
| Pattern/claim update (published) | `cmrjlk2hc0000qlb018i21fpl` |
| Conclusion update | `dev-movement-report-assault-conclusion-update` |
| Sparse update (missing before + rationale) | `dev-movement-report-assault-sparse` |
| Affected conclusion | `dev-live-evidence-depth-conclusion` |
| Affected claim | `dev-live-evidence-depth-claim` |

---

## Endpoints (authenticated)

| Endpoint | Purpose |
|---|---|
| `GET /api/today/movement-depth` | Shared depth for Today/Timeline hybrid |
| `GET /api/what-changed/cmrjlk2hc0000qlb018i21fpl` | Full movement report |
| `GET /api/what-changed/cmrjlk2hc0000qlb018i21fpl/evidence` | Cited evidence |

---

## DB proof summary

### Pattern/claim update (`cmrjlk2hc0000qlb018i21fpl`)

| Field | Stored value |
|---|---|
| before | `Pattern treated as tentative only.` |
| after | `Energy drops after meetings without a stop point.` |
| rationale | `Connects evening overwork to the missing stop point before commitments lock.` |
| evidence links | 1 |

### Conclusion update (`dev-movement-report-assault-conclusion-update`)

| Field | Stored value |
|---|---|
| before | `No prior published conclusion on this map item.` |
| after | `Evening stop point matters — Commitments lock before the body signals a stop.` |
| rationale | `Three receipts show commitments locking before the body signals stop.` |

### Sparse update (`dev-movement-report-assault-sparse`)

| Field | Stored value |
|---|---|
| before | **null** (honest) |
| after | `Confidence increased without a stored prior read.` |
| rationale | **null** (honest) |

---

## Zip/reference substitution

**NOT observed** — live IDs resolve from Postgres; parity gates withhold `rep-weekly` without live report object.

---

## Checkpoint verdict

**PASS WITH RISKS** — deterministic DB proof for three representative updates; browser-level HTTP capture deferred.
