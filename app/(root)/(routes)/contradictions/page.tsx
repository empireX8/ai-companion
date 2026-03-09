"use client";

import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { ContradictionListPanel } from "./_components/ContradictionListPanel";

export default function ContradictionsPage() {
  return (
    <>
      <DomainListSlot>
        <ContradictionListPanel />
      </DomainListSlot>

      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a tension from the list to view details.
        </p>
      </div>
    </>
  );
}
