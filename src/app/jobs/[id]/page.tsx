import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { IqtreeReportSummary } from "@/lib/iqtree/parseReport";
import { buttonVariants } from "@/components/ui/button";
import { ResultsPoller } from "./results-poller";
import { TreeSection } from "./tree-viewer";
import { ReportPanel } from "./report-panel";
import { RawLogPanel } from "./raw-log-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function JobPage({ params }: PageProps) {
  const { id } = await params;

  const job = await prisma.iqtreeJob.findUnique({
    where: { id },
    select: {
      id: true,
      alignmentFilename: true,
      submitted: true,
      started: true,
      finished: true,
      err: true,
      reportRaw: true,
      reportSummary: true,
      treeNewick: true,
      consensusTreeNewick: true,
      log: true,
      resultsZipBytes: true,
    },
  });

  if (!job) notFound();

  const isDone = job.finished !== null || job.err !== null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{job.alignmentFilename}</h1>
        <p className="font-mono text-xs text-muted-foreground">{job.id}</p>
      </div>

      {!isDone && (
        <>
          <ResultsPoller jobId={job.id} />
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {job.started ? "Running IQ-TREE..." : "Queued..."} This page updates automatically.
          </div>
        </>
      )}

      {job.err && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="mb-1 text-sm font-medium text-destructive">Job failed</p>
          <pre className="max-h-96 overflow-auto text-xs whitespace-pre-wrap text-destructive/90">{job.err}</pre>
        </div>
      )}

      {job.finished && !job.err && (
        <>
          {job.treeNewick && (
            <TreeSection treeNewick={job.treeNewick} consensusTreeNewick={job.consensusTreeNewick} />
          )}

          {job.reportSummary && <ReportPanel summary={job.reportSummary as unknown as IqtreeReportSummary} />}

          {job.resultsZipBytes !== null && (
            <a href={`/api/jobs/${job.id}/download`} className={buttonVariants({ className: "self-start" })}>
              Download full results ({formatBytes(job.resultsZipBytes)})
            </a>
          )}

          <RawLogPanel reportRaw={job.reportRaw} log={job.log} />
        </>
      )}
    </main>
  );
}
