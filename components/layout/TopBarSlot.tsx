"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useTopBarSlot } from "./TopBarSlotContext";

export function TopBarSlot({ children }: { children: ReactNode }) {
  const { slotRef } = useTopBarSlot();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !slotRef.current) return null;
  return createPortal(children, slotRef.current);
}
