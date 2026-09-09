import { describe, expect, it } from "vitest";
import { parseNewick } from "@/lib/tree/newick";
import { computeLayout, leafNames } from "@/lib/tree/layout";

describe("computeLayout", () => {
  it("assigns sequential y to leaves in left-to-right order", () => {
    const { root } = computeLayout(parseNewick("(A:0.1,B:0.2,C:0.3);"));
    expect(root.children.map((c) => c.y)).toEqual([0, 1, 2]);
  });

  it("assigns x as cumulative branch length from the root", () => {
    const { root } = computeLayout(parseNewick("((A:0.1,B:0.2):0.3,C:0.4);"));
    const [inner, c] = root.children;
    expect(inner.x).toBeCloseTo(0.3);
    expect(inner.children[0].x).toBeCloseTo(0.4); // 0.3 + 0.1
    expect(inner.children[1].x).toBeCloseTo(0.5); // 0.3 + 0.2
    expect(c.x).toBeCloseTo(0.4);
    expect(root.x).toBe(0);
  });

  it("sets an internal node's y to the mean of its children's y", () => {
    const { root } = computeLayout(parseNewick("((A:0.1,B:0.2):0.3,C:0.4);"));
    const [inner] = root.children;
    expect(inner.y).toBeCloseTo((0 + 1) / 2);
  });

  it("reports the correct leaf count and maxX", () => {
    const layout = computeLayout(parseNewick("((A:0.1,B:0.2):0.3,C:0.4);"));
    expect(layout.leafCount).toBe(3);
    expect(layout.maxX).toBeCloseTo(0.5);
  });

  it("clamps negative branch lengths to 0 instead of shrinking x", () => {
    const { root } = computeLayout(parseNewick("(A:-0.1,B:0.2);"));
    expect(root.children[0].x).toBe(0);
  });
});

describe("leafNames", () => {
  it("collects leaf names in order, skipping internal support labels", () => {
    const { root } = computeLayout(parseNewick("((A:0.1,B:0.2)95/100:0.3,C:0.4);"));
    expect(leafNames(root)).toEqual(["A", "B", "C"]);
  });
});
