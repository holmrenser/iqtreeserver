# iqtreeserver

A webapp for running [IQ-TREE 3](https://github.com/iqtree/iqtree3) phylogenetic
inference jobs: upload an alignment, pick options, watch the job run, view the
resulting tree and model-selection report in the browser, and download the
full result set as a zip.

Architecture mirrors [blastserver](https://github.com/holmrenser/blastserver)'s
current (pg-boss) design: a single Next.js app, a separate worker process that
spawns the `iqtree3` binary, and Postgres as both the database and (via
[pg-boss](https://github.com/timgit/pg-boss)) the job queue - no Redis.

```
Browser -> Next.js app (submit form, results page, API routes)
             |
             +-> pg-boss (Postgres-backed queue) -> iqtreeworker -> spawnSync("iqtree3", ...)
             |
             +-> Postgres (Prisma): iqtreejob table is the source of truth
                 for job status - pg-boss is transport/retry only.
```

## Prerequisites

- Node.js 22+
- Docker (for Postgres locally, and for the full containerized stack)
- The `iqtree3` binary on your `PATH` (or set `IQTREE_BIN` to its path) if you
  want to run the worker outside Docker - see
  [github.com/iqtree/iqtree3/releases](https://github.com/iqtree/iqtree3/releases)
  for a prebuilt tarball matching your OS/arch.

## Local development

```bash
npm install
cp .env.example .env               # edit if your Postgres isn't on localhost:5432
docker compose -f docker-compose.dev.yml up -d postgres
npx prisma migrate dev
npm run dev                        # Next.js app on :3000
npm run worker:dev                 # worker, in a second terminal (tsx --watch)
```

The worker needs `iqtree3` resolvable - either install it and put it on
`PATH`, or run e.g. `IQTREE_BIN=/path/to/iqtree3 npm run worker:dev`.

## Running the full stack in Docker

```bash
docker compose up --build
```

This builds and starts `postgres`, a one-shot `migrate` service
(`prisma migrate deploy`), the `app`, and two `iqtreeworker` replicas. The app
is served on [http://localhost:3000](http://localhost:3000). The worker image
downloads and checksum-verifies the `iqtree3` binary for whatever platform
it's built on (`amd64` or `arm64` - see `worker.Dockerfile`).

## Deploying under a subpath

To serve the app behind a reverse proxy at a subpath (e.g.
`bioinformatics.nl/iqtree`), set two env vars before building/running:

- `NEXT_PUBLIC_BASE_PATH=/iqtree` - a **build-time** arg (see `app.Dockerfile`,
  `docker-compose.yml`'s `app.build.args`); it's inlined into the client
  bundle, so changing it requires a rebuild. Leave unset to serve from the
  root.
- `APP_URL=https://bioinformatics.nl/iqtree` - used to build the links in
  job-completion emails (`src/lib/email.ts`); include the subpath here too.

Your reverse proxy must forward `/iqtree/*` through unmodified (no
path-stripping) - `basePath` expects to see the full `/iqtree/...` path on
incoming requests.

## Tests

```bash
npm run test:unit          # pure functions - no DB, no network, no binary
npm run test:integration   # API routes against a real Postgres (DATABASE_URL)
npm run test:smoke         # a real iqtree3 run end-to-end; skips if IQTREE_BIN/PATH has no binary
```

## Project layout

- `src/lib/iqtree/` - the IQ-TREE domain logic shared by the app and the
  worker: the zod submission schema, the CLI arg builder, and the `.iqtree`
  report parser.
- `src/lib/hash.ts` - job-id derivation (sha256 of the alignment/partition
  content + validated options; the seed is deliberately excluded so an
  identical resubmission dedupes to the same job).
- `src/lib/storage.ts` - the Postgres-bytea-backed results storage
  abstraction (swap this if results ever need to move to object storage).
- `worker/` - the pg-boss worker: `runtime.ts` is a generic retry-aware
  runtime, `processors/iqtree.ts` is the actual job (materialize alignment ->
  spawn `iqtree3` -> parse report -> zip results -> persist -> clean up).
  Runs via `tsx` rather than a `tsc` build - see the comment in
  `worker.Dockerfile` for why (the generated Prisma client assumes a
  bundler-style consumer, which `tsx`'s esbuild-based loader provides and a
  plain `tsc`+`node` build does not).
- `src/app/api/submit`, `src/app/api/jobs/[id]` - submission and status/download
  routes.
- `src/app/api/queue` + `src/app/queue-status.tsx` - a small SWR-polled badge
  (mounted in the nav header) showing waiting/running/completed/failed counts,
  derived directly from the `iqtreejob` table's own status columns - mirrors
  blastserver's `/api/queue`.
- `src/lib/tree/` - a from-scratch Newick parser + rectangular-cladogram
  layout, and `src/app/jobs/[id]/tree-viewer.tsx` renders it as plain SVG via
  declarative JSX (no d3/phylotree.js - see the comment at the top of
  tree-viewer.tsx for why: an imperative DOM-manipulating tree library fighting
  React's own reconciliation was the likely cause of an earlier bug where the
  tree didn't render).
- `src/lib/email.ts` - optional job-completion/failure email notifications via
  SMTP (nodemailer). **Disabled by default** - the submission form's email
  field is greyed out and the API rejects a `notifyEmail` value until
  `SMTP_HOST` is set, so there's no path where a user asks for an email and
  silently doesn't get one. See [`docs/email-notifications.md`](docs/email-notifications.md)
  for what's implemented, what's been verified, and what's needed to turn it on.
- `src/app/jobs/[id]/` - the results page (Server Component) plus its client
  islands: a self-cancelling SWR poller, and the tree viewer above.

## Changing the Prisma schema

Always regenerate via `npm run prisma:generate` (not a bare `npx prisma
generate`) - it also re-creates `src/generated/prisma/package.json`
(`{"type":"module"}`), which `prisma generate` wipes on every run and which
the worker's `tsx` runtime needs to load the generated client correctly (see
the `worker.Dockerfile` comment referenced above). `worker.Dockerfile` and
`app.Dockerfile` do the same in their build stages.

## Environment variables

See `.env.example` for the full list with defaults. The one worth calling
out: `JOB_EXPIRE_SECONDS` (how long pg-boss waits before treating an in-flight
job as lost) must stay above `IQTREE_JOB_TIMEOUT_MS` (the worker's own
wall-clock cap on a single `iqtree3` run) - `src/lib/env.ts` asserts this at
startup, since IQ-TREE runs with ModelFinder and bootstrap can legitimately
take hours.
