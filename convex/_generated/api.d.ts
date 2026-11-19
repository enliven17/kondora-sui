/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as creator from "../creator.js";
import type * as crons from "../crons.js";
import type * as evidence from "../evidence.js";
import type * as faucet from "../faucet.js";
import type * as faucetStore from "../faucetStore.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as indexer from "../indexer.js";
import type * as markets from "../markets.js";
import type * as oracle from "../oracle.js";
import type * as stats from "../stats.js";
import type * as sui from "../sui.js";
import type * as suiStore from "../suiStore.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  creator: typeof creator;
  crons: typeof crons;
  evidence: typeof evidence;
  faucet: typeof faucet;
  faucetStore: typeof faucetStore;
  health: typeof health;
  http: typeof http;
  indexer: typeof indexer;
  markets: typeof markets;
  oracle: typeof oracle;
  stats: typeof stats;
  sui: typeof sui;
  suiStore: typeof suiStore;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
