import type { Metadata } from "next";
import Script from "next/script";
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
      <head>
        {/* Polyfills for React 19 on older Safari (iOS 16 / Safari < 17.2) */}
        <Script strategy="beforeInteractive" id="polyfills">{`
          if (typeof Promise.withResolvers === 'undefined') {
            Promise.withResolvers = function() {
              var resolve, reject;
              var promise = new Promise(function(res, rej) { resolve = res; reject = rej; });
              return { promise: promise, resolve: resolve, reject: reject };
            };
          }
          if (typeof structuredClone === 'undefined') {
            structuredClone = function(obj) { return JSON.parse(JSON.stringify(obj)); };
          }
        `}</Script>
      </head>
      <body className="min-h-screen bg-white text-black">
        <Navbar />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
