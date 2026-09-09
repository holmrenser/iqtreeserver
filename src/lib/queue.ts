import { getEnv } from "./env";

/**
 * Single queue for the whole app - unlike blastserver's blast+download split,
 * zip creation happens inside the same job (see worker/processors/iqtree.ts),
 * so there's no second async operation that needs its own queue.
 *
 * pg-boss is transport + retry/expiry only. The `iqtreejob` Postgres table
 * (via Prisma) is the single source of truth for job status - the app and
 * worker both read/write status there directly, never by querying pg-boss's
 * own job state.
 */
export const IQTREE_QUEUE = "iqtree-jobs";

export function getJobRetryLimit(): number {
  return getEnv().JOB_RETRY_LIMIT;
}

/**
 * How long pg-boss waits before considering an in-flight job expired/lost.
 * IQ-TREE runs with ModelFinder + bootstrap can legitimately take hours, so
 * this must stay well above blastserver's old BLAST-tuned default (1800s) -
 * see IQTREE_JOB_TIMEOUT_MS below, which is asserted (in src/lib/env.ts) to
 * always be smaller, so the worker's own process-level timeout fires first
 * and produces a clean error row instead of a silent pg-boss-side retry race.
 */
export function getJobExpireSeconds(): number {
  return getEnv().JOB_EXPIRE_SECONDS;
}

export function getPgBossMaxConnections(): number {
  return getEnv().PGBOSS_MAX_CONNECTIONS;
}

/** Keep pg-boss payloads small - the worker re-fetches the full row by id. */
export interface IqtreeJobPayload {
  jobId: string;
}
