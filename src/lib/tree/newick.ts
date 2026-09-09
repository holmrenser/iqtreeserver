export interface TreeNode {
  /** Leaf name, or an internal node's label (often a support value like "100/100"). */
  name: string;
  /** Branch length to parent. 0 for the root or when absent. */
  length: number;
  children: TreeNode[];
}

/**
 * Minimal recursive-descent Newick parser. Handles nested parens, branch
 * lengths, and internal node labels (including IQ-TREE's "SH-aLRT/UFBoot"
 * combined support strings, which are just treated as an opaque label).
 * NHX-style `[...]` comments are stripped up front since IQ-TREE doesn't
 * emit them in `.treefile`/`.contree`, but a real download might.
 */
export function parseNewick(input: string): TreeNode {
  const s = input.replace(/\[[^\]]*\]/g, "").trim();
  let i = 0;

  function parseSubtree(): TreeNode {
    const children: TreeNode[] = [];
    if (s[i] === "(") {
      i++;
      children.push(parseSubtree());
      while (s[i] === ",") {
        i++;
        children.push(parseSubtree());
      }
      if (s[i] !== ")") {
        throw new Error(`Malformed Newick: expected ')' at position ${i}`);
      }
      i++;
    }
    const name = parseToken();
    const length = parseLength();
    return { name, length, children };
  }

  function parseToken(): string {
    const start = i;
    while (i < s.length && !/[,():;]/.test(s[i])) i++;
    return s.slice(start, i).trim();
  }

  function parseLength(): number {
    if (s[i] !== ":") return 0;
    i++;
    const raw = parseToken();
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  if (s.length === 0) {
    throw new Error("Malformed Newick: empty input");
  }

  const root = parseSubtree();
  if (s[i] !== ";" && i !== s.length) {
    throw new Error(`Malformed Newick: unexpected trailing content at position ${i}`);
  }
  return root;
}

export function countLeaves(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}
