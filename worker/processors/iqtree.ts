import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { getEnv } from "../../src/lib/env";
import { buildIqtreeArgs } from "../../src/lib/iqtree/buildArgs";
import { OPERATIONAL_ONLY_SUFFIXES } from "../../src/lib/iqtree/outputFiles";
import { parseReport } from "../../src/lib/iqtree/parseReport";
import { iqtreeSubmissionSchema, type StoredJobParameters } from "../../src/lib/iqtree/schema";
import { putResults } from "../../src/lib/storage";
import { sendJobNotification } from "../../src/lib/email";

const IQTREE_BIN = process.env.IQTREE_BIN ?? "iqtree3";

class IqtreeRunError extends Error {}

export async function runIqtreeJob(prisma: PrismaClient, jobId: string): Promise<void> {
  const env = getEnv();
  const row = await prisma.iqtreeJob.findUniqueOrThrow({ where: { id: jobId } });

  await prisma.iqtreeJob.update({ where: { id: jobId }, data: { started: new Date() } });

  const jobDir = path.join(env.DATA_DIR, "jobs", jobId);

  try {
    // Always start clean: a stale .ckp.gz or partial output from a prior
    // failed attempt must never leak into a retry, and this means -redo is
    // never needed.
    await rm(jobDir, { recursive: true, force: true });
    await mkdir(jobDir, { recursive: true });

    const stored = row.parameters as unknown as StoredJobParameters;
    const options = iqtreeSubmissionSchema.parse(stored.options);

    const alignmentPath = path.join(jobDir, `input${path.extname(row.alignmentFilename) || ".fasta"}`);
    await writeFile(alignmentPath, Buffer.from(row.alignmentData));

    let partitionPath: string | undefined;
    if (row.partitionData && row.partitionFilename) {
      partitionPath = path.join(jobDir, `partition${path.extname(row.partitionFilename) || ".nex"}`);
      await writeFile(partitionPath, Buffer.from(row.partitionData));
    }

    const outputPrefix = path.join(jobDir, "result");
    const threads = env.IQTREE_WORKER_THREADS === "AUTO" ? ("AUTO" as const) : Number(env.IQTREE_WORKER_THREADS);

    const args = buildIqtreeArgs({
      options,
      alignmentPath,
      partitionPath,
      outputPrefix,
      threads,
      workerMaxThreads: env.IQTREE_WORKER_MAX_THREADS,
      memLimitGb: env.IQTREE_WORKER_MEM_GB,
      seed: stored.seed,
    });

    const result = spawnSync(IQTREE_BIN, args, {
      timeout: env.IQTREE_JOB_TIMEOUT_MS,
      maxBuffer: env.MAX_BUFFER_BYTES,
      encoding: "utf8",
    });

    if (result.error || result.status !== 0 || result.signal) {
      const logTail = await readIfExists(`${outputPrefix}.log`);
      const reason = result.signal
        ? `iqtree3 was killed by signal ${result.signal} (likely the ${env.IQTREE_JOB_TIMEOUT_MS}ms timeout)`
        : result.error
          ? `iqtree3 failed to start: ${result.error.message}`
          : `iqtree3 exited with status ${result.status}`;
      throw new IqtreeRunError(
        [reason, result.stderr?.trim(), logTail ? `--- log tail ---\n${tail(logTail, 4000)}` : undefined]
          .filter(Boolean)
          .join("\n\n"),
      );
    }

    const reportRaw = await readIfExists(`${outputPrefix}.iqtree`);
    const log = await readIfExists(`${outputPrefix}.log`);
    const treeNewick = await readIfExists(`${outputPrefix}.treefile`);
    const consensusTreeNewick = await readIfExists(`${outputPrefix}.contree`);

    const reportSummary = parseReport(reportRaw ?? "");

    const resultsZip = await zipDirectory(jobDir, OPERATIONAL_ONLY_SUFFIXES);
    if (resultsZip.byteLength > env.MAX_RESULTS_ZIP_BYTES) {
      throw new IqtreeRunError(
        `Results archive (${resultsZip.byteLength} bytes) exceeds MAX_RESULTS_ZIP_BYTES (${env.MAX_RESULTS_ZIP_BYTES}).`,
      );
    }

    await putResults(prisma, jobId, {
      log,
      reportRaw,
      reportSummary,
      treeNewick,
      consensusTreeNewick,
      resultsZip,
    });

    if (row.notifyEmail) {
      await sendJobNotification({
        to: row.notifyEmail,
        jobId,
        alignmentFilename: row.alignmentFilename,
        outcome: "completed",
      });
    }
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function tail(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(-maxChars) : text;
}

async function zipDirectory(dir: string, excludeSuffixes: string[]): Promise<Buffer> {
  const entries = await readdir(dir);
  const files = entries.filter((name) => !excludeSuffixes.some((suffix) => name.endsWith(suffix)));

  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    for (const name of files) {
      archive.file(path.join(dir, name), { name });
    }

    void archive.finalize();
  });
}
