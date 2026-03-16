import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";
import SiteShell from "./components/SiteShell";

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
        <Navbar />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
