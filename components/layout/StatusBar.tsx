import { Brain, Circle } from "lucide-react";

export function StatusBar() {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border/40 bg-background px-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Brain className="h-3 w-3 text-primary" />
          <span className="text-[10px] text-muted-foreground">Standard mode</span>
        </div>
        <div className="flex items-center gap-1">
          <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500" />
          <span className="text-[10px] text-muted-foreground">Connected</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground/50">MindLab v0.1</span>
      </div>
    </div>
  );
}
