"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useDomainListPanel } from "./DomainListContext";

export function DomainListSlot({ children }: { children: ReactNode }) {
  const { panelRef } = useDomainListPanel();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !panelRef.current) return null;
  return createPortal(children, panelRef.current);
}
