// File: app/page.tsx

import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="px-6 py-16 max-w-6xl mx-auto text-slate-900">

      {/* Hero Section */}
      <section className="flex flex-col-reverse md:flex-col items-center justify-between gap-10">
        {/* Logos */}
        <div className="flex justify-center items-center gap-8 mb-8">
          <Image
            src="/hadassah.png"
            alt="Hadassah logo"
            width={100}
            height={100}
            className="object-contain"
          />
          <Image
            src="/HUJI.png"
            alt="Hebrew University logo"
            width={100}
            height={100}
            className="object-contain"
          />
        </div>

        {/* Hero Text */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-semibold text-[#4B2E6A] leading-tight">
            Using AI to transform maternal and neonatal safety
          </h1>
          <p className="text-lg text-slate-800 max-w-3xl mx-auto">
            Labor-AI is a research lab at Hadassah Mount Scopus and the Hebrew University developing explainable, reliable AI decision-support tools for obstetrics — grounded in real clinical data from over 130,000 deliveries.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/research" className="bg-[#4B2E6A] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#3E2459]">
              Explore Our Work
            </Link>
            <Link href="/publications" className="border border-[#4B2E6A] text-[#4B2E6A] px-6 py-2 rounded-md text-sm font-medium hover:bg-[#F2ECF7]">
              View Publications
            </Link>
          </div>
        </div>
      </section>

      {/* Research Focus Section */}
      <section className="mt-24 text-center space-y-4">
        <h2 className="text-2xl font-semibold text-[#4B2E6A]">What we focus on</h2>
        <p className="text-md text-slate-700">
          AI in labor & delivery · Perinatal epidemiology · Clinical ML methodology
        </p>
        <Link href="/research" className="text-sm text-[#4B2E6A] hover:underline">
          Learn more →
        </Link>
      </section>

      {/* Featured Publication */}
      <section className="mt-16 text-center space-y-4">
        <h2 className="text-2xl font-semibold text-[#4B2E6A]">Featured publication</h2>
        <p className="text-md text-slate-800 italic">
          Real-time data analysis using a machine learning model significantly improves prediction of successful vaginal deliveries. <br />
          <span className="not-italic">Am J Obstet Gynecol</span>, 2020. PMID: 32750497.
        </p>
        <Link href="/publications" className="text-sm text-[#4B2E6A] hover:underline">
          Full publication list →
        </Link>
      </section>
    </div>
  );
}