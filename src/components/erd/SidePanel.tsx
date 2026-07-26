"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  KeyRound,
  Link2,
  Plus,
  Settings2,
  Table2,
  Trash2,
  Unlink,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button, Field, IconButton, Input, Select, ToggleChip } from "@/components/common/ui";
import {
  CARDINALITIES,
  COLUMN_TYPES,
  TABLE_COLORS,
  defaultLengthFor,
  formatColumnType,
  typeHasLength,
} from "@/constants/column-types";
import { selectProject, useERDStore } from "@/hooks/useERDStore";
import { cn } from "@/lib/utils";
import type { Cardinality, Column, ColumnType, TableData } from "@/types/erd";

export function SidePanel() {
  const selection = useERDStore((state) => state.selection);

  if (selection?.kind === "table") return <TablePanel tableId={selection.tableId} />;
  if (selection?.kind === "relation") return <RelationPanel relationId={selection.relationId} />;
  return <EmptyPanel />;
}

/* ------------------------------------------------------------------ */
/* 선택 없음                                                            */
/* ------------------------------------------------------------------ */

function EmptyPanel() {
  return (
    <aside className="flex w-[340px] shrink-0 flex-col items-center justify-center gap-3 border-l border-line bg-surface px-8 text-center">
      <Table2 className="size-8 text-ink-faint" />
      <p className="text-xs leading-relaxed text-ink-muted">
        테이블을 선택하면 여기에서 컬럼을 편집할 수 있습니다.
      </p>
      <ul className="mt-1 space-y-1 text-[11px] text-ink-faint">
        <li>빈 캔버스를 더블클릭 → 테이블 추가</li>
        <li>컬럼 좌우의 점을 드래그 → FK 연결</li>
        <li>Delete 키 → 선택한 테이블/관계 삭제</li>
      </ul>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 테이블 편집                                                          */
/* ------------------------------------------------------------------ */

function TablePanel({ tableId }: { tableId: string }) {
  const table = useERDStore((state) => selectProject(state).tables.find((t) => t.id === tableId));
  const renameTable = useERDStore((state) => state.renameTable);
  const setTableColor = useERDStore((state) => state.setTableColor);
  const removeTable = useERDStore((state) => state.removeTable);
  const addColumn = useERDStore((state) => state.addColumn);

  if (!table) return <EmptyPanel />;

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Table2 className="size-4 shrink-0 text-ink-muted" />
        <h2 className="flex-1 truncate text-sm font-semibold">테이블 편집</h2>
        <IconButton
          label="테이블 삭제"
          variant="danger"
          onClick={() => removeTable(table.id)}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </header>

      <div className="erd-scroll flex-1 overflow-y-auto">
        {/* 기본 정보 */}
        <section className="space-y-3 border-b border-line px-4 py-3">
          <Field label="테이블명">
            <Input
              value={table.name}
              onChange={(event) => renameTable(table.id, event.target.value)}
              placeholder="table_name"
            />
          </Field>

          <Field label="색상">
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {TABLE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`색상 ${color}`}
                  onClick={() => setTableColor(table.id, color)}
                  style={{ backgroundColor: color }}
                  className={cn(
                    "size-5 rounded-full transition-transform hover:scale-110",
                    (table.color ?? TABLE_COLORS[0]) === color &&
                      "ring-2 ring-ink/40 ring-offset-2 ring-offset-surface",
                  )}
                />
              ))}
            </div>
          </Field>
        </section>

        {/* 컬럼 목록 */}
        <section className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold tracking-wide text-ink-faint uppercase">
              컬럼 {table.columns.length}개
            </h3>
            <Button onClick={() => addColumn(table.id)}>
              <Plus className="size-3.5" />
              추가
            </Button>
          </div>

          {table.columns.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[11px] text-ink-faint">
              컬럼이 없습니다
            </p>
          ) : (
            <ul className="space-y-2">
              {table.columns.map((column, index) => (
                <ColumnEditor
                  key={column.id}
                  table={table}
                  column={column}
                  isFirst={index === 0}
                  isLast={index === table.columns.length - 1}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 컬럼 편집                                                            */
/* ------------------------------------------------------------------ */

function ColumnEditor({
  table,
  column,
  isFirst,
  isLast,
}: {
  table: TableData;
  column: Column;
  isFirst: boolean;
  isLast: boolean;
}) {
  const dbms = useERDStore((state) => selectProject(state).dbms);
  const updateColumn = useERDStore((state) => state.updateColumn);
  const removeColumn = useERDStore((state) => state.removeColumn);
  const moveColumn = useERDStore((state) => state.moveColumn);
  const select = useERDStore((state) => state.select);
  const isSelected = useERDStore(
    (state) => state.selection?.kind === "table" && state.selection.columnId === column.id,
  );

  // FK 는 관계선에서 파생되는 값이라 직접 켜고 끄지 않는다. 참조 대상만 보여준다.
  const reference = useERDStore((state) => {
    const relation = selectProject(state).relations.find((r) => r.sourceColumnId === column.id);
    if (!relation) return undefined;
    const target = selectProject(state).tables.find((t) => t.id === relation.targetTableId);
    const targetColumn = target?.columns.find((c) => c.id === relation.targetColumnId);
    if (!target || !targetColumn) return undefined;
    return `${target.name}.${targetColumn.name}`;
  });

  const [expanded, setExpanded] = React.useState(false);
  const hasLength = typeHasLength(dbms, column.type);

  const patch = (values: Partial<Omit<Column, "id" | "isFK">>) =>
    updateColumn(table.id, column.id, values);

  const changeType = (type: ColumnType) =>
    patch({ type, length: defaultLengthFor(dbms, type) });

  return (
    <li
      onClick={() => select({ kind: "table", tableId: table.id, columnId: column.id })}
      className={cn(
        "rounded-md border p-2 transition-colors",
        isSelected ? "border-accent bg-accent-soft/50" : "border-line bg-surface-muted/60",
      )}
    >
      {/* 이름 · 타입 · 길이 */}
      <div className="flex items-center gap-1.5">
        <Input
          value={column.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="column_name"
          className="flex-1"
        />
        <Select
          value={column.type}
          onChange={(event) => changeType(event.target.value as ColumnType)}
          className="w-[104px]"
        >
          {COLUMN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        {hasLength && (
          <Input
            type="number"
            min={1}
            value={column.length ?? ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              patch({ length: Number.isFinite(value) && value > 0 ? value : undefined });
            }}
            className="w-14 text-center"
            aria-label="길이"
          />
        )}
      </div>

      {/* 제약조건 · 순서 · 삭제 */}
      <div className="mt-1.5 flex items-center gap-1">
        <ToggleChip
          active={column.isPK}
          activeColor="var(--pk)"
          title="Primary Key"
          onClick={() =>
            patch({ isPK: !column.isPK, notNull: !column.isPK ? true : column.notNull })
          }
        >
          PK
        </ToggleChip>
        <ToggleChip
          active={column.isFK}
          activeColor="var(--fk)"
          disabled
          title={reference ? `${reference} 참조` : "관계선을 연결하면 자동으로 설정됩니다"}
        >
          FK
        </ToggleChip>
        <ToggleChip
          active={column.notNull}
          title="NOT NULL"
          onClick={() => patch({ notNull: !column.notNull })}
        >
          NN
        </ToggleChip>
        <ToggleChip
          active={column.unique}
          title="UNIQUE"
          onClick={() => patch({ unique: !column.unique })}
        >
          UQ
        </ToggleChip>

        <span className="ml-auto flex items-center">
          <IconButton
            label="기본값 · 설명"
            onClick={() => setExpanded((value) => !value)}
            className={cn("size-6", expanded && "text-accent")}
          >
            <Settings2 className="size-3.5" />
          </IconButton>
          <IconButton
            label="위로"
            disabled={isFirst}
            onClick={() => moveColumn(table.id, column.id, -1)}
            className="size-6"
          >
            <ChevronUp className="size-3.5" />
          </IconButton>
          <IconButton
            label="아래로"
            disabled={isLast}
            onClick={() => moveColumn(table.id, column.id, 1)}
            className="size-6"
          >
            <ChevronDown className="size-3.5" />
          </IconButton>
          <IconButton
            label="컬럼 삭제"
            variant="danger"
            onClick={() => removeColumn(table.id, column.id)}
            className="size-6"
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </span>
      </div>

      {/* 참조 정보 */}
      {reference && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-fk">
          <Link2 className="size-3" />
          {reference} 참조
        </p>
      )}

      {/* 상세 */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-line pt-2">
          <Field label="Default">
            <Input
              value={column.defaultValue ?? ""}
              onChange={(event) => patch({ defaultValue: event.target.value || undefined })}
              placeholder="예: 0, CURRENT_TIMESTAMP"
            />
          </Field>
          <Field label="Comment">
            <Input
              value={column.comment ?? ""}
              onChange={(event) => patch({ comment: event.target.value || undefined })}
              placeholder="컬럼 설명"
            />
          </Field>
          <p className="text-[10px] text-ink-faint">
            DDL 타입:{" "}
            <code className="font-mono text-ink-muted">
              {formatColumnType(dbms, column.type, column.length)}
            </code>
          </p>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* 관계 편집                                                            */
/* ------------------------------------------------------------------ */

const CARDINALITY_HINTS: Record<Cardinality, string> = {
  "1:1": "참조 테이블의 한 행이 이 행 하나에만 대응",
  "1:N": "참조 테이블의 한 행이 여러 행에 대응",
  "N:M": "다대다 — 실제 DDL에서는 연결 테이블이 필요합니다",
};

function RelationPanel({ relationId }: { relationId: string }) {
  const removeRelation = useERDStore((state) => state.removeRelation);
  const setCardinality = useERDStore((state) => state.setCardinality);
  // 셀렉터가 매번 새 객체를 만들기 때문에 useShallow 로 감싸야 무한 렌더링을 피할 수 있다.
  const info = useERDStore(
    useShallow((state) => {
      const relation = selectProject(state).relations.find((r) => r.id === relationId);
      if (!relation) return undefined;
      const sourceTable = selectProject(state).tables.find((t) => t.id === relation.sourceTableId);
      const targetTable = selectProject(state).tables.find((t) => t.id === relation.targetTableId);
      const sourceColumn = sourceTable?.columns.find((c) => c.id === relation.sourceColumnId);
      const targetColumn = targetTable?.columns.find((c) => c.id === relation.targetColumnId);
      if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) return undefined;
      return {
        cardinality: relation.cardinality,
        from: `${sourceTable.name}.${sourceColumn.name}`,
        to: `${targetTable.name}.${targetColumn.name}`,
        optional: !sourceColumn.notNull,
      };
    }),
  );

  if (!info) return <EmptyPanel />;

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Link2 className="size-4 shrink-0 text-fk" />
        <h2 className="flex-1 truncate text-sm font-semibold">관계</h2>
        <IconButton label="관계 삭제" variant="danger" onClick={() => removeRelation(relationId)}>
          <Unlink className="size-4" />
        </IconButton>
      </header>

      <div className="space-y-3 px-4 py-3">
        <div className="rounded-md border border-line bg-surface-muted/60 p-3 text-xs">
          <p className="flex items-center gap-1.5">
            <Link2 className="size-3 shrink-0 text-fk" />
            <span className="font-mono">{info.from}</span>
          </p>
          <p className="my-1 pl-[18px] text-[10px] text-ink-faint">references</p>
          <p className="flex items-center gap-1.5">
            <KeyRound className="size-3 shrink-0 text-pk" />
            <span className="font-mono">{info.to}</span>
          </p>
        </div>

        <Field label="카디널리티">
          <div className="flex gap-1">
            {CARDINALITIES.map((value) => (
              <button
                key={value}
                type="button"
                title={CARDINALITY_HINTS[value]}
                onClick={() => setCardinality(relationId, value)}
                className={cn(
                  "h-8 flex-1 rounded-md border text-[11px] font-semibold transition-colors",
                  info.cardinality === value
                    ? "border-fk bg-fk text-white"
                    : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-[10px] leading-relaxed text-ink-faint">
          {CARDINALITY_HINTS[info.cardinality]}
        </p>

        <dl className="space-y-1.5 border-t border-line pt-2 text-[11px]">
          <div className="flex justify-between">
            <dt className="text-ink-faint">선 스타일</dt>
            <dd className="font-medium">{info.optional ? "점선 (nullable)" : "실선 (NOT NULL)"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-faint">삭제</dt>
            <dd className="font-medium text-ink-muted">관계선 선택 후 Delete</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
