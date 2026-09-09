import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIqtreeArgs } from "@/lib/iqtree/buildArgs";
import { parseReport } from "@/lib/iqtree/parseReport";
import { iqtreeSubmissionSchema } from "@/lib/iqtree/schema";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const IQTREE_BIN = process.env.IQTREE_BIN ?? "iqtree3";

function iqtreeAvailable(): boolean {
  if (path.isAbsolute(IQTREE_BIN)) return existsSync(IQTREE_BIN);
  const result = spawnSync(IQTREE_BIN, ["--version"]);
  return result.error === undefined || result.error === null;
}

const describeIfAvailable = iqtreeAvailable() ? describe : describe.skip;

// Real end-to-end sanity check: buildArgs -> real iqtree3 spawnSync ->
// parseReport, against a tiny fixture. Skipped automatically when the
// binary isn't on IQTREE_BIN/PATH (e.g. a plain `npm test` on a dev machine
// without IQ-TREE installed) rather than failing the whole suite.
describeIfAvailable("full IQ-TREE job (smoke)", () => {
  it("runs a real iqtree3 invocation and produces a parseable report + tree", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "iqtreeserver-smoke-"));
    try {
      const alignmentPath = path.join(dir, "input.fasta");
      const fixture = readFileSync(path.join(__dirname, "../fixtures/alignments/small.fasta"));
      writeFileSync(alignmentPath, fixture);

      const options = iqtreeSubmissionSchema.parse({
        sequenceType: "DNA",
        modelMode: { mode: "manual", model: "JC" },
        branchSupport: {
          ultrafastBootstrap: { enabled: false, replicates: 1000 },
          shAlrt: { enabled: false, replicates: 1000 },
          abayes: false,
          standardBootstrap: { enabled: false, replicates: 100 },
        },
        partitionMode: "p",
        advanced: { bnni: false, asr: false },
      });

      const outputPrefix = path.join(dir, "result");
      const args = buildIqtreeArgs({
        options,
        alignmentPath,
        outputPrefix,
        threads: 1,
        seed: 1,
      });

      const result = spawnSync(IQTREE_BIN, args, { encoding: "utf8", timeout: 60_000 });
      expect(result.status).toBe(0);

      const treefile = `${outputPrefix}.treefile`;
      expect(existsSync(treefile)).toBe(true);
      const newick = readFileSync(treefile, "utf8").trim();
      expect(newick.endsWith(";")).toBe(true);

      const reportText = readFileSync(`${outputPrefix}.iqtree`, "utf8");
      const summary = parseReport(reportText);
      expect(summary.taxonCount).toBe(4);
      expect(summary.bestModel).toContain("JC");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
