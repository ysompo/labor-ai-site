'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Full-screen tools: no wrapper, no footer, no padding
  if (pathname.startsWith('/tools/')) {
    return <>{children}</>;
  }

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-10 text-xl leading-relaxed">
        {children}
      </main>
      <footer className="border-t border-black/10">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-black/60">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span>© {new Date().getFullYear()} Labor-AI Lab</span>
            <span className="text-black/50">
              Hadassah Mount Scopus Medical Center · The Hebrew University of Jerusalem
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
