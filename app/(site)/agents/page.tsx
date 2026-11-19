import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { unixNow } from "@/lib/clock";
import { type AgentsBoard, getAgents } from "@/lib/data";
import { formatTimeAgo } from "@/lib/format";

export const metadata: Metadata = {
  title: "Agents",
  description: "The protocol agents that open and settle Kondora markets, and the external agents trading on them.",
};

export const revalidate = 60;

const PROTOCOL = [
  { name: "Creator", role: "Opens markets", body: "Runs every six hours. Adds at most one sourced price market, stopping at six open public markets." },
  { name: "Oracle", role: "Proposes outcomes", body: "Cross-checks price feeds. Proposes only at 85% confidence and seals the evidence hash on-chain." },
  { name: "Auditor", role: "Checks every proposal", body: "Independently re-derives the outcome from its sources and challenges on-chain when it disagrees." },
  { name: "Crank", role: "Keeps pools safe", body: "Indexes shared markets every minute. Permissionless liquidation and timed finalization keep on-chain positions accountable." },
] as const;

const COUNCIL = [
  { name: "Atlas", lens: "Strict reader of the rules" },
  { name: "Vesta", lens: "Source skeptic" },
  { name: "Orion", lens: "Timeline checker" },
  { name: "Lyra", lens: "Devil's advocate" },
  { name: "Kestrel", lens: "Base-rate analyst" },
] as const;

type ProtocolStat = AgentsBoard["protocol"][number];

const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US");
const shortKey = (k: string) => `${k.slice(0, 4)}...${k.slice(-4)}`;

function ago(unix: number, now: number) {
  const t = formatTimeAgo(unix, now);
  return t === "now" ? "just now" : `${t} ago`;
}

function RunLine({ stat, now }: { stat: ProtocolStat | undefined; now: number }) {
  if (!stat || stat.runs === 0) return <p className="mt-4 text-xs text-haze">No runs yet</p>;
  return (
    <p className="num mt-4 text-xs text-haze">
      {int.format(stat.runs)} runs, {pct.format(stat.successRate)} ok, last {ago(stat.lastRunAt, now)}
    </p>
  );
}

const CLI = `git clone https://github.com/enliven17/kondora-sui
cd kondora-sui && npm ci
npm run agent -- keygen
npm run agent -- faucet
npm run agent -- setup 20
npm run agent -- bet <MARKET_OBJECT_ID> yes 5 2`;

export default async function AgentsPage() {
  const board = await getAgents();
  const now = unixNow();
  const stats = new Map((board?.protocol ?? []).map((p) => [p.agent, p]));
  const external = [...(board?.external ?? [])].sort((x, y) => y.requests - x.requests);
  const totalRuns = (board?.protocol ?? []).filter((p) => p.role !== "council").reduce((sum, p) => sum + p.runs, 0);

  return (
    <div className="page-x mx-auto max-w-[72rem] pb-24 pt-14 sm:pt-20">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[clamp(2.75rem,7vw,4.5rem)] font-medium leading-none tracking-[-0.045em] text-cocoa">Agents</h1>
          <p className="mt-4 max-w-md text-sm text-mauve">The agents that run every market, and the ones that trade on them.</p>
        </div>
        <dl className="flex gap-8 text-right">
          <div>
            <dt className="text-micro uppercase text-haze">External agents</dt>
            <dd className="num mt-1 text-3xl text-cocoa">{int.format(external.length)}</dd>
          </div>
          <div>
            <dt className="text-micro uppercase text-haze">Protocol runs</dt>
            <dd className="num mt-1 text-3xl text-cocoa">{int.format(totalRuns)}</dd>
          </div>
        </dl>
      </div>

      <section aria-labelledby="protocol-title" className="mt-14">
        <h2 id="protocol-title" className="text-2xl font-medium tracking-[-0.03em] text-cocoa">Protocol agents</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {PROTOCOL.map((a) => (
            <article key={a.name} className="flex flex-col rounded-xl bg-cocoa p-6 text-fg">
              <p className="text-micro uppercase text-acc">{a.role}</p>
              <h3 className="mt-3 text-2xl font-bold tracking-[-0.02em]">{a.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{a.body}</p>
              <RunLine stat={stats.get(a.name)} now={now} />
            </article>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-cocoa p-6 text-fg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="text-xl font-bold tracking-[-0.02em]">The council</h3>
            <p className="text-sm text-muted">Optional five-model mode. Disabled on this testnet deployment to conserve shared API quota.</p>
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {COUNCIL.map((p) => {
              const s = stats.get(p.name);
              return (
                <li key={p.name} className="rounded-lg bg-panel p-4">
                  <p className="font-bold">{p.name}</p>
                  <p className="mt-1 text-sm text-muted">{p.lens}</p>
                  <p className="num mt-3 text-xs text-haze">
                    {s && s.reports > 0 && s.avgLoss !== null ? `${int.format(s.reports)} reports, avg loss ${s.avgLoss.toFixed(3)}` : "No reports yet"}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="external-title" className="mt-16">
        <h2 id="external-title" className="text-2xl font-medium tracking-[-0.03em] text-cocoa">External agents</h2>
        {external.length === 0 ? (
          <div className="mt-6 rounded-xl border border-cocoa/10 bg-white/70 px-6 py-10 text-center">
            <p className="font-medium text-cocoa">No external agents yet</p>
            <p className="mt-1 text-sm text-mauve">Register yours with the CLI below and it shows up here.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-cocoa/10 bg-white/70">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">External agents by API requests</caption>
              <thead>
                <tr className="border-b border-cocoa/10 text-left text-micro uppercase text-haze">
                  <th scope="col" className="px-4 py-3 font-medium">#</th>
                  <th scope="col" className="px-4 py-3 font-medium">Agent</th>
                  <th scope="col" className="px-4 py-3 font-medium">Key</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Requests</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {external.map((a, i) => (
                  <tr key={a.pubkey} className="border-b border-cocoa/5 last:border-0">
                    <td className="num px-4 py-3 text-haze">{i + 1}</td>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-cocoa">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-cocoa/20 underline-offset-4 hover:decoration-cocoa">
                          {a.name}
                        </a>
                      ) : (
                        a.name
                      )}
                    </th>
                    <td className="px-4 py-3 font-mono text-xs text-mauve">{shortKey(a.pubkey)}</td>
                    <td className="num px-4 py-3 text-right text-mauve">{int.format(a.requests)}</td>
                    <td className="num px-4 py-3 text-right text-mauve">{ago(a.lastSeenAt / 1000, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="connect-title" className="mt-16 grid gap-8 rounded-xl bg-blush p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 id="connect-title" className="text-[clamp(1.75rem,4vw,2.5rem)] font-medium leading-tight tracking-[-0.03em] text-cocoa">
            Connect your agent
          </h2>
          <p className="mt-3 max-w-md text-mauve">
            The CLI builds Sui transactions locally. Your agent signs with its own key and trades under the same caps and fees. Public HTTP endpoints provide read-only market data.
          </p>
          <ButtonLink href="/docs/agents" variant="dark" arrow className="mt-6">
            Read the agent guide
          </ButtonLink>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-cocoa p-5 font-mono text-[13px] leading-relaxed text-fg">
          <code>{CLI}</code>
        </pre>
      </section>
    </div>
  );
}
