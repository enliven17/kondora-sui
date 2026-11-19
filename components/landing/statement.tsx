"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** A run of words; `key` runs end in fg, the rest settle at muted. */
type Run = { text: string; key?: boolean };

const COLUMNS: Run[][] = [
  [
    { text: "A prediction market should settle on facts, not on whoever argues loudest.", key: true },
    {
      text: " On Kondora a creator agent opens every market with a written rule and a named source. You pick YES or NO and size it up to 5x.",
    },
  ],
  [
    {
      text: "When the clock runs out, an oracle agent reads the source, seals the evidence and proposes the outcome. An auditor on a different model checks it blind. ",
    },
    { text: "Nobody on the team picks a winner. The rules do.", key: true },
  ],
];

/** Cocoa card with two columns of copy that lights up word by word as it scrolls through. */
export function Statement() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const words = gsap.utils.toArray<HTMLElement>("[data-word]", ref.current);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.set(words, { opacity: 0.22 });
      gsap.to(words, {
        opacity: 1,
        ease: "none",
        stagger: 0.05,
        scrollTrigger: { trigger: ref.current, start: "top 75%", end: "bottom 60%", scrub: 0.4 },
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} aria-label="Why Kondora" className="page-x mx-auto max-w-page py-24 sm:py-32">
      <div className="grid gap-8 rounded-xl bg-cocoa px-6 py-16 text-lg leading-relaxed sm:px-12 sm:py-24 md:grid-cols-2 md:gap-14 lg:px-16 lg:py-32 lg:text-xl">
        {COLUMNS.map((runs, i) => (
          <p key={i}>
            {runs.map((run, j) =>
              run.text
                .split(/(\s+)/)
                .map((w, k) =>
                  /^\s+$/.test(w) || !w ? (
                    w
                  ) : (
                    <span key={`${j}-${k}`} data-word className={run.key ? "text-fg" : "text-muted"}>
                      {w}
                    </span>
                  ),
                ),
            )}
          </p>
        ))}
      </div>
    </section>
  );
}
