"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        {/* Logo / Title */}
        <Link href="/" className="text-xl font-semibold text-[#4B2E6A]">
          Labor-AI Lab
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-700">
          <Link href="/about" className="hover:text-[#4B2E6A]">About</Link>
          <Link href="/research" className="hover:text-[#4B2E6A]">Research</Link>
          <Link href="/team" className="hover:text-[#4B2E6A]">Team</Link>
          <Link href="/publications" className="hover:text-[#4B2E6A]">Publications</Link>
          <Link href="/contact" className="hover:text-[#4B2E6A]">Contact</Link>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-gray-700"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>

      {/* Mobile nav */}
      {open && (
        <nav className="md:hidden px-4 pb-4 space-y-3 text-sm font-medium text-gray-700">
          <Link href="/about" onClick={() => setOpen(false)}>About</Link>
          <Link href="/research" onClick={() => setOpen(false)}>Research</Link>
          <Link href="/team" onClick={() => setOpen(false)}>Team</Link>
          <Link href="/publications" onClick={() => setOpen(false)}>Publications</Link>
          <Link href="/contact" onClick={() => setOpen(false)}>Contact</Link>
        </nav>
      )}
    </header>
  );
}
