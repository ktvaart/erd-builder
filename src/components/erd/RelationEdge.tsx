"use client";

import * as React from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import type { Cardinality } from "@/types/erd";

export type RelationEdgeData = {
  cardinality: Cardinality;
  /** nullable FK 는 점선, NOT NULL 이면 실선 */
  optional: boolean;
};
export type RelationEdgeType = Edge<RelationEdgeData, "relation">;

export const RelationEdge = React.memo(function RelationEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<RelationEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const stroke = selected ? "var(--accent)" : "var(--line-strong)";

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeDasharray: data?.optional ? "5 4" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-none absolute rounded border px-1 py-px text-[9px] font-bold tracking-wide tabular-nums"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: selected ? "var(--accent)" : "var(--line)",
            background: "var(--surface)",
            color: selected ? "var(--accent)" : "var(--ink-faint)",
          }}
        >
          {data?.cardinality ?? "1:N"}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
