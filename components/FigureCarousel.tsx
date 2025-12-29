"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export default function FigureCarousel() {
  // IMPORTANT: filenames must match EXACTLY (case-sensitive on Vercel/Linux)
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
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % figures.length);
    }, 5000);
    return () => clearInterval(t);
  }, [figures.length]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full">
        <Image
          key={figures[idx]}
          src={figures[idx]}
          alt="Publication figure"
          fill
          className="object-contain p-4"
          priority={false}
          sizes="(max-width: 768px) 100vw, 420px"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
        <button
          type="button"
          onClick={prev}
          className="rounded-md border border-black/10 bg-white/90 px-3 py-2 text-sm text-black/70 hover:text-[#4B2E6A]"
          aria-label="Previous figure"
        >
          ←
        </button>

        <div className="text-xs text-black/50">
          {idx + 1} / {figures.length}
        </div>

        <button
          type="button"
          onClick={next}
          className="rounded-md border border-black/10 bg-white/90 px-3 py-2 text-sm text-black/70 hover:text-[#4B2E6A]"
          aria-label="Next figure"
        >
          →
        </button>
      </div>
    </div>
  );
}
