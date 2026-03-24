import * as fs from "fs";
import * as path from "path";

import type { VisibleAbstentionPolicyArtifact } from "./eval/eval-types";

export const VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION = 1;
export const DEFAULT_VISIBLE_ABSTENTION_POLICY_PATH = path.join(
  process.cwd(),
  "eval/patterns/reports/visible-abstention-policy.json"
);

export type VisibleAbstentionFallbackReason =
  | "missing_artifact"
  | "malformed_json"
  | "invalid_shape"
  | "threshold_missing"
  | "fallback_flagged"
  | "failed_gate"
  | "constant_override";

export type VisibleAbstentionPolicyResolution = {
  thresholdUsed: number;
  thresholdSource: "policy_artifact" | "constant_fallback" | "explicit_override";
  fallbackReason: VisibleAbstentionFallbackReason | null;
  artifactVersion: number | null;
  artifactPresent: boolean;
  artifactValid: boolean;
  artifactConsumable: boolean;
  gateStatuses: VisibleAbstentionPolicyArtifact["calibrationGateStatus"] | null;
  selectedThreshold: number | null;
  constantThreshold: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return typeof value === "object" && value !== null;
}

export function isValidVisibleAbstentionPolicyArtifact(
  value: unknown
): value is VisibleAbstentionPolicyArtifact {
  if (typeof value !== "object" || value === null) return false;

  const row = value as Record<string, unknown>;
  if (row["version"] !== VISIBLE_ABSTENTION_POLICY_ARTIFACT_VERSION) return false;
  if (typeof row["generatedAt"] !== "string" || row["generatedAt"].length === 0) return false;
  if (typeof row["sourceReportPath"] !== "string" || row["sourceReportPath"].length === 0) return false;
  if (row["selectedThreshold"] !== null && !isFiniteNumber(row["selectedThreshold"])) return false;
  if (!isFiniteNumber(row["targetFailureRate"])) return false;
  if (!isFiniteNumber(row["coverageFloor"])) return false;
  if (!Number.isInteger(row["eligibleClaims"]) || (row["eligibleClaims"] as number) < 0) return false;
  if (typeof row["fallbackUsed"] !== "boolean") return false;
  if (typeof row["selectionReason"] !== "string") return false;

  const gateStatus = row["calibrationGateStatus"];
  if (!isBooleanRecord(gateStatus)) return false;
  if (typeof gateStatus["thresholdSelected"] !== "boolean") return false;
  if (typeof gateStatus["coverageFloorPassed"] !== "boolean") return false;
  if (typeof gateStatus["failureTargetRespected"] !== "boolean") return false;
  if (typeof gateStatus["dataSufficient"] !== "boolean") return false;

  return true;
}

export function isConsumableVisibleAbstentionPolicyArtifact(
  policyArtifact: VisibleAbstentionPolicyArtifact | null | undefined
): policyArtifact is VisibleAbstentionPolicyArtifact & { selectedThreshold: number; fallbackUsed: false } {
  return Boolean(
    policyArtifact &&
      isFiniteNumber(policyArtifact.selectedThreshold) &&
      policyArtifact.fallbackUsed === false &&
      policyArtifact.calibrationGateStatus.thresholdSelected &&
      policyArtifact.calibrationGateStatus.coverageFloorPassed &&
      policyArtifact.calibrationGateStatus.failureTargetRespected &&
      policyArtifact.calibrationGateStatus.dataSufficient
  );
}

function resolveNonConsumableReason(
  policyArtifact: VisibleAbstentionPolicyArtifact | null | undefined
): VisibleAbstentionFallbackReason {
  if (!policyArtifact) return "missing_artifact";
  if (!isFiniteNumber(policyArtifact.selectedThreshold)) return "threshold_missing";
  if (policyArtifact.fallbackUsed) return "fallback_flagged";
  return "failed_gate";
}

export function loadVisibleAbstentionPolicyArtifactDiagnostics(
  policyPath = DEFAULT_VISIBLE_ABSTENTION_POLICY_PATH
): {
  artifact: VisibleAbstentionPolicyArtifact | null;
  artifactPresent: boolean;
  artifactValid: boolean;
  fallbackReason: VisibleAbstentionFallbackReason | null;
} {
  try {
    if (!fs.existsSync(policyPath)) {
      return {
        artifact: null,
        artifactPresent: false,
        artifactValid: false,
        fallbackReason: "missing_artifact",
      };
    }

    const raw = fs.readFileSync(path.resolve(policyPath), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!isValidVisibleAbstentionPolicyArtifact(parsed)) {
      return {
        artifact: null,
        artifactPresent: true,
        artifactValid: false,
        fallbackReason: "invalid_shape",
      };
    }

    return {
      artifact: parsed,
      artifactPresent: true,
      artifactValid: true,
      fallbackReason: null,
    };
  } catch {
    return {
      artifact: null,
      artifactPresent: true,
      artifactValid: false,
      fallbackReason: "malformed_json",
    };
  }
}

export function loadVisibleAbstentionPolicyArtifact(
  policyPath = DEFAULT_VISIBLE_ABSTENTION_POLICY_PATH
): VisibleAbstentionPolicyArtifact | null {
  return loadVisibleAbstentionPolicyArtifactDiagnostics(policyPath).artifact;
}

export function resolveVisibleAbstentionPolicyThreshold(args?: {
  policyArtifact?: VisibleAbstentionPolicyArtifact | null;
  policyPath?: string;
  explicitOverride?: number;
  constantThreshold?: number;
}): VisibleAbstentionPolicyResolution {
  const constantThreshold = args?.constantThreshold ?? 0.55;
  if (args?.explicitOverride !== undefined) {
    return {
      thresholdUsed: args.explicitOverride,
      thresholdSource: "explicit_override",
      fallbackReason: "constant_override",
      artifactVersion: args.policyArtifact?.version ?? null,
      artifactPresent: Boolean(args.policyArtifact),
      artifactValid: Boolean(args.policyArtifact),
      artifactConsumable: false,
      gateStatuses: args.policyArtifact?.calibrationGateStatus ?? null,
      selectedThreshold: args.policyArtifact?.selectedThreshold ?? null,
      constantThreshold,
    };
  }

  const diagnostics = args?.policyArtifact
    ? {
        artifact: args.policyArtifact,
        artifactPresent: true,
        artifactValid: true,
        fallbackReason: null as VisibleAbstentionFallbackReason | null,
      }
    : loadVisibleAbstentionPolicyArtifactDiagnostics(args?.policyPath);
  const artifact = diagnostics.artifact;
  const artifactConsumable = isConsumableVisibleAbstentionPolicyArtifact(artifact);

  return {
    thresholdUsed: artifactConsumable ? artifact.selectedThreshold : constantThreshold,
    thresholdSource: artifactConsumable ? "policy_artifact" : "constant_fallback",
    fallbackReason:
      artifactConsumable
        ? null
        : diagnostics.fallbackReason ?? resolveNonConsumableReason(artifact),
    artifactVersion: artifact?.version ?? null,
    artifactPresent: diagnostics.artifactPresent,
    artifactValid: diagnostics.artifactValid,
    artifactConsumable,
    gateStatuses: artifact?.calibrationGateStatus ?? null,
    selectedThreshold: artifact?.selectedThreshold ?? null,
    constantThreshold,
  };
}

export function summarizeVisibleAbstentionPolicyArtifact(args?: {
  policyArtifact?: VisibleAbstentionPolicyArtifact | null;
  policyPath?: string;
  explicitOverride?: number;
}): VisibleAbstentionPolicyResolution {
  return resolveVisibleAbstentionPolicyThreshold(args);
}
