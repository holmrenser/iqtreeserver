import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),

  JOB_RETRY_LIMIT: z.coerce.number().int().min(0).default(2),
  JOB_EXPIRE_SECONDS: z.coerce.number().int().positive().default(4 * 3600),
  PGBOSS_MAX_CONNECTIONS: z.coerce.number().int().positive().default(5),

  IQTREE_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(3 * 3600_000),
  IQTREE_WORKER_THREADS: z.string().default("AUTO"),
  IQTREE_WORKER_MAX_THREADS: z.coerce.number().int().positive().default(4),
  IQTREE_WORKER_MEM_GB: z.coerce.number().int().positive().default(4),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MAX_BUFFER_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  MAX_RESULTS_ZIP_BYTES: z.coerce.number().int().positive().default(500 * 1024 * 1024),
  DATA_DIR: z.string().default("/data"),

  // --- Email notifications (all optional; unset SMTP_HOST disables sending
  // entirely - see src/lib/email.ts) ---
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // z.coerce.boolean() would treat the *string* "false" as truthy (any
  // non-empty string coerces to true) - this needs an actual string match.
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("iqtreeserver <no-reply@iqtreeserver.local>"),
  APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  if (parsed.data.IQTREE_JOB_TIMEOUT_MS >= parsed.data.JOB_EXPIRE_SECONDS * 1000) {
    throw new Error(
      "IQTREE_JOB_TIMEOUT_MS must be less than JOB_EXPIRE_SECONDS * 1000, otherwise pg-boss " +
        "may treat a still-running job as expired before the worker's own timeout fires.",
    );
  }
  return parsed.data;
}

// Lazy + memoized: validated only on first access, not at module import
// time. Next.js's `next build` imports every route module to statically
// collect its config (runtime, dynamic, etc) without invoking any handler -
// an eager `loadEnv()` here would fail that step in the builder stage, which
// has no real DATABASE_URL and shouldn't need one just to build.
let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}
