import { describe, expect, it } from "vitest";
import { buildIqtreeArgs, type BuildArgsInput } from "@/lib/iqtree/buildArgs";
import { iqtreeSubmissionSchema, type IqtreeSubmission } from "@/lib/iqtree/schema";

function options(overrides: Partial<Record<string, unknown>> = {}): IqtreeSubmission {
  return iqtreeSubmissionSchema.parse({
    sequenceType: "AUTO",
    modelMode: { mode: "auto", criterion: "BIC" },
    branchSupport: {
      ultrafastBootstrap: { enabled: false, replicates: 1000 },
      shAlrt: { enabled: false, replicates: 1000 },
      abayes: false,
      standardBootstrap: { enabled: false, replicates: 100 },
    },
    partitionMode: "p",
    advanced: { bnni: false, asr: false },
    ...overrides,
  });
}

function baseInput(overrides: Partial<BuildArgsInput> = {}): BuildArgsInput {
  return {
    options: options(),
    alignmentPath: "/data/jobs/abc/input.fasta",
    outputPrefix: "/data/jobs/abc/result",
    threads: "AUTO",
    workerMaxThreads: 4,
    memLimitGb: 4,
    seed: 42,
    ...overrides,
  };
}

describe("buildIqtreeArgs", () => {
  it("always includes -s, -pre, -seed", () => {
    const args = buildIqtreeArgs(baseInput());
    expect(args).toEqual(
      expect.arrayContaining(["-s", "/data/jobs/abc/input.fasta", "-pre", "/data/jobs/abc/result", "-seed", "42"]),
    );
  });

  it("uses -m MFP for auto model mode, with no criterion flag when BIC (the iqtree default)", () => {
    const args = buildIqtreeArgs(baseInput());
    expect(args).toEqual(expect.arrayContaining(["-m", "MFP"]));
    expect(args).not.toEqual(expect.arrayContaining(["-BIC"]));
  });

  it("adds a criterion flag for non-default AIC/AICc", () => {
    const args = buildIqtreeArgs(
      baseInput({ options: options({ modelMode: { mode: "auto", criterion: "AICc" } }) }),
    );
    expect(args).toEqual(expect.arrayContaining(["-AICc"]));
  });

  it("adds -mset when a restrictSet is given", () => {
    const args = buildIqtreeArgs(
      baseInput({
        options: options({ modelMode: { mode: "auto", criterion: "BIC", restrictSet: "GTR,HKY" } }),
      }),
    );
    expect(args).toEqual(expect.arrayContaining(["-mset", "GTR,HKY"]));
  });

  it("uses -m <model> directly for manual model mode", () => {
    const args = buildIqtreeArgs(
      baseInput({ options: options({ modelMode: { mode: "manual", model: "GTR+I+G4" } }) }),
    );
    expect(args).toEqual(expect.arrayContaining(["-m", "GTR+I+G4"]));
  });

  it("adds -B and -alrt only when enabled", () => {
    const args = buildIqtreeArgs(
      baseInput({
        options: options({
          branchSupport: {
            ultrafastBootstrap: { enabled: true, replicates: 1000 },
            shAlrt: { enabled: true, replicates: 1000 },
            abayes: false,
            standardBootstrap: { enabled: false, replicates: 100 },
          },
        }),
      }),
    );
    expect(args).toEqual(expect.arrayContaining(["-B", "1000", "-alrt", "1000"]));
  });

  it("adds -abayes when enabled", () => {
    const args = buildIqtreeArgs(
      baseInput({
        options: options({
          branchSupport: {
            ultrafastBootstrap: { enabled: false, replicates: 1000 },
            shAlrt: { enabled: false, replicates: 1000 },
            abayes: true,
            standardBootstrap: { enabled: false, replicates: 100 },
          },
        }),
      }),
    );
    expect(args).toContain("-abayes");
  });

  it("adds -b for standard bootstrap when enabled (mutually exclusive with -B, enforced at schema level)", () => {
    const args = buildIqtreeArgs(
      baseInput({
        options: options({
          branchSupport: {
            ultrafastBootstrap: { enabled: false, replicates: 1000 },
            shAlrt: { enabled: false, replicates: 1000 },
            abayes: false,
            standardBootstrap: { enabled: true, replicates: 100 },
          },
        }),
      }),
    );
    expect(args).toEqual(expect.arrayContaining(["-b", "100"]));
    expect(args).not.toContain("-B");
  });

  it.each([
    ["p", "-p"],
    ["q", "-q"],
    ["Q", "-Q"],
  ] as const)("uses %s partition mode as %s when a partition file is given", (mode, flag) => {
    const args = buildIqtreeArgs(
      baseInput({ options: options({ partitionMode: mode }), partitionPath: "/data/jobs/abc/partition.nex" }),
    );
    expect(args).toEqual(expect.arrayContaining([flag, "/data/jobs/abc/partition.nex"]));
  });

  it("omits any partition flag when no partition file is given", () => {
    const args = buildIqtreeArgs(baseInput());
    expect(args).not.toContain("-p");
    expect(args).not.toContain("-q");
    expect(args).not.toContain("-Q");
  });

  it("adds a sanitized -o outgroup when present", () => {
    const args = buildIqtreeArgs(baseInput({ options: options({ outgroup: "Human" }) }));
    expect(args).toEqual(expect.arrayContaining(["-o", "Human"]));
  });

  it("uses -T AUTO with --threads-max when threads is AUTO", () => {
    const args = buildIqtreeArgs(baseInput({ threads: "AUTO", workerMaxThreads: 8 }));
    expect(args).toEqual(expect.arrayContaining(["-T", "AUTO", "--threads-max", "8"]));
  });

  it("uses a fixed -T <n> when threads is a number", () => {
    const args = buildIqtreeArgs(baseInput({ threads: 2 }));
    expect(args).toEqual(expect.arrayContaining(["-T", "2"]));
    expect(args).not.toContain("AUTO");
  });

  it("adds -mem <n>G when memLimitGb is given", () => {
    const args = buildIqtreeArgs(baseInput({ memLimitGb: 8 }));
    expect(args).toEqual(expect.arrayContaining(["-mem", "8G"]));
  });

  it("adds -bnni and -asr only when requested", () => {
    const args = buildIqtreeArgs(
      baseInput({ options: options({ advanced: { bnni: true, asr: true } }) }),
    );
    expect(args).toEqual(expect.arrayContaining(["-bnni", "-asr"]));
  });

  it("never bundles a flag and its value into a single argv token (the real injection guardrail)", () => {
    const args = buildIqtreeArgs(
      baseInput({
        options: options({
          modelMode: { mode: "manual", model: "GTR+I+G4" },
          outgroup: "Human",
          partitionMode: "q",
        }),
        partitionPath: "/data/jobs/abc/partition.nex",
        memLimitGb: 8,
      }),
    );
    for (const token of args) {
      expect(token.includes(" ")).toBe(false);
    }
  });
});
