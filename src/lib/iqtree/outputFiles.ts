import type { IqtreeSubmission } from "./schema";

/**
 * Files iqtree3 writes purely for its own internal/operational use (resume
 * checkpoints etc). Never useful to an end user - excluded from the
 * downloadable results zip.
 */
export const OPERATIONAL_ONLY_SUFFIXES = [".ckp.gz"];

const hasBranchSupport = (options: IqtreeSubmission): boolean =>
  options.branchSupport.ultrafastBootstrap.enabled || options.branchSupport.standardBootstrap.enabled;

/**
 * File suffixes iqtree3 is expected to produce for a given option set. Used
 * by the worker to know which files to attempt reading (existence is always
 * re-checked on disk - this is a hint, not a guarantee, since IQ-TREE's own
 * output set can vary by data/version in ways this list won't perfectly
 * predict).
 */
export function expectedOutputSuffixes(options: IqtreeSubmission): string[] {
  const suffixes = [".iqtree", ".log", ".treefile", ".bionj", ".mldist", ".ckp.gz"];
  if (hasBranchSupport(options)) {
    suffixes.push(".contree", ".splits.nex");
  }
  if (options.branchSupport.ultrafastBootstrap.enabled) {
    suffixes.push(".ufboot");
  }
  if (options.advanced.asr) {
    suffixes.push(".state");
  }
  return suffixes;
}
