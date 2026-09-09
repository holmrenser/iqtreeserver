import { describe, expect, it } from "vitest";
import { computeJobId, sha256Hex } from "@/lib/hash";
import { iqtreeSubmissionSchema, type IqtreeSubmission } from "@/lib/iqtree/schema";

const options: IqtreeSubmission = iqtreeSubmissionSchema.parse({
  sequenceType: "AUTO",
  modelMode: { mode: "auto", criterion: "BIC" },
  branchSupport: {
    ultrafastBootstrap: { enabled: true, replicates: 1000 },
    shAlrt: { enabled: true, replicates: 1000 },
    abayes: false,
    standardBootstrap: { enabled: false, replicates: 100 },
  },
  partitionMode: "p",
  advanced: { bnni: false, asr: false },
});

describe("sha256Hex", () => {
  it("is deterministic", () => {
    const data = Buffer.from("hello world");
    expect(sha256Hex(data)).toBe(sha256Hex(Buffer.from("hello world")));
  });

  it("differs for different content", () => {
    expect(sha256Hex(Buffer.from("a"))).not.toBe(sha256Hex(Buffer.from("b")));
  });
});

describe("computeJobId", () => {
  it("is deterministic for identical options and file content", () => {
    const alignmentData = Buffer.from(">a\nACGT\n");
    const id1 = computeJobId({ options, alignmentData });
    const id2 = computeJobId({ options, alignmentData: Buffer.from(">a\nACGT\n") });
    expect(id1).toBe(id2);
  });

  it("differs when the alignment content differs, even with identical options", () => {
    const idA = computeJobId({ options, alignmentData: Buffer.from(">a\nACGT\n") });
    const idB = computeJobId({ options, alignmentData: Buffer.from(">a\nACGG\n") });
    expect(idA).not.toBe(idB);
  });

  it("differs when the options differ, even with identical alignment content", () => {
    const alignmentData = Buffer.from(">a\nACGT\n");
    const idA = computeJobId({ options, alignmentData });
    const idB = computeJobId({
      options: { ...options, outgroup: "a" },
      alignmentData,
    });
    expect(idA).not.toBe(idB);
  });

  it("differs when a partition file is added, even with identical options and alignment", () => {
    const alignmentData = Buffer.from(">a\nACGT\n");
    const idNoPartition = computeJobId({ options, alignmentData });
    const idWithPartition = computeJobId({
      options,
      alignmentData,
      partitionData: Buffer.from("charset gene1 = 1-100;"),
    });
    expect(idNoPartition).not.toBe(idWithPartition);
  });
});
