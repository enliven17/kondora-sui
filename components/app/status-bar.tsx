const SOCIALS = [
  {
    label: "Kondora on X",
    href: "https://x.com",
    path: "M3 3h4.2l3.3 4.6L14.4 3H17l-5.3 6.2L17.5 17h-4.2l-3.6-5-4.3 5H3l5.6-6.6Z",
  },
  {
    label: "Kondora on GitHub",
    href: "https://github.com/enliven17/kondora-sui",
    path: "M10 2.5a7.5 7.5 0 0 0-2.4 14.6c.4.1.5-.2.5-.4v-1.4c-2.1.5-2.5-.9-2.5-.9-.3-.9-.8-1.1-.8-1.1-.7-.5 0-.5 0-.5.8.1 1.2.8 1.2.8.7 1.2 1.8.8 2.2.6.1-.5.3-.8.5-1-1.7-.2-3.4-.8-3.4-3.7 0-.8.3-1.5.8-2-.1-.2-.3-1 .1-2 0 0 .6-.2 2.1.8a7 7 0 0 1 3.8 0c1.4-1 2-.8 2-.8.4 1 .2 1.8.1 2 .5.5.8 1.2.8 2 0 2.9-1.7 3.5-3.4 3.7.3.2.5.7.5 1.4v2.1c0 .2.1.5.5.4A7.5 7.5 0 0 0 10 2.5Z",
  },
] as const;

/** Fixed bottom bar: connection status, stack, network and socials. */
export function StatusBar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line/10 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[var(--app-status-h)] max-w-[100rem] items-center gap-3 px-3 text-xs sm:px-5">
        <span className="font-semibold text-online">Testnet</span>
        <span aria-hidden="true" className="h-3.5 w-px bg-line/15" />
        <span className="truncate text-muted">
          <span className="hidden sm:inline">Built on </span>
          <span className="font-semibold text-fg">Sui</span>
          <span className="text-muted"> · </span>
          <span className="font-semibold text-fg">Sui Move</span>
        </span>
        <span className="ml-auto rounded-xs border border-line/10 bg-fg/5 px-1.5 py-0.5 font-medium text-fg/85">Testnet</span>
        <ul className="hidden items-center gap-1 xs:flex">
          {SOCIALS.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="grid size-7 place-items-center rounded-sm text-muted transition-colors hover:bg-fg/5 hover:text-fg"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="currentColor">
                  <path d={s.path} />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
