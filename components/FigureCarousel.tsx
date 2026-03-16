"use client";

import { useEffect, useMemo, useState } from "react";

export default function FigureCarousel() {
  const figures = useMemo(
    () => [
      "/figures/REALTIME2.png",
      "/figures/REALTIME3.png",
      "/figures/SANO1.png",
      "/figures/SANO2.png",
      "/figures/TOLAC2.png",
      "/figures/TOLAC3.png",
      "/figures/TRANSPORT1.png",
      "/figures/TRANSPORT2.png",
    ],
    []
  );

  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (i - 1 + figures.length) % figures.length);
  const next = () => setIdx((i) => (i + 1) % figures.length);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % figures.length), 5000);
    return () => clearInterval(t);
  }, [figures.length]);

  return (
    <div className="relative w-full rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
      {/* Use plain <img> — Next.js Image with fill breaks on iOS Safari */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={figures[idx]}
        src={figures[idx]}
        alt="Publication figure"
        style={{ width: '100%', height: 'auto', display: 'block', padding: 16, boxSizing: 'border-box' }}
      />

      <div className="flex items-center justify-between p-3 border-t border-black/5">
        <button
          type="button"
          onClick={prev}
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/70 hover:text-[#4B2E6A]"
          aria-label="Previous figure"
        >
          ←
        </button>
        <div className="text-xs text-black/50">{idx + 1} / {figures.length}</div>
        <button
          type="button"
          onClick={next}
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/70 hover:text-[#4B2E6A]"
          aria-label="Next figure"
        >
          →
        </button>
      </div>
    </div>
  );
}
