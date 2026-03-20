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
      <head>
        {/* Polyfills for iOS 11 / older Safari — must run before Next.js webpack runtime.
            globalThis: required by Next.js runtime (Safari 12.1+).
            Promise.withResolvers: used by React 19 (Safari 17.2+).
            structuredClone: used by React 19 (Safari 15.4+).
            Array.prototype.at: Safari 15.4+.
            Object.fromEntries: Safari 12.2+. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            if(typeof globalThis==='undefined'){try{Object.defineProperty(Object.prototype,'__gt__',{get:function(){return this},configurable:true});__gt__.globalThis=__gt__;delete Object.prototype.__gt__;}catch(e){window.globalThis=window;}}
            if(!Promise.withResolvers){Promise.withResolvers=function(){var r,j,p=new Promise(function(a,b){r=a;j=b;});return{promise:p,resolve:r,reject:j};};}
            if(typeof structuredClone==='undefined'){window.structuredClone=function(o){return JSON.parse(JSON.stringify(o));};}
            if(!Array.prototype.at){Array.prototype.at=function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;if(i<0||i>=this.length)return undefined;return this[i];};}
            if(!Object.fromEntries){Object.fromEntries=function(e){var o={};var i=e[Symbol.iterator]?e[Symbol.iterator]():e;var n;while(!(n=i.next()).done){var p=n.value;o[p[0]]=p[1];}return o;};}
          })();
        `}} />
      </head>
      <body className="min-h-screen bg-white text-black">
        <Navbar />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
