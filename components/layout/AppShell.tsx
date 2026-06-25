"use client";

import { type ReactNode } from "react";

import { OrvekWorkbenchShell } from "@/components/orvek-workbench/OrvekWorkbenchShell";

export function AppShell({ children }: { children: ReactNode }) {
  return <OrvekWorkbenchShell>{children}</OrvekWorkbenchShell>;
}
