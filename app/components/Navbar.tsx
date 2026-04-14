// app/components/Navbar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { name: 'About', href: '/about' },
  { name: 'Research', href: '/research' },
  { name: 'Team', href: '/team' },
  { name: 'Publications', href: '/publications' },
  { name: 'Contact', href: '/contact' },
  { name: 'Simulator', href: '/tools/simulator', highlight: true },
  { name: 'Research Assistant', href: '/tools/research', highlight: true, icon: '🔬' },
  { name: 'Journal Club', href: '/tools/journal-club', highlight: true, icon: '📚' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Full-screen tools have their own nav bars
  if (pathname.startsWith('/tools/')) return null

  return (
    <header className="relative border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-lg font-semibold text-[#4B2E6A]">
          Labor-AI Lab
        </Link>

        {/* Desktop menu */}
        <nav className="hidden md:flex gap-6 items-center">
          {navItems.map(item => (
            item.highlight ? (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-semibold px-4 py-1.5 rounded-full text-white bg-[#4B2E6A] hover:bg-[#7c3aed] transition-colors"
              >
                {item.icon ?? '🏥'} {item.name}
              </Link>
            ) : (
              <Link
                key={item.name}
                href={item.href}
                className="text-base font-medium text-slate-700 hover:text-[#4B2E6A]"
              >
                {item.name}
              </Link>
            )
          ))}
          <Link
            href="/admin/users"
            className="text-xs font-medium text-slate-500 hover:text-[#4B2E6A] px-2 py-1 rounded border border-slate-200 hover:border-[#4B2E6A] transition-colors"
          >
            👥 Admin
          </Link>
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
        <div className="md:hidden absolute right-4 top-16 w-48 bg-white border rounded-lg shadow-lg z-50">
          {navItems.map(item => (
            <Link
              key={item.name}
              href={item.href}
              className={`block px-4 py-3 text-sm ${item.highlight ? 'text-[#4B2E6A] font-semibold' : 'text-slate-700'} hover:bg-slate-100`}
              onClick={() => setOpen(false)}
            >
              {item.highlight ? `${item.icon ?? '🏥'} ${item.name}` : item.name}
            </Link>
          ))}
          <div className="border-t">
            <Link
              href="/admin/users"
              className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              👥 Admin
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
