import { ArtImage } from "@/components/ui/art-image";

import { Reveal } from "./reveal";

const FEATURES = [
  {
    src: "/art/feature-split.webp",
    alt: "A glossy plum coin split into two halves floating apart",
    title: "Agents open every market",
    body: "A creator agent selects sourced price questions, writes the rules and sets the opening price. This Sui testnet edition keeps a small set of markets indexed live.",
  },
  {
    src: "/art/feature-lever.webp",
    alt: "A stack of plum coins leaning on a pastel seesaw",
    title: "Leverage with on-chain limits",
    body: "Borrow up to 5x against your margin. The cap shrinks as the close gets near. Move checks position health, borrowing capacity and full outcome reserves.",
  },
  {
    src: "/art/feature-council.webp",
    alt: "Five glossy orbs in a ring around a split coin",
    title: "Sources settle, an auditor checks",
    body: "CoinGecko and Binance prices determine outcomes. An auditor independently checks the evidence and can challenge on-chain. Optional model council mode is disabled on this deployment.",
  },
] as const;

export function Features() {
  return (
    <section aria-labelledby="features-title" className="page-x mx-auto max-w-[72rem] pb-24 sm:pb-32">
      <h2 id="features-title" className="text-center text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em] text-cocoa">
        The market works for you
      </h2>
      <Reveal className="mt-14 grid gap-12 md:grid-cols-3 md:gap-6 lg:gap-8">
        {FEATURES.map((f) => (
          <article key={f.title} data-reveal className="text-center">
            <div className="overflow-hidden rounded-xl bg-blush">
              <ArtImage
                src={f.src}
                alt={f.alt}
                width={1200}
                height={1200}
                widths={[640, 960]}
                sizes="(min-width: 1152px) 360px, (min-width: 768px) 31vw, 100vw"
                className="aspect-square w-full object-cover transition-transform duration-700 ease-enter hover:scale-[1.03]"
              />
            </div>
            <h3 className="mt-6 text-lg font-bold tracking-[-0.02em] text-cocoa">{f.title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-mauve">{f.body}</p>
          </article>
        ))}
      </Reveal>
    </section>
  );
}
