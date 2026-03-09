"use client";

import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { ReferenceListPanel } from "./_components/ReferenceListPanel";

export default function ReferencesPage() {
  return (
    <>
      <DomainListSlot>
        <ReferenceListPanel />
      </DomainListSlot>

      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a memory from the list to view details.
        </p>
      </div>
    </>
  );
}
