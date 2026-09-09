export interface IqtreeReportSummary {
  version: string | null;
  taxonCount: number | null;
  alignmentLength: number | null;
  dataType: string | null;
  bestModel: string | null;
  modelCriterion: string | null;
  logLikelihood: number | null;
  logLikelihoodStdError: number | null;
  totalTreeLength: number | null;
  wallClockSeconds: number | null;
}

/**
 * Independent, null-safe regex extractors over a raw `.iqtree` report. There
 * is no official parser for this format, and it can drift across IQ-TREE
 * versions - every extractor here returns null on no-match rather than
 * throwing, because a cosmetic report-format change should never fail an
 * otherwise-successful multi-hour job.
 *
 * Verified against a real IQ-TREE 3.1.3 report (see
 * test/fixtures/alignments/real-report.iqtree, captured with -m MFP -B 1000
 * -alrt 1000) - the version line changed from IQ-TREE 2's
 * "IQ-TREE multicore version X.X.X" to "IQ-TREE X.X.X built <date>", every
 * other line format used below is unchanged from IQ-TREE 2.
 */
export function parseReport(text: string): IqtreeReportSummary {
  return {
    version: extractVersion(text),
    ...extractInputData(text),
    ...extractBestModel(text),
    ...extractLogLikelihood(text),
    totalTreeLength: extractTreeLength(text),
    wallClockSeconds: extractWallClockSeconds(text),
  };
}

function extractVersion(text: string): string | null {
  const m = text.match(/^IQ-TREE (\d+\.\d+\.\d+) built/m);
  return m ? m[1] : null;
}

function extractInputData(
  text: string,
): Pick<IqtreeReportSummary, "taxonCount" | "alignmentLength" | "dataType"> {
  const m = text.match(/^Input data: (\d+) sequences? with (\d+) (\w+) sites/m);
  if (!m) return { taxonCount: null, alignmentLength: null, dataType: null };
  return { taxonCount: Number(m[1]), alignmentLength: Number(m[2]), dataType: m[3] };
}

function extractBestModel(
  text: string,
): Pick<IqtreeReportSummary, "bestModel" | "modelCriterion"> {
  const finderMatch = text.match(/^Best-fit model according to (\w+): (.+)$/m);
  if (finderMatch) {
    return { modelCriterion: finderMatch[1], bestModel: finderMatch[2].trim() };
  }
  // No ModelFinder run (manual model): fall back to the substitution-model line.
  const fixedMatch = text.match(/^Model of substitution: (.+)$/m);
  if (fixedMatch) {
    return { modelCriterion: null, bestModel: fixedMatch[1].trim() };
  }
  return { bestModel: null, modelCriterion: null };
}

function extractLogLikelihood(
  text: string,
): Pick<IqtreeReportSummary, "logLikelihood" | "logLikelihoodStdError"> {
  const m = text.match(/^Log-likelihood of the tree: (-?[\d.]+)(?: \(s\.e\. ([\d.]+)\))?/m);
  if (!m) return { logLikelihood: null, logLikelihoodStdError: null };
  return {
    logLikelihood: Number(m[1]),
    logLikelihoodStdError: m[2] ? Number(m[2]) : null,
  };
}

function extractTreeLength(text: string): number | null {
  const m = text.match(/^Total tree length \(sum of branch lengths\): ([\d.]+)/m);
  return m ? Number(m[1]) : null;
}

function extractWallClockSeconds(text: string): number | null {
  const m = text.match(/^Total wall-clock time used: ([\d.]+) seconds/m);
  return m ? Number(m[1]) : null;
}
