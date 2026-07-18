import { resolve } from "node:path"

import { writeExactFixtureManifest } from "../lib/exact-fixture-round-trip-manifest"

const OUTPUT_PATH = resolve(
  process.cwd(),
  "docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/exact-fixture-round-trip-manifest.json",
)

const manifest = writeExactFixtureManifest(OUTPUT_PATH)

console.log(
  "EXACT_FIXTURE_MANIFEST_OK",
  manifest.version,
  manifest.objects.length,
  OUTPUT_PATH,
)
