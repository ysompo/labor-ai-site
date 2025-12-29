import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Labor-AI Lab",
  description:
    "Using AI to transform maternal and neonatal safety during pregnancy and birth.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

        <footer className="border-t border-black/10">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-black/60">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <span>© {new Date().getFullYear()} Labor-AI Lab</span>
              <span className="text-black/50">
                Hadassah Mount Scopus Medical Center · The Hebrew University of
                Jerusalem
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
