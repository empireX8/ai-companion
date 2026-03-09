import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { ProjectionListPanel } from "./_components/ProjectionListPanel";

export default function ProjectionsPage() {
  return (
    <>
      <DomainListSlot>
        <ProjectionListPanel />
      </DomainListSlot>
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a forecast to view details.</p>
      </div>
    </>
  );
}
