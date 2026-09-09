import { describe, expect, it } from "vitest";
import { countLeaves, parseNewick } from "@/lib/tree/newick";

describe("parseNewick", () => {
  it("parses a simple two-leaf tree with branch lengths", () => {
    const root = parseNewick("(A:0.1,B:0.2);");
    expect(root.children).toHaveLength(2);
    expect(root.children[0]).toMatchObject({ name: "A", length: 0.1, children: [] });
    expect(root.children[1]).toMatchObject({ name: "B", length: 0.2, children: [] });
  });

  it("parses nested subtrees", () => {
    const root = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");
    expect(root.children).toHaveLength(2);
    const [inner, c] = root.children;
    expect(inner.length).toBeCloseTo(0.3);
    expect(inner.children.map((n) => n.name)).toEqual(["A", "B"]);
    expect(c.name).toBe("C");
  });

  it("parses internal node labels, including IQ-TREE's combined SH-aLRT/UFBoot support strings", () => {
    const root = parseNewick("((A:0.1,B:0.2)95.5/100:0.05,C:0.4);");
    expect(root.children[0].name).toBe("95.5/100");
  });

  it("parses a real IQ-TREE 3.1.3 tree string without throwing", () => {
    const newick =
      "(LngfishAu:0.1697833028,(LngfishSA:0.1860259106,LngfishAf:0.1642390887)100/100:0.1062424709," +
      "(Frog:0.2559679430,((((Turtle:0.2213246053,(Crocodile:0.3064149104,Bird:0.2307316296)97.2/97:0.0650768496)" +
      "88.5/71:0.0364037502,Sphenodon:0.3437783059)43/49:0.0207891764,Lizard:0.3870264230)98.6/99:0.0725442525," +
      "Human:0.1839615709)100/100:0.1270644418)99.9/100:0.0930861774);";
    expect(() => parseNewick(newick)).not.toThrow();
    expect(countLeaves(parseNewick(newick))).toBe(10);
  });

  it("strips NHX-style bracket comments", () => {
    const root = parseNewick("(A:0.1[&comment],B:0.2);");
    expect(root.children[0].name).toBe("A");
  });

  it("throws on empty input", () => {
    expect(() => parseNewick("")).toThrow();
  });

  it("throws on an unbalanced paren", () => {
    expect(() => parseNewick("(A:0.1,B:0.2;")).toThrow();
  });
});

describe("countLeaves", () => {
  it("counts leaves in a nested tree", () => {
    const root = parseNewick("((A:0.1,B:0.2):0.3,(C:0.1,D:0.1,E:0.1):0.2);");
    expect(countLeaves(root)).toBe(5);
  });

  it("returns 1 for a single-node tree", () => {
    const root = parseNewick("A;");
    expect(countLeaves(root)).toBe(1);
  });
});
