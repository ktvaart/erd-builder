"use client";

import * as React from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { KeyRound, Link2, Plus, Trash2 } from "lucide-react";
import { formatColumnType } from "@/constants/column-types";
import { selectProject, useERDStore } from "@/hooks/useERDStore";
import { handleId } from "@/lib/handles";
import { cn } from "@/lib/utils";
import type { TableData } from "@/types/erd";

export const TABLE_NODE_WIDTH = 260;

export type TableNodeData = { table: TableData };
export type TableNodeType = Node<TableNodeData, "table">;

export const TableNode = React.memo(function TableNode({ data, selected }: NodeProps<TableNodeType>) {
  const { table } = data;

  const dbms = useERDStore((state) => selectProject(state).dbms);
  const selectedColumnId = useERDStore((state) =>
    state.selection?.kind === "table" && state.selection.tableId === table.id
      ? state.selection.columnId
      : undefined,
  );
  const select = useERDStore((state) => state.select);
  const renameTable = useERDStore((state) => state.renameTable);
  const removeTable = useERDStore((state) => state.removeTable);
  const addColumn = useERDStore((state) => state.addColumn);

  const [editingName, setEditingName] = React.useState(false);
  const [draftName, setDraftName] = React.useState(table.name);

  const startRename = () => {
    setDraftName(table.name);
    setEditingName(true);
  };

  const commitRename = () => {
    const next = draftName.trim();
    if (next && next !== table.name) renameTable(table.id, next);
    setEditingName(false);
  };

  const accent = table.color ?? "var(--accent)";

  return (
    // 핸들이 노드 경계 바깥에 놓이므로 overflow-hidden 을 걸면 안 된다.
    // (잘려 보이지 않을 뿐 아니라 포인터 이벤트까지 잘려 연결이 불가능해진다)
    // 대신 첫/마지막 자식에 직접 모서리를 둥글린다.
    <div
      className={cn(
        "w-[260px] rounded-lg border bg-surface text-ink shadow-sm transition-shadow",
        selected ? "border-accent shadow-lg ring-2 ring-accent/25" : "border-line hover:shadow-md",
      )}
    >
      {/* ---------- 헤더 ---------- */}
      <div className="h-1 w-full rounded-t-[7px]" style={{ backgroundColor: accent }} />
      <div className="group/header flex items-center gap-1.5 border-b border-line bg-surface-muted px-2.5 py-2">
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") setEditingName(false);
            }}
            className="nodrag nopan h-6 w-full min-w-0 rounded border border-accent bg-surface px-1.5 text-[13px] font-semibold outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={startRename}
            title="더블클릭해서 이름 변경"
            className="nodrag min-w-0 flex-1 truncate text-left text-[13px] font-semibold"
          >
            {table.name}
          </button>
        )}

        <span className="shrink-0 text-[10px] text-ink-faint tabular-nums">
          {table.columns.length}
        </span>
        <button
          type="button"
          title="테이블 삭제"
          aria-label="테이블 삭제"
          onClick={(event) => {
            event.stopPropagation();
            removeTable(table.id);
          }}
          className="nodrag nopan inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition group-hover/header:opacity-100 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* ---------- 컬럼 목록 ---------- */}
      <div>
        {table.columns.length === 0 && (
          <p className="px-2.5 py-3 text-center text-[11px] text-ink-faint">컬럼이 없습니다</p>
        )}

        {table.columns.map((column) => {
          const isActive = selectedColumnId === column.id;
          return (
            <div
              key={column.id}
              onClick={(event) => {
                event.stopPropagation();
                select({ kind: "table", tableId: table.id, columnId: column.id });
              }}
              className={cn(
                "relative flex h-7 cursor-pointer items-center gap-1.5 border-b border-line/60 px-2.5 last:border-b-0",
                isActive ? "bg-accent-soft" : "hover:bg-surface-muted",
              )}
            >
              {/* 컬럼 row 하나당 좌/우 핸들 — 어느 쪽에서든 끌어서 FK 연결 */}
              <Handle
                type="source"
                position={Position.Left}
                id={handleId(table.id, column.id, "left")}
                className="erd-handle"
                style={{ left: -5 }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={handleId(table.id, column.id, "right")}
                className="erd-handle"
                style={{ right: -5 }}
              />

              <span className="flex w-7 shrink-0 items-center gap-0.5">
                {column.isPK && <KeyRound className="size-3 text-pk" aria-label="PK" />}
                {column.isFK && <Link2 className="size-3 text-fk" aria-label="FK" />}
              </span>

              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[12px]",
                  column.isPK ? "font-semibold text-ink" : "text-ink",
                  column.notNull && "after:ml-0.5 after:text-danger after:content-['*']",
                )}
              >
                {column.name}
              </span>

              <span className="shrink-0 text-[10px] font-medium text-ink-faint">
                {formatColumnType(dbms, column.type, column.length)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ---------- 푸터 ---------- */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          addColumn(table.id);
        }}
        className="nodrag nopan flex w-full items-center justify-center gap-1 rounded-b-[7px] border-t border-line bg-surface-muted py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent"
      >
        <Plus className="size-3" />
        컬럼 추가
      </button>
    </div>
  );
});
