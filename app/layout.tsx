// File: app/layout.tsx

import "./globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Labor-AI Lab",
  description: "AI for maternal and neonatal safety",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="bg-white border-b py-4 px-6">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-semibold text-[#4B2E6A]">
              Labor-AI Lab
            </Link>
            <nav className="space-x-6 text-sm text-slate-700">
              <Link href="/about">About</Link>
              <Link href="/research">Research</Link>
              <Link href="/team">Team</Link>
              <Link href="/publications">Publications</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </div>
        </header>

        <main className="px-6 py-12 max-w-6xl mx-auto">{children}</main>

        <footer className="bg-slate-100 border-t mt-20 py-6 text-sm text-center text-slate-600">
          <div className="max-w-6xl mx-auto px-6">
            <p>
              © {new Date().getFullYear()} Labor-AI Lab · Hadassah–Hebrew University Medical Center
            </p>
            <p>
              Contact: <a href="mailto:ysompo@gmail.com" className="text-[#4B2E6A] hover:underline">ysompo@gmail.com</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}