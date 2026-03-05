import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard h-12 header bar used at the top of every list panel and inspector.
 * Spec: flex h-12 shrink-0 items-center justify-between border-b border-border/40 px-4
 */
export function PanelBar({
  left,
  right,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center justify-between px-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      {right != null && (
        <div className="flex shrink-0 items-center gap-2">{right}</div>
      )}
    </div>
  );
}
