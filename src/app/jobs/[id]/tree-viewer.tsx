"use client";

import { useMemo, useState } from "react";
import { parseNewick } from "@/lib/tree/newick";
import { computeLayout, type LayoutNode } from "@/lib/tree/layout";
import { Button } from "@/components/ui/button";

const ROW_HEIGHT = 18;
const PLOT_WIDTH = 520;
const LABEL_GAP = 8;
const LABEL_CHAR_WIDTH = 6.4;
const MAX_LABEL_WIDTH = 280;
const MARGIN = { top: 12, right: 16, bottom: 36, left: 12 };

/**
 * Renders a Newick tree as plain SVG via recursive React elements - no
 * imperative DOM library (no d3 selections, no phylotree.js) touching the
 * container after mount. The SVG returned here is identical whether it's
 * produced during SSR or on the client, so there is no "did the library
 * actually mount into the ref" class of bug to worry about.
 */
export function TreeViewer({ newick }: { newick: string }) {
  const layout = useMemo(() => {
    try {
      return computeLayout(parseNewick(newick));
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to parse tree";
    }
  }, [newick]);

  if (typeof layout === "string") {
    return <p className="text-sm text-destructive">Could not render tree: {layout}</p>;
  }

  const { root, leafCount, maxX } = layout;
  const xScale = maxX > 0 ? PLOT_WIDTH / maxX : 1;
  const longestName = Math.max(0, ...collectLeafNameLengths(root));
  const labelAreaWidth = Math.min(MAX_LABEL_WIDTH, longestName * LABEL_CHAR_WIDTH + LABEL_GAP);

  const width = MARGIN.left + PLOT_WIDTH + labelAreaWidth + MARGIN.right;
  const height = MARGIN.top + Math.max(1, leafCount) * ROW_HEIGHT + MARGIN.bottom;

  const scaleValue = niceScaleValue(maxX);

  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <svg width={width} height={height} role="img" aria-label="Phylogenetic tree" className="text-foreground">
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {renderNode(root, xScale, "n")}
          {scaleValue > 0 && (
            <ScaleBar
              value={scaleValue}
              pixels={scaleValue * xScale}
              y={leafCount * ROW_HEIGHT + 16}
            />
          )}
        </g>
      </svg>
    </div>
  );
}

function renderNode(node: LayoutNode, xScale: number, key: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const px = node.x * xScale;

  if (node.children.length > 0) {
    const childYs = node.children.map((c) => c.y * ROW_HEIGHT);
    const minY = Math.min(...childYs);
    const maxY = Math.max(...childYs);

    elements.push(
      <line
        key={`${key}-v`}
        x1={px}
        y1={minY}
        x2={px}
        y2={maxY}
        stroke="currentColor"
        strokeWidth={1}
        opacity={0.7}
      />,
    );

    node.children.forEach((child, idx) => {
      const cx = child.x * xScale;
      const cy = child.y * ROW_HEIGHT;
      elements.push(
        <line
          key={`${key}-h-${idx}`}
          x1={px}
          y1={cy}
          x2={cx}
          y2={cy}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.7}
        />,
      );
      if (!child.isLeaf && child.name) {
        elements.push(
          <text key={`${key}-s-${idx}`} x={cx + 3} y={cy - 3} fontSize={9} fill="currentColor" opacity={0.55}>
            {child.name}
          </text>,
        );
      }
      elements.push(...renderNode(child, xScale, `${key}-${idx}`));
    });
  }

  if (node.isLeaf) {
    const py = node.y * ROW_HEIGHT;
    elements.push(
      <text
        key={`${key}-label`}
        x={px + LABEL_GAP}
        y={py}
        dominantBaseline="middle"
        fontSize={11}
        fill="currentColor"
      >
        {node.name}
      </text>,
    );
  }

  return elements;
}

function ScaleBar({ value, pixels, y }: { value: number; pixels: number; y: number }) {
  return (
    <g transform={`translate(0, ${y})`} fontSize={10} fill="currentColor" opacity={0.75}>
      <line x1={0} y1={0} x2={pixels} y2={0} stroke="currentColor" strokeWidth={1} />
      <line x1={0} y1={-3} x2={0} y2={3} stroke="currentColor" strokeWidth={1} />
      <line x1={pixels} y1={-3} x2={pixels} y2={3} stroke="currentColor" strokeWidth={1} />
      <text x={pixels / 2} y={14} textAnchor="middle">
        {value}
      </text>
    </g>
  );
}

function collectLeafNameLengths(node: LayoutNode): number[] {
  if (node.isLeaf) return [node.name.length];
  return node.children.flatMap(collectLeafNameLengths);
}

function niceScaleValue(maxX: number): number {
  if (maxX <= 0) return 0;
  const target = maxX * 0.1;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const normalized = target / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return Number((nice * magnitude).toPrecision(4));
}

interface TreeSectionProps {
  treeNewick: string;
  consensusTreeNewick: string | null;
}

/** ML tree by default, with a toggle to the bootstrap consensus tree when present. */
export function TreeSection({ treeNewick, consensusTreeNewick }: TreeSectionProps) {
  const [view, setView] = useState<"ml" | "consensus">("ml");

  return (
    <div className="flex flex-col gap-2">
      {consensusTreeNewick && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={view === "ml" ? "default" : "outline"} onClick={() => setView("ml")}>
            Maximum likelihood tree
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "consensus" ? "default" : "outline"}
            onClick={() => setView("consensus")}
          >
            Consensus tree
          </Button>
        </div>
      )}
      <TreeViewer newick={view === "consensus" && consensusTreeNewick ? consensusTreeNewick : treeNewick} />
    </div>
  );
}
