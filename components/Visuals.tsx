// Subtle SVG visualisations — restrained, not chart-junk.

export function Waveform({ points = 40, seed = 1, height = 36, className = "" }: { points?: number; seed?: number; height?: number; className?: string }) {
  const rand = (i: number) => {
    const x = Math.sin((i + 1) * 999.13 * seed) * 10000;
    return x - Math.floor(x);
  };
  const w = 200;
  const path = Array.from({ length: points }, (_, i) => {
    const x = (i / (points - 1)) * w;
    const y = height / 2 + (rand(i) - 0.5) * height * 0.85;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={className} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={`wf-${seed}`} x1="0" x2="1">
          <stop offset="0" stopColor="hsl(187 100% 50%)" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="hsl(187 100% 50%)" stopOpacity="0.7" />
          <stop offset="1" stopColor="hsl(187 100% 50%)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={`url(#wf-${seed})`} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function RhythmGraph({ seed = 3, height = 140 }: { seed?: number; height?: number }) {
  const w = 800;
  const points = 60;
  const rand = (i: number) => {
    const x = Math.sin((i + 1) * 53.71 * seed) * 10000;
    return x - Math.floor(x);
  };
  const ys = Array.from({ length: points }, (_, i) => {
    const trend = Math.sin((i / points) * Math.PI * 1.2) * 0.25;
    return height / 2 + (rand(i) - 0.5) * height * 0.55 + trend * height;
  });
  const linePath = ys.map((y, i) => `${i === 0 ? "M" : "L"}${(i / (points - 1)) * w},${y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${w},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`rh-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="hsl(187 100% 50%)" stopOpacity="0.18" />
          <stop offset="1" stopColor="hsl(187 100% 50%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1="0" x2={w} y1={height * p} y2={height * p} stroke="hsl(0 0% 100% / 0.04)" strokeWidth="1" />
      ))}
      <path d={areaPath} fill={`url(#rh-${seed})`} />
      <path d={linePath} fill="none" stroke="hsl(187 100% 50%)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx={w} cy={ys[ys.length - 1]} r="3" fill="hsl(187 100% 50%)" />
      <circle cx={w} cy={ys[ys.length - 1]} r="6" fill="hsl(187 100% 50% / 0.2)" />
    </svg>
  );
}

export function DualWaveform({ height = 110 }: { height?: number }) {
  const w = 800;
  const n = 70;
  const rand = (i: number, s: number) => {
    const x = Math.sin((i + 1) * s) * 10000;
    return x - Math.floor(x);
  };
  const top = Array.from({ length: n }, (_, i) => {
    const y = height / 2 - (Math.abs(rand(i, 11.3)) * 0.4 + 0.1) * height * 0.7;
    return `${i === 0 ? "M" : "L"}${(i / (n - 1)) * w},${y.toFixed(2)}`;
  }).join(" ");
  const bottom = Array.from({ length: n }, (_, i) => {
    const y = height / 2 + (Math.abs(rand(i, 7.91)) * 0.4 + 0.1) * height * 0.7;
    return `${i === 0 ? "M" : "L"}${(i / (n - 1)) * w},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <line x1="0" x2={w} y1={height / 2} y2={height / 2} stroke="hsl(0 0% 100% / 0.06)" />
      <path d={top} fill="none" stroke="hsl(187 100% 50%)" strokeWidth="1.3" strokeOpacity="0.85" />
      <path d={bottom} fill="none" stroke="hsl(32 90% 60%)" strokeWidth="1.3" strokeOpacity="0.75" />
    </svg>
  );
}

export function OccurrenceDots({ count = 14, marks = [0, 2, 5, 6, 9, 12, 13] }: { count?: number; marks?: number[] }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${marks.includes(i) ? "bg-cyan glow-cyan" : "bg-white/10"}`}
        />
      ))}
    </div>
  );
}
