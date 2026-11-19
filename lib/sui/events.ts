import { fromBase64 } from "@mysten/sui/utils";
import { PACKAGE_ID } from "./config";
import { TradeEventBCS } from "./schema";
export const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
export async function tradeEvents(cursor: string | null = null) {
  const response = await fetch(SUI_GRAPHQL, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ query: `query($type:String!,$cursor:String){events(filter:{type:$type},first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{contents{bcs} transaction{digest} sequenceNumber}}}`,
      variables: { type: `${PACKAGE_ID}::market::TradeEvent`, cursor } }),
  });
  if (!response.ok) throw new Error(`Sui event query: ${response.status}`);
  const result = await response.json() as {
    errors?: { message: string }[];
    data?: { events: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { contents: { bcs: string }; transaction: { digest: string }; sequenceNumber: number }[] } };
  };
  if (result.errors || !result.data) throw new Error(result.errors?.map((e) => e.message).join("; ") ?? "No event data");
  return { ...result.data.events.pageInfo, events: result.data.events.nodes.map((node) => ({ ...TradeEventBCS.parse(fromBase64(node.contents.bcs)), digest: node.transaction.digest, sequence: node.sequenceNumber })) };
}
