// Early connections for the origins a route hits right after hydration. Rendered as real <link>
// elements (React 19 hoists them into <head>), so the browser starts DNS/TLS from the HTML itself
// rather than after the Flight payload is processed.

import { SUI_RPC } from "./sui/config";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function Preconnect({ urls }: { urls: Array<string | undefined> }) {
  const origins = [...new Set(urls.map(originOf).filter((o): o is string => o !== null))];
  return (
    <>
      {origins.map((href) => (
        <link key={href} rel="preconnect" href={href} crossOrigin="anonymous" />
      ))}
    </>
  );
}

/** Convex: the app shell opens its websocket on every app route. */
export function PreconnectConvex() {
  return <Preconnect urls={[process.env.NEXT_PUBLIC_CONVEX_URL]} />;
}

/** Sui base RPC and the Ephemeral Rollup: only routes that read live chain state (market detail, portfolio). */
export function PreconnectChain() {
  return <Preconnect urls={[SUI_RPC]} />;
}
