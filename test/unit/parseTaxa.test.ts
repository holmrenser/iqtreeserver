import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTaxaNames } from "@/lib/alignment/parseTaxa";

const FIXTURES = path.join(__dirname, "../fixtures/alignments");

describe("parseTaxaNames", () => {
  it("extracts taxon names from a FASTA fixture with varied header formats", () => {
    const content = readFileSync(path.join(FIXTURES, "small.fasta"), "utf8");
    const names = parseTaxaNames(content);
    expect(names).toEqual(["HumanA", "Mouse_B", "Rat.C|extra|pipes", "4th_taxon"]);
  });

  it("takes only the first whitespace-delimited token of a FASTA header", () => {
    const content = ">seq1 some description with spaces\nACGT\n";
    expect(parseTaxaNames(content)).toEqual(["seq1"]);
  });

  it("dedupes repeated taxon names", () => {
    const content = ">dup\nACGT\n>dup\nACGT\n";
    expect(parseTaxaNames(content)).toEqual(["dup"]);
  });

  it("parses a minimal PHYLIP header", () => {
    const content = " 3 4\nOne  ACGT\nTwo  ACGT\nThree ACGT\n";
    expect(parseTaxaNames(content)).toEqual(["One", "Two", "Three"]);
  });

  it("returns an empty array for unrecognizable content rather than throwing", () => {
    expect(() => parseTaxaNames("not an alignment at all")).not.toThrow();
    expect(parseTaxaNames("not an alignment at all")).toEqual([]);
  });
});
