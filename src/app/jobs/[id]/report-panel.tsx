import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IqtreeReportSummary } from "@/lib/iqtree/parseReport";

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export function ReportPanel({ summary }: { summary: IqtreeReportSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="IQ-TREE version" value={summary.version} />
          <Stat label="Taxa" value={summary.taxonCount} />
          <Stat label="Alignment length" value={summary.alignmentLength} />
          <Stat label="Data type" value={summary.dataType} />
          <Stat
            label="Best model"
            value={summary.bestModel ? `${summary.bestModel}${summary.modelCriterion ? ` (${summary.modelCriterion})` : ""}` : null}
          />
          <Stat label="Log-likelihood" value={summary.logLikelihood} />
          <Stat label="Tree length" value={summary.totalTreeLength} />
          <Stat label="Run time" value={summary.wallClockSeconds ? `${summary.wallClockSeconds.toFixed(1)}s` : null} />
        </dl>
      </CardContent>
    </Card>
  );
}
