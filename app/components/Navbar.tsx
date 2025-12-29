// app/components/Navbar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

const navItems = [
  { name: 'About', href: '/about' },
  { name: 'Research', href: '/research' },
  { name: 'Team', href: '/team' },
  { name: 'Publications', href: '/publications' },
  { name: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="relative border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-lg font-semibold text-[#4B2E6A]">
          Labor-AI Lab
        </Link>

        {/* Desktop menu */}
        <nav className="hidden md:flex gap-6">
          {navItems.map(item => (
            <Link
              key={item.name}
              href={item.href}
              className="text-base font-medium text-slate-700 hover:text-[#4B2E6A]"

            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Hamburger (mobile only) */}
        <button
          className="md:hidden p-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <div className="space-y-1">
            <span className="block w-6 h-0.5 bg-slate-800" />
            <span className="block w-6 h-0.5 bg-slate-800" />
            <span className="block w-6 h-0.5 bg-slate-800" />
          </div>
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden absolute right-4 top-16 w-48 bg-white border rounded-lg shadow-lg">
          {navItems.map(item => (
            <Link
              key={item.name}
              href={item.href}
              className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
