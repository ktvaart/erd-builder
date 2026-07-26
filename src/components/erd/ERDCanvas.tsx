"use client";

import "@xyflow/react/dist/style.css";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { selectProject, useERDStore } from "@/hooks/useERDStore";
import { handleId, parseHandleId, type HandleSide } from "@/lib/handles";
import { cn } from "@/lib/utils";
import { RelationEdge, type RelationEdgeType } from "./RelationEdge";
import { TABLE_NODE_WIDTH, TableNode, type TableNodeType } from "./TableNode";

const nodeTypes: NodeTypes = { table: TableNode };
const edgeTypes: EdgeTypes = { relation: RelationEdge };

export function ERDCanvas() {
  const tables = useERDStore((state) => selectProject(state).tables);
  const relations = useERDStore((state) => selectProject(state).relations);
  const selection = useERDStore((state) => state.selection);
  const select = useERDStore((state) => state.select);
  const moveTable = useERDStore((state) => state.moveTable);
  const removeTable = useERDStore((state) => state.removeTable);
  const addTable = useERDStore((state) => state.addTable);
  const connect = useERDStore((state) => state.connect);
  const removeRelation = useERDStore((state) => state.removeRelation);

  const { screenToFlowPosition } = useReactFlow<TableNodeType, RelationEdgeType>();

  const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationEdgeType>([]);
  const [connecting, setConnecting] = React.useState(false);

  /* ---------- store(tables) → React Flow nodes ----------
   * React Flow 가 내부적으로 붙여 둔 measured 등을 잃지 않도록 기존 노드를 재활용한다. */
  React.useEffect(() => {
    setNodes((previous) => {
      const previousById = new Map(previous.map((node) => [node.id, node]));
      return tables.map((table) => {
        const existing = previousById.get(table.id);
        const isSelected = selection?.kind === "table" && selection.tableId === table.id;
        if (existing && existing.data.table === table && existing.selected === isSelected) {
          return existing;
        }
        return {
          ...existing,
          id: table.id,
          type: "table" as const,
          position: table.position,
          data: { table },
          selected: isSelected,
        };
      });
    });
  }, [tables, selection, setNodes]);

  /* ---------- store(relations) → React Flow edges ---------- */
  React.useEffect(() => {
    const tableById = new Map(tables.map((table) => [table.id, table]));

    const next = relations.flatMap<RelationEdgeType>((relation) => {
      const sourceTable = tableById.get(relation.sourceTableId);
      const targetTable = tableById.get(relation.targetTableId);
      if (!sourceTable || !targetTable) return [];

      const fkColumn = sourceTable.columns.find((column) => column.id === relation.sourceColumnId);
      if (!fkColumn) return [];

      // 테이블의 좌우 위치에 따라 마주보는 쪽 핸들을 골라야 선이 꼬이지 않는다.
      const selfReference = sourceTable.id === targetTable.id;
      const sourceIsLeft = sourceTable.position.x <= targetTable.position.x;
      const sourceSide: HandleSide = selfReference ? "right" : sourceIsLeft ? "right" : "left";
      const targetSide: HandleSide = selfReference ? "right" : sourceIsLeft ? "left" : "right";

      const isSelected = selection?.kind === "relation" && selection.relationId === relation.id;

      return [
        {
          id: relation.id,
          type: "relation" as const,
          source: relation.sourceTableId,
          target: relation.targetTableId,
          sourceHandle: handleId(relation.sourceTableId, relation.sourceColumnId, sourceSide),
          targetHandle: handleId(relation.targetTableId, relation.targetColumnId, targetSide),
          selected: isSelected,
          data: { cardinality: relation.cardinality, optional: !fkColumn.notNull },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: isSelected ? "var(--accent)" : "var(--line-strong)",
          },
        },
      ];
    });

    setEdges(next);
  }, [relations, tables, selection, setEdges]);

  /* ---------- 상호작용 ---------- */

  const handleNodesChange = React.useCallback<typeof onNodesChange>(
    (changes) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          moveTable(change.id, change.position);
        }
      }
    },
    [onNodesChange, moveTable],
  );

  const isValidConnection = React.useCallback((connection: Connection | Edge) => {
    const source = parseHandleId(connection.sourceHandle);
    const target = parseHandleId(connection.targetHandle);
    // 같은 컬럼끼리는 연결할 수 없다. (자기 테이블의 다른 컬럼 참조는 허용)
    return Boolean(source && target && source.columnId !== target.columnId);
  }, []);

  const onConnect = React.useCallback(
    (connection: Connection) => {
      const source = parseHandleId(connection.sourceHandle);
      const target = parseHandleId(connection.targetHandle);
      if (!source || !target) return;
      const relation = connect({
        sourceTableId: source.tableId,
        sourceColumnId: source.columnId,
        targetTableId: target.tableId,
        targetColumnId: target.columnId,
      });
      if (relation) select({ kind: "relation", relationId: relation.id });
    },
    [connect, select],
  );

  const onPaneDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      // 노드/엣지 위에서의 더블클릭은 여기까지 버블링되므로 빈 캔버스인지 확인한다.
      if (!(event.target as HTMLElement).classList.contains("react-flow__pane")) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      // 더블클릭 지점이 새 테이블의 중앙이 되도록 보정
      addTable({ x: position.x - TABLE_NODE_WIDTH / 2, y: position.y - 20 });
    },
    [addTable, screenToFlowPosition],
  );

  return (
    <ReactFlow<TableNodeType, RelationEdgeType>
      className={cn(connecting && "erd-connecting")}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodesDelete={(deleted) => deleted.forEach((node) => removeTable(node.id))}
      onEdgesDelete={(deleted) => deleted.forEach((edge) => removeRelation(edge.id))}
      onConnect={onConnect}
      onConnectStart={() => setConnecting(true)}
      onConnectEnd={() => setConnecting(false)}
      isValidConnection={isValidConnection}
      onNodeClick={(_, node) => select({ kind: "table", tableId: node.id })}
      onEdgeClick={(_, edge) => select({ kind: "relation", relationId: edge.id })}
      onPaneClick={() => select(null)}
      onDoubleClick={onPaneDoubleClick}
      connectionMode={ConnectionMode.Loose}
      connectionLineType={ConnectionLineType.Bezier}
      connectionLineStyle={{ stroke: "var(--accent)", strokeWidth: 2 }}
      connectionRadius={26}
      deleteKeyCode={["Delete", "Backspace"]}
      multiSelectionKeyCode={null}
      selectionOnDrag={false}
      panOnDrag
      minZoom={0.2}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--line-strong)" />
      <Controls
        showInteractive={false}
        className="!rounded-lg !border !border-line !bg-surface !shadow-sm"
      />
      <MiniMap
        pannable
        zoomable
        className="!rounded-lg !border !border-line !bg-surface !shadow-sm"
        maskColor="rgba(28, 36, 52, 0.06)"
        nodeColor={(node) => (node as TableNodeType).data.table.color ?? "#4f6bed"}
        nodeBorderRadius={4}
      />
    </ReactFlow>
  );
}
