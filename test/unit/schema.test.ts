import { describe, expect, it } from "vitest";
import { iqtreeSubmissionSchema } from "@/lib/iqtree/schema";

const base = {
  sequenceType: "AUTO" as const,
  modelMode: { mode: "auto" as const, criterion: "BIC" as const },
  branchSupport: {
    ultrafastBootstrap: { enabled: true, replicates: 1000 },
    shAlrt: { enabled: true, replicates: 1000 },
    abayes: false,
    standardBootstrap: { enabled: false, replicates: 100 },
  },
  partitionMode: "p" as const,
  advanced: { bnni: false, asr: false },
};

describe("iqtreeSubmissionSchema", () => {
  it("accepts a well-formed auto-model payload", () => {
    const result = iqtreeSubmissionSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a manual model payload", () => {
    const result = iqtreeSubmissionSchema.safeParse({
      ...base,
      modelMode: { mode: "manual", model: "GTR+I+G4" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects ultrafast bootstrap and standard bootstrap enabled together", () => {
    const result = iqtreeSubmissionSchema.safeParse({
      ...base,
      branchSupport: {
        ...base.branchSupport,
        ultrafastBootstrap: { enabled: true, replicates: 1000 },
        standardBootstrap: { enabled: true, replicates: 100 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an ultrafast bootstrap replicate count below the minimum", () => {
    const result = iqtreeSubmissionSchema.safeParse({
      ...base,
      branchSupport: {
        ...base.branchSupport,
        ultrafastBootstrap: { enabled: true, replicates: 10 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an outgroup value containing shell/flag-like characters", () => {
    const result = iqtreeSubmissionSchema.safeParse({
      ...base,
      outgroup: "-rm -rf /",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a safe outgroup taxon name", () => {
    const result = iqtreeSubmissionSchema.safeParse({
      ...base,
      outgroup: "Human_GRCh38",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a manual model string with unsupported characters", () => {
    const result = iqtreeSubmissionSchema.safeParse({
      ...base,
      modelMode: { mode: "manual", model: "GTR; rm -rf /" },
    });
    expect(result.success).toBe(false);
  });
});
