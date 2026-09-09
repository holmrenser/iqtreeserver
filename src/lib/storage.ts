import type { PrismaClient } from "../generated/prisma/client";
import type { IqtreeReportSummary } from "./iqtree/parseReport";

/**
 * Thin abstraction over where finished-job outputs live. Backed by Postgres
 * bytea/text columns today (mirrors blastserver's `download.results Bytes?`
 * precedent) - if data sizes ever outgrow that, only this file needs to
 * change, not its call sites in the worker or the download route.
 */

export interface JobResults {
  log: string | null;
  reportRaw: string | null;
  reportSummary: IqtreeReportSummary;
  treeNewick: string | null;
  consensusTreeNewick: string | null;
  resultsZip: Buffer;
}

export async function putResults(prisma: PrismaClient, jobId: string, results: JobResults): Promise<void> {
  await prisma.iqtreeJob.update({
    where: { id: jobId },
    data: {
      log: results.log,
      reportRaw: results.reportRaw,
      reportSummary: results.reportSummary as object,
      treeNewick: results.treeNewick,
      consensusTreeNewick: results.consensusTreeNewick,
      resultsZip: Uint8Array.from(results.resultsZip),
      resultsZipBytes: results.resultsZip.byteLength,
      finished: new Date(),
    },
  });
}

export interface StoredZip {
  resultsZip: Buffer;
  resultsZipBytes: number;
}

export async function getResultsZip(prisma: PrismaClient, jobId: string): Promise<StoredZip | null> {
  const row = await prisma.iqtreeJob.findUnique({
    where: { id: jobId },
    select: { resultsZip: true, resultsZipBytes: true },
  });
  if (!row?.resultsZip) return null;
  return { resultsZip: Buffer.from(row.resultsZip), resultsZipBytes: row.resultsZipBytes ?? row.resultsZip.byteLength };
}
