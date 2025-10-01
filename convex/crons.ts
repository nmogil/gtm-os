import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup idempotency keys",
  { hours: 1 },
  internal.idempotency.cleanupExpiredKeys
);

export default crons;
