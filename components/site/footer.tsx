import Link from "next/link";

import { KondoraLockup } from "@/components/brand/logo";
import { FooterWordmark } from "./footer-wordmark";

/** Placeholder social destinations until the official handles are public. */
const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/markets", label: "Markets" },
      { href: "/portfolio", label: "Portfolio" },
      { href: "/stats", label: "Stats" },
      { href: "/agents", label: "Agents" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/docs/api", label: "API" },
      { href: "/docs/agents", label: "Bring your own agent" },
      { href: "/brand", label: "Brand kit" },
    ],
  },
  {
    title: "Socials",
    links: [
      { href: "https://x.com", label: "X" },
      { href: "https://t.me", label: "Telegram" },
      { href: "https://github.com", label: "GitHub" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-cocoa text-fg">
      <div className="page-x mx-auto max-w-page pt-14">
        <Link href="/" aria-label="Kondora home" className="inline-flex text-fg">
          <KondoraLockup className="h-6" title="" />
        </Link>

        <div className="mt-8 grid gap-12 border-t border-line/10 pt-10 lg:grid-cols-[1fr_auto]">
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Leveraged positions can be liquidated. Testnet, test funds only. Markets are opened and settled by agents;
            read the risks before you trade.
          </p>

          <div className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 lg:gap-x-16">
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-sm font-medium text-acc">{col.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => {
                    const external = link.href.startsWith("http");
                    return (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm text-fg/80 transition-colors hover:text-fg"
                          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <p className="mt-16 text-sm text-haze">© {new Date().getFullYear()} Kondora</p>
      </div>

      <div className="page-x mx-auto -mb-[4%] mt-6 max-w-page">
        <FooterWordmark />
      </div>
    </footer>
  );
}
