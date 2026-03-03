"use client";

import { DomainListSlot } from "@/components/layout/DomainListSlot";
import { AuditListPanel } from "./_components/AuditListPanel";

export default function AuditPage() {
  return (
    <>
      <DomainListSlot>
        <AuditListPanel />
      </DomainListSlot>

      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a week from the list to inspect.
        </p>
      </div>
    </>
  );
}
