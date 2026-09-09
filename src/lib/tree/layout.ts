import type { TreeNode } from "./newick";

export interface LayoutNode {
  name: string;
  length: number;
  /** Cumulative branch length from the root. */
  x: number;
  /** Vertical slot - leaves get sequential integers, internal nodes the mean of their children. */
  y: number;
  isLeaf: boolean;
  children: LayoutNode[];
}

export interface TreeLayout {
  root: LayoutNode;
  leafCount: number;
  maxX: number;
}

/**
 * Pure rectangular-cladogram layout: x is cumulative branch length from the
 * root (a true phylogram, not a hop-count cladogram - IQ-TREE trees always
 * carry real branch lengths), y is the leaf's sequential order for leaves
 * and the mean of its children's y for internal nodes (the standard
 * dendrogram layout).
 */
export function computeLayout(root: TreeNode): TreeLayout {
  let nextLeafIndex = 0;
  let maxX = 0;

  function assign(node: TreeNode, parentX: number): LayoutNode {
    const x = parentX + Math.max(0, node.length);
    if (x > maxX) maxX = x;

    if (node.children.length === 0) {
      const y = nextLeafIndex;
      nextLeafIndex += 1;
      return { name: node.name, length: node.length, x, y, isLeaf: true, children: [] };
    }

    const children = node.children.map((child) => assign(child, x));
    const y = children.reduce((sum, child) => sum + child.y, 0) / children.length;
    return { name: node.name, length: node.length, x, y, isLeaf: false, children };
  }

  const laidOutRoot = assign(root, 0);
  return { root: laidOutRoot, leafCount: nextLeafIndex, maxX };
}

export function leafNames(node: LayoutNode): string[] {
  if (node.isLeaf) return [node.name];
  return node.children.flatMap(leafNames);
}
