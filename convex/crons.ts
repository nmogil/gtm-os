import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup idempotency keys",
  { hours: 1 },
  internal.idempotency.cleanupExpiredKeys
);

crons.interval(
  "process pending sends",
  { minutes: 1 },
  internal.scheduler.processPendingSends
);

export default crons;
