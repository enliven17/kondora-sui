"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { artSrcSet } from "@/components/ui/art-image";
import { ButtonLink } from "@/components/ui/button";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const ALT = "A pastel blossom grove with two glossy split coins resting in the foliage";

// Optimizer is off (free plan): pre-built widths, see components/ui/art-image.tsx.
// The frame is capped at 110rem (1760px); phones get the portrait crop.
const DESKTOP_SRCSET = artSrcSet("/art/hero.webp", 2400, [1280, 1600]);
const MOBILE_SRCSET = artSrcSet("/art/hero-mobile.webp", 1080, [720]);
const SIZES = "(min-width: 1760px) 1760px, 100vw";

const BADGES = ["Sui", "Sui Move"] as const;

export function Hero() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.to("[data-hero-image]", {
        yPercent: 12,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true },
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} aria-labelledby="hero-title" className="px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="relative isolate mx-auto flex min-h-[600px] max-w-[110rem] items-end overflow-hidden rounded-2xl bg-plum h-[calc(100svh-5.5rem)] sm:max-h-[860px]">
        <div data-hero-image className="absolute inset-0 -top-[8%] -z-10 h-[116%]">
          <picture>
            {/* Before this, getImageProps with the optimizer off gave the mobile source no srcSet,
                so phones downloaded the 190KB desktop art as their LCP image. */}
            <source media="(max-width: 767px)" srcSet={MOBILE_SRCSET} sizes="100vw" width={1080} height={1500} />
            <img
              src="/art/hero.webp"
              srcSet={DESKTOP_SRCSET}
              sizes={SIZES}
              alt={ALT}
              width={2400}
              height={1300}
              loading="eager"
              fetchPriority="high"
              decoding="sync"
              className="site-hero-zoom size-full object-cover"
            />
          </picture>
        </div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/55 via-ink/10 to-transparent" />

        <div data-hero-copy className="w-full max-w-3xl p-6 pb-8 text-fg sm:p-10 sm:pb-12 lg:p-14">
          <h1 id="hero-title" className="text-[clamp(2.75rem,8vw,6rem)] font-bold leading-[0.95] tracking-[-0.045em]">
            Trade what
            <br />
            happens next.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-fg/85 sm:text-lg">
            YES or NO, up to 5x. Agents open and settle the markets.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/markets" variant="light" size="lg" arrow>
              Open markets
            </ButtonLink>
            <ButtonLink href="/docs" variant="dark" size="lg" arrow>
              Read docs
            </ButtonLink>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-fg/15 pt-5 text-xs text-fg/75 sm:max-w-sm">
            <span>Built on</span>
            <span className="rounded-sm bg-ink/70 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fg">{BADGES[0]}</span>
            <span>and</span>
            <span className="rounded-sm bg-ink/70 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fg">{BADGES[1]}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
