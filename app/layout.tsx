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
        {/* iOS 11 / older Safari polyfills.
            strategy="beforeInteractive" guarantees this runs before Next.js bootstrap. */}
        <Script id="ios11-polyfills" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `
(function(){
  // globalThis — Safari 12.1+, required by Next.js webpack runtime
  if(typeof globalThis==='undefined'){try{Object.defineProperty(Object.prototype,'__gt__',{get:function(){return this},configurable:true});__gt__.globalThis=__gt__;delete Object.prototype.__gt__;}catch(e){window.globalThis=window;}}
  // Promise.withResolvers — Safari 17.2+, used by React 19
  if(!Promise.withResolvers){Promise.withResolvers=function(){var r,j,p=new Promise(function(a,b){r=a;j=b;});return{promise:p,resolve:r,reject:j};};}
  // structuredClone — Safari 15.4+, used by React 19
  if(typeof structuredClone==='undefined'){window.structuredClone=function(o){return JSON.parse(JSON.stringify(o));};}
  // Array.prototype.at — Safari 15.4+
  if(!Array.prototype.at){Array.prototype.at=function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;if(i<0||i>=this.length)return undefined;return this[i];};}
  // Object.fromEntries — Safari 12.2+
  if(!Object.fromEntries){Object.fromEntries=function(e){var o={};var it=e[Symbol.iterator]?e[Symbol.iterator]():e;var n;while(!(n=it.next()).done){var kv=n.value;o[kv[0]]=kv[1];}return o;};}
  // queueMicrotask — Safari 13+, used by React scheduler
  if(typeof queueMicrotask==='undefined'){window.queueMicrotask=function(fn){Promise.resolve().then(fn);};}
  // WeakRef — Safari 14.5+, used by React 19 internals
  if(typeof WeakRef==='undefined'){window.WeakRef=function(t){this.deref=function(){return t;};};}
  // FinalizationRegistry — Safari 14.5+
  if(typeof FinalizationRegistry==='undefined'){window.FinalizationRegistry=function(){this.register=function(){};this.unregister=function(){};};}
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
