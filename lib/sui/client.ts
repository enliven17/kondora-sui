import { SuiGrpcClient } from "@mysten/sui/grpc";
import { NETWORK, SUI_RPC } from "./config";
export const sui = new SuiGrpcClient({ network: NETWORK, baseUrl: SUI_RPC });
