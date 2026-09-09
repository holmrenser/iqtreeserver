import type { IqtreeSubmission } from "./schema";

export interface BuildArgsInput {
  options: IqtreeSubmission;
  alignmentPath: string;
  partitionPath?: string;
  outputPrefix: string;
  /** "AUTO" lets iqtree3 pick, bounded by workerMaxThreads via --threads-max */
  threads: number | "AUTO";
  workerMaxThreads?: number;
  memLimitGb?: number;
  /** Always provided - stored for reproducibility even when not user-facing. */
  seed: number;
}

/**
 * Pure function: submission options -> iqtree3 argv. Returns a flat array of
 * individually-quoted-free tokens (never "flag value" concatenated into one
 * string) so spawnSync(bin, args) can never have a crafted value reinterpreted
 * as an extra flag.
 */
export function buildIqtreeArgs(input: BuildArgsInput): string[] {
  const { options, alignmentPath, partitionPath, outputPrefix, threads, workerMaxThreads, memLimitGb, seed } =
    input;

  const args: string[] = ["-s", alignmentPath, "-pre", outputPrefix, "-seed", String(seed)];

  if (options.sequenceType !== "AUTO") {
    args.push("-st", options.sequenceType);
  }

  if (options.modelMode.mode === "auto") {
    args.push("-m", "MFP");
    if (options.modelMode.criterion !== "BIC") {
      args.push(`-${options.modelMode.criterion}`);
    }
    if (options.modelMode.restrictSet) {
      args.push("-mset", options.modelMode.restrictSet);
    }
  } else {
    args.push("-m", options.modelMode.model);
  }

  if (options.branchSupport.ultrafastBootstrap.enabled) {
    args.push("-B", String(options.branchSupport.ultrafastBootstrap.replicates));
  }
  if (options.branchSupport.shAlrt.enabled) {
    args.push("-alrt", String(options.branchSupport.shAlrt.replicates));
  }
  if (options.branchSupport.abayes) {
    args.push("-abayes");
  }
  if (options.branchSupport.standardBootstrap.enabled) {
    args.push("-b", String(options.branchSupport.standardBootstrap.replicates));
  }

  if (partitionPath) {
    args.push(`-${options.partitionMode}`, partitionPath);
  }

  if (options.outgroup) {
    args.push("-o", options.outgroup);
  }

  if (threads === "AUTO") {
    args.push("-T", "AUTO");
    if (workerMaxThreads) {
      args.push("--threads-max", String(workerMaxThreads));
    }
  } else {
    args.push("-T", String(threads));
  }

  if (memLimitGb) {
    args.push("-mem", `${memLimitGb}G`);
  }

  if (options.advanced.bnni) {
    args.push("-bnni");
  }
  if (options.advanced.asr) {
    args.push("-asr");
  }

  return args;
}
