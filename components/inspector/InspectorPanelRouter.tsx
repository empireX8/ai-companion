"use client";

import { useInspector } from "./InspectorContext";
import { useInspectorContextFromPathname } from "./MemoryInspectorDrawer";
import { ChatInspectorPanel } from "./panels/ChatInspectorPanel";
import { ContradictionsInspectorPanel } from "./panels/ContradictionsInspectorPanel";
import { ReferencesInspectorPanel } from "./panels/ReferencesInspectorPanel";
import { AuditInspectorPanel } from "./panels/AuditInspectorPanel";
import { ImportInspectorPanel } from "./panels/ImportInspectorPanel";
import { DefaultInspectorPanel } from "./panels/DefaultInspectorPanel";
import { ModelMovementInspectorPanel } from "./panels/ModelMovementInspectorPanel";
import { SelectedObjectEvidencePanel } from "./panels/SelectedObjectEvidencePanel";

const DOMAIN_PANELS = {
  chat: ChatInspectorPanel,
  contradictions: ContradictionsInspectorPanel,
  references: ReferencesInspectorPanel,
  audit: AuditInspectorPanel,
  import: ImportInspectorPanel,
  default: DefaultInspectorPanel,
} as const;

function DomainInspectorPanel() {
  const { domain } = useInspectorContextFromPathname();
  const Panel = DOMAIN_PANELS[domain];
  return <Panel />;
}

export function InspectorPanelRouter() {
  const { tab, selection } = useInspector();

  if (tab === "movement") {
    return <ModelMovementInspectorPanel />;
  }

  if (selection) {
    return <SelectedObjectEvidencePanel selection={selection} />;
  }

  return <DomainInspectorPanel />;
}
