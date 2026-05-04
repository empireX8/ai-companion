// Shared page layout primitives — PageHeader and SectionLabel.

export function PageHeader({
  eyebrow,
  title,
  meta,
  right,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 mb-8">
      <div>
        {eyebrow && <div className="label-meta mb-2">{eyebrow}</div>}
        <h1 className="text-[34px] leading-[1.05] font-bold tracking-[-0.02em]">{title}</h1>
        {meta && <div className="text-meta text-[13px] mt-2">{meta}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="label-meta">{children}</div>
      {right}
    </div>
  );
}
