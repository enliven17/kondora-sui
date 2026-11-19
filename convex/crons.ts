import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval("Sui indexer", { minutes: 1 }, internal.indexer.run, {});
crons.interval("oracle and settlement", { minutes: 2 }, internal.oracle.run, {});
crons.interval("creator", { hours: 6 }, internal.creator.run, {});
export default crons;
