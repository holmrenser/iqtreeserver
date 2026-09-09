import { createHash } from "node:crypto";
import objectHash from "object-hash";
import type { IqtreeSubmission } from "./iqtree/schema";

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export interface JobIdInput {
  options: IqtreeSubmission;
  alignmentData: Buffer;
  partitionData?: Buffer;
}

/**
 * Deterministic job id, mirroring blastserver's hash(parameters).slice(0, N)
 * dedup pattern - except here the alignment/partition file *content* is part
 * of what makes two submissions identical, not just the options. We hash the
 * (potentially multi-MB) buffers with sha256 first and feed only the
 * resulting digest strings into object-hash, rather than handing it the raw
 * buffers directly (object-hash's deep-equality traversal isn't built for
 * that, and pre-hashing gives stable, debuggable digests we also store
 * alongside `parameters` on the row).
 */
export function computeJobId(input: JobIdInput): string {
  const alignmentSha256 = sha256Hex(input.alignmentData);
  const partitionSha256 = input.partitionData ? sha256Hex(input.partitionData) : null;

  const digest = objectHash(
    { options: input.options, alignmentSha256, partitionSha256 },
    { algorithm: "sha256", unorderedArrays: false },
  );

  return digest.slice(0, 24);
}
