import Image from "next/image";
import Link from "next/link";
import FigureCarousel from "@/components/FigureCarousel";

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* HERO */}
      <section className="grid gap-10 md:grid-cols-2 md:items-center">
        {/* Left */}
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-6 md:justify-start">
            {/* Make sure filenames match exactly */}
            <Image
              src="/hadassah.png"
              alt="Hadassah"
              width={70}
              height={70}
              className="h-14 w-auto object-contain"
              priority
            />
            <Image
              src="/HUJI.png"
              alt="Hebrew University of Jerusalem"
              width={120}
              height={70}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>

          <h1 className="text-4xl font-semibold leading-tight text-[#4B2E6A] md:text-5xl">
            Using AI to transform maternal and neonatal safety
          </h1>

          <p className="text-black/70 leading-relaxed">
            Labor-AI is a research lab at Hadassah Mount Scopus and the Hebrew
            University developing explainable, reliable AI decision-support tools
            for obstetrics — grounded in real clinical data from over 130,000
            deliveries.
          </p>

          {/* Buttons centered on mobile, left on desktop */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link
              href="/research"
              className="inline-flex items-center justify-center rounded-md bg-[#4B2E6A] px-6 py-2 text-base font-medium text-white hover:opacity-90"
            >
              Explore Our Work
            </Link>
            <Link
              href="/publications"
              className="inline-flex items-center justify-center rounded-md border border-[#4B2E6A] px-6 py-2 text-base font-medium text-[#4B2E6A] hover:bg-black/5"
            >
              View Publications
            </Link>
          </div>

          <div className="pt-6 text-center md:text-left">
            <h3 className="text-lg font-semibold text-[#4B2E6A]">
              What we focus on
            </h3>
            <p className="mt-2 text-bases text-black/70">
              AI in labor &amp; delivery · Perinatal epidemiology · Clinical ML
              methodology
            </p>
          </div>
        </div>

        {/* Right: carousel */}
        <div className="md:pl-6">
          <FigureCarousel />
        </div>
      </section>

      {/* FEATURED PUBLICATION */}
      <section className="text-center">
        <h2 className="text-2xl font-semibold text-[#4B2E6A]">
          Featured publication
        </h2>

        <p className="mt-3 text-black/80">
          <span className="italic">
            Real-time data analysis using a machine learning model significantly
            improves prediction of successful vaginal deliveries.
          </span>
          <br />
          <span className="text-base text-black/70">
            Am J Obstet Gynecol. 2020 Sep;223(3):437. PMID: 32434000.
          </span>
        </p>

        <p className="mt-3">
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/32434000/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-[#4B2E6A] underline hover:opacity-80"
          >
            View on PubMed →
          </a>
        </p>
      </section>
    </div>
  );
}
