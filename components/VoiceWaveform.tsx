"use client";

import { useEffect, useRef } from "react";

/**
 * Animated voice waveform bars shown while recording.
 * Uses CSS animation for pulsing bars that simulate audio activity.
 */
export function VoiceWaveform({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const bars = containerRef.current.querySelectorAll<HTMLSpanElement>(".vw-bar");
    let frame: number | undefined;

    const animate = () => {
      for (const bar of bars) {
        // Random height between 30% and 100%
        const height = 30 + Math.random() * 70;
        bar.style.height = `${height}%`;
      }
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className="inline-flex items-center gap-[2px] h-4"
      aria-label="Recording waveform"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className="vw-bar w-[2.5px] rounded-full bg-current transition-all duration-75"
          style={{ height: "40%" }}
        />
      ))}
    </div>
  );
}
