import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseReport } from "@/lib/iqtree/parseReport";

const FIXTURES = path.join(__dirname, "../fixtures/alignments");

describe("parseReport", () => {
  it("extracts every field from a real IQ-TREE 3.1.3 report (-m MFP -B 1000 -alrt 1000)", () => {
    const text = readFileSync(path.join(FIXTURES, "real-report.iqtree"), "utf8");
    const summary = parseReport(text);

    expect(summary.version).toBe("3.1.3");
    expect(summary.taxonCount).toBe(17);
    expect(summary.alignmentLength).toBe(1998);
    expect(summary.dataType).toBe("nucleotide");
    expect(summary.bestModel).toBe("TIM2+F+I+G4");
    expect(summary.modelCriterion).toBe("BIC");
    expect(summary.logLikelihood).toBeCloseTo(-21152.5376, 3);
    expect(summary.logLikelihoodStdError).toBeCloseTo(336.3337, 3);
    expect(summary.totalTreeLength).toBeCloseTo(4.2178, 3);
    expect(summary.wallClockSeconds).toBeCloseTo(19.7409, 3);
  });

  it("degrades gracefully to all-null fields on a malformed/unrecognized report, never throws", () => {
    const text = readFileSync(path.join(FIXTURES, "malformed-report.iqtree"), "utf8");
    expect(() => parseReport(text)).not.toThrow();
    const summary = parseReport(text);
    expect(summary.version).toBeNull();
    expect(summary.bestModel).toBeNull();
    expect(summary.logLikelihood).toBeNull();
    expect(summary.totalTreeLength).toBeNull();
    expect(summary.wallClockSeconds).toBeNull();
  });

  it("handles an empty string without throwing", () => {
    expect(() => parseReport("")).not.toThrow();
  });

  it("falls back to the substitution-model line when no ModelFinder line is present (fixed -m run)", () => {
    const text = [
      "IQ-TREE 3.1.3 built Jun 19 2026",
      "",
      "Model of substitution: GTR+F+G4",
      "",
      "Log-likelihood of the tree: -21155.9755 (s.e. 336.7628)",
    ].join("\n");
    const summary = parseReport(text);
    expect(summary.bestModel).toBe("GTR+F+G4");
    expect(summary.modelCriterion).toBeNull();
  });
});
