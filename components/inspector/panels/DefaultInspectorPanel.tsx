"use client";

export function DefaultInspectorPanel() {
  return (
    <div className="space-y-4 p-4 text-sm">
      <div>
        <p className="font-medium text-foreground">Memory inspector</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Navigate to a domain to see live contextual data here.
        </p>
      </div>
      <ul className="space-y-1">
        {[
          "Chat — surfaced contradictions + pressure",
          "Contradictions — status breakdown",
          "References — active beliefs count",
          "Audit — current week metrics",
          "Import — recent upload history",
        ].map((item) => (
          <li key={item} className="flex gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0 text-muted-foreground/40">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
