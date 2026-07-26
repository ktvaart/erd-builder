"use client";

import { create } from "zustand";
import { defaultLengthFor } from "@/constants/column-types";
import { newId } from "@/lib/ids";
import { createEmptyProject, duplicateProject as duplicateProjectData } from "@/lib/project";
import type { Cardinality, Column, ColumnType, Dbms, ERDProject, Relation, TableData } from "@/types/erd";

export type Selection =
  | { kind: "table"; tableId: string; columnId?: string }
  | { kind: "relation"; relationId: string }
  | null;

export interface ConnectRequest {
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
}

export interface ERDState {
  /** 라이브러리 전체. 언제나 최소 1개를 유지한다. */
  projects: ERDProject[];
  currentProjectId: string;
  selection: Selection;

  // --- 라이브러리 ---
  createProject: (name?: string) => string;
  openProject: (projectId: string) => void;
  duplicateProject: (projectId: string) => string | undefined;
  deleteProject: (projectId: string) => void;
  renameProjectById: (projectId: string, name: string) => void;
  /** 저장본/서버에서 통째로 복원할 때 */
  replaceLibrary: (projects: ERDProject[], currentProjectId?: string | null) => void;
  /** JSON Import — 새 프로젝트로 추가하고 열어준다 */
  importProject: (project: ERDProject) => string;

  // --- 활성 프로젝트 ---
  setDbms: (dbms: Dbms) => void;
  renameProject: (name: string) => void;
  clearAll: () => void;

  // --- 선택 ---
  select: (selection: Selection) => void;

  // --- 테이블 ---
  addTable: (position?: { x: number; y: number }) => string;
  removeTable: (tableId: string) => void;
  renameTable: (tableId: string, name: string) => void;
  moveTable: (tableId: string, position: { x: number; y: number }) => void;
  setTableColor: (tableId: string, color: string | undefined) => void;

  // --- 컬럼 ---
  addColumn: (tableId: string) => string | undefined;
  removeColumn: (tableId: string, columnId: string) => void;
  updateColumn: (tableId: string, columnId: string, patch: Partial<Omit<Column, "id" | "isFK">>) => void;
  moveColumn: (tableId: string, columnId: string, direction: -1 | 1) => void;

  // --- 관계 ---
  /** 연결이 유효하지 않으면 null 을 돌려준다. */
  connect: (request: ConnectRequest) => Relation | null;
  removeRelation: (relationId: string) => void;
  setCardinality: (relationId: string, cardinality: Cardinality) => void;
}

/* ------------------------------------------------------------------ */
/* 셀렉터                                                               */
/* ------------------------------------------------------------------ */

/**
 * 활성 프로젝트. projects 는 비지 않는다는 불변식을 지키므로 항상 값이 있다.
 * 배열 안의 객체를 그대로 돌려주므로 참조가 안정적이다 → zustand 셀렉터로 안전하다.
 */
export const selectProject = (state: ERDState): ERDProject =>
  state.projects.find((project) => project.id === state.currentProjectId) ?? state.projects[0];

// 주의: 목록을 map/filter 해서 돌려주는 셀렉터는 만들지 않는다.
// 매 호출마다 새 배열이 나와 useSyncExternalStore 가 무한 루프로 판단한다.
// 필요한 곳에서 state.projects(참조 안정) 를 받아 useMemo 로 가공할 것.

/* ------------------------------------------------------------------ */

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: newId(),
    name: "column",
    type: "VARCHAR",
    length: 255,
    isPK: false,
    isFK: false,
    notNull: false,
    unique: false,
    ...overrides,
  };
}

/** `table`, `column` 처럼 같은 이름이 겹치지 않도록 뒤에 번호를 붙인다. */
function uniqueName(base: string, taken: string[]): string {
  const used = new Set(taken.map((name) => name.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let index = 2;
  while (used.has(`${base}_${index}`.toLowerCase())) index += 1;
  return `${base}_${index}`;
}

/**
 * isFK 는 관계선으로부터 파생되는 값이다.
 * 관계가 바뀔 때마다 모든 컬럼의 isFK 를 relations 기준으로 다시 계산한다.
 */
function syncFkFlags(tables: TableData[], relations: Relation[]): TableData[] {
  const fkColumnIds = new Set(relations.map((relation) => relation.sourceColumnId));
  return tables.map((table) => {
    let changed = false;
    const columns = table.columns.map((column) => {
      const isFK = fkColumnIds.has(column.id);
      if (isFK === column.isFK) return column;
      changed = true;
      return { ...column, isFK };
    });
    return changed ? { ...table, columns } : table;
  });
}

export const useERDStore = create<ERDState>((set, get) => {
  const initial = createEmptyProject();

  /** 활성 프로젝트를 갱신하면서 updatedAt 을 함께 찍는다. */
  const patchProject = (updater: (project: ERDProject) => Partial<ERDProject>) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === state.currentProjectId
          ? { ...project, ...updater(project), updatedAt: new Date().toISOString() }
          : project,
      ),
    }));

  const patchTable = (tableId: string, updater: (table: TableData) => TableData) =>
    patchProject((project) => ({
      tables: project.tables.map((table) => (table.id === tableId ? updater(table) : table)),
    }));

  return {
    projects: [initial],
    currentProjectId: initial.id,
    selection: null,

    /* -------------------- 라이브러리 -------------------- */

    createProject: (name) => {
      const project = createEmptyProject(
        uniqueName(name ?? "Untitled ERD", get().projects.map((p) => p.name)),
        selectProject(get()).dbms,
      );
      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
        selection: null,
      }));
      return project.id;
    },

    openProject: (projectId) => {
      if (!get().projects.some((project) => project.id === projectId)) return;
      set({ currentProjectId: projectId, selection: null });
    },

    duplicateProject: (projectId) => {
      const source = get().projects.find((project) => project.id === projectId);
      if (!source) return undefined;
      const copy = duplicateProjectData(source, get().projects.map((project) => project.name));
      set((state) => ({
        projects: [...state.projects, copy],
        currentProjectId: copy.id,
        selection: null,
      }));
      return copy.id;
    },

    deleteProject: (projectId) =>
      set((state) => {
        const remaining = state.projects.filter((project) => project.id !== projectId);
        // 마지막 하나를 지우면 빈 프로젝트로 대체한다 (projects 는 비지 않는다).
        const projects = remaining.length > 0 ? remaining : [createEmptyProject()];
        const stillThere = projects.some((project) => project.id === state.currentProjectId);
        return {
          projects,
          currentProjectId: stillThere ? state.currentProjectId : projects[0].id,
          selection: stillThere ? state.selection : null,
        };
      }),

    renameProjectById: (projectId, name) =>
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectId
            ? { ...project, name, updatedAt: new Date().toISOString() }
            : project,
        ),
      })),

    replaceLibrary: (incoming, currentProjectId) => {
      const projects = incoming.length > 0 ? incoming : [createEmptyProject()];
      const wanted = projects.find((project) => project.id === currentProjectId);
      const nextId = (wanted ?? projects[0]).id;
      set((state) => ({
        projects,
        currentProjectId: nextId,
        // 보고 있던 프로젝트가 그대로면 선택을 유지한다.
        // (서버 동기화가 편집 중에 끼어들어 선택을 날리면 안 된다)
        selection: nextId === state.currentProjectId ? state.selection : null,
      }));
    },

    importProject: (project) => {
      // 가져온 JSON 의 id 가 기존 프로젝트와 겹치면 새로 발급한다.
      const collides = get().projects.some((existing) => existing.id === project.id);
      const added: ERDProject = {
        ...project,
        id: collides ? newId() : project.id,
        name: uniqueName(project.name, get().projects.map((existing) => existing.name)),
        tables: syncFkFlags(project.tables, project.relations),
      };
      set((state) => ({
        projects: [...state.projects, added],
        currentProjectId: added.id,
        selection: null,
      }));
      return added.id;
    },

    /* -------------------- 활성 프로젝트 -------------------- */

    setDbms: (dbms) =>
      patchProject((project) => ({
        dbms,
        // DBMS 마다 길이 기본값이 다르므로 길이를 안 쓰는 타입은 length 를 털어준다.
        tables: project.tables.map((table) => ({
          ...table,
          columns: table.columns.map((column) => {
            const fallback = defaultLengthFor(dbms, column.type);
            return fallback === undefined
              ? { ...column, length: undefined }
              : { ...column, length: column.length ?? fallback };
          }),
        })),
      })),

    renameProject: (name) => patchProject(() => ({ name })),

    clearAll: () => {
      patchProject(() => ({ tables: [], relations: [] }));
      set({ selection: null });
    },

    select: (selection) => set({ selection }),

    /* -------------------- 테이블 -------------------- */

    addTable: (position) => {
      const project = selectProject(get());
      const id = newId();
      const table: TableData = {
        id,
        name: uniqueName("table", project.tables.map((t) => t.name)),
        columns: [makeColumn({ name: "id", type: "INT", length: undefined, isPK: true, notNull: true })],
        position: position ?? {
          x: 80 + (project.tables.length % 4) * 320,
          y: 80 + Math.floor(project.tables.length / 4) * 280,
        },
      };
      patchProject((p) => ({ tables: [...p.tables, table] }));
      set({ selection: { kind: "table", tableId: id } });
      return id;
    },

    removeTable: (tableId) => {
      patchProject((project) => {
        const relations = project.relations.filter(
          (relation) => relation.sourceTableId !== tableId && relation.targetTableId !== tableId,
        );
        const tables = project.tables.filter((table) => table.id !== tableId);
        return { tables: syncFkFlags(tables, relations), relations };
      });
      const { selection } = get();
      if (selection?.kind === "table" && selection.tableId === tableId) set({ selection: null });
    },

    renameTable: (tableId, name) => patchTable(tableId, (table) => ({ ...table, name })),

    moveTable: (tableId, position) =>
      // 드래그 중 매 프레임 호출되므로 updatedAt 갱신 없이 좌표만 바꾼다.
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id !== state.currentProjectId
            ? project
            : {
                ...project,
                tables: project.tables.map((table) =>
                  table.id === tableId ? { ...table, position } : table,
                ),
              },
        ),
      })),

    setTableColor: (tableId, color) => patchTable(tableId, (table) => ({ ...table, color })),

    /* -------------------- 컬럼 -------------------- */

    addColumn: (tableId) => {
      const project = selectProject(get());
      const table = project.tables.find((t) => t.id === tableId);
      if (!table) return undefined;
      const column = makeColumn({
        name: uniqueName("column", table.columns.map((c) => c.name)),
        length: defaultLengthFor(project.dbms, "VARCHAR"),
      });
      patchTable(tableId, (t) => ({ ...t, columns: [...t.columns, column] }));
      set({ selection: { kind: "table", tableId, columnId: column.id } });
      return column.id;
    },

    removeColumn: (tableId, columnId) => {
      patchProject((project) => {
        const relations = project.relations.filter(
          (relation) => relation.sourceColumnId !== columnId && relation.targetColumnId !== columnId,
        );
        const tables = project.tables.map((table) =>
          table.id === tableId
            ? { ...table, columns: table.columns.filter((column) => column.id !== columnId) }
            : table,
        );
        return { tables: syncFkFlags(tables, relations), relations };
      });
      const { selection } = get();
      if (selection?.kind === "table" && selection.columnId === columnId) {
        set({ selection: { kind: "table", tableId } });
      }
    },

    updateColumn: (tableId, columnId, patch) =>
      patchTable(tableId, (table) => ({
        ...table,
        columns: table.columns.map((column) =>
          column.id === columnId ? { ...column, ...patch } : column,
        ),
      })),

    moveColumn: (tableId, columnId, direction) =>
      patchTable(tableId, (table) => {
        const index = table.columns.findIndex((column) => column.id === columnId);
        const next = index + direction;
        if (index === -1 || next < 0 || next >= table.columns.length) return table;
        const columns = [...table.columns];
        [columns[index], columns[next]] = [columns[next], columns[index]];
        return { ...table, columns };
      }),

    /* -------------------- 관계 -------------------- */

    connect: ({ sourceTableId, sourceColumnId, targetTableId, targetColumnId }) => {
      if (sourceColumnId === targetColumnId) return null;

      const project = selectProject(get());
      const findColumn = (tableId: string, columnId: string) =>
        project.tables.find((table) => table.id === tableId)?.columns.find((c) => c.id === columnId);

      const a = findColumn(sourceTableId, sourceColumnId);
      const b = findColumn(targetTableId, targetColumnId);
      if (!a || !b) return null;

      // 둘 중 정확히 한쪽만 PK 면 그쪽을 "참조되는 컬럼"으로 본다.
      // (그 외에는 드래그를 시작한 컬럼을 FK 로 취급)
      const flip = b.isPK === a.isPK ? false : a.isPK;
      const fkTableId = flip ? targetTableId : sourceTableId;
      const fkColumn = flip ? b : a;
      const pkTableId = flip ? sourceTableId : targetTableId;
      const pkColumn = flip ? a : b;

      const cardinality: Cardinality = fkColumn.isPK || fkColumn.unique ? "1:1" : "1:N";
      const relation: Relation = {
        id: newId(),
        sourceTableId: fkTableId,
        sourceColumnId: fkColumn.id,
        targetTableId: pkTableId,
        targetColumnId: pkColumn.id,
        cardinality,
      };

      patchProject((p) => {
        // 한 컬럼은 하나의 대상만 참조할 수 있다. 기존 관계가 있으면 교체한다.
        const relations = [
          ...p.relations.filter((existing) => existing.sourceColumnId !== fkColumn.id),
          relation,
        ];
        // 연결과 동시에 FK 컬럼 타입을 참조 대상과 맞춰준다.
        const tables = p.tables.map((table) =>
          table.id !== fkTableId
            ? table
            : {
                ...table,
                columns: table.columns.map((column) =>
                  column.id === fkColumn.id
                    ? { ...column, type: pkColumn.type as ColumnType, length: pkColumn.length }
                    : column,
                ),
              },
        );
        return { tables: syncFkFlags(tables, relations), relations };
      });

      return relation;
    },

    removeRelation: (relationId) => {
      patchProject((project) => {
        const relations = project.relations.filter((relation) => relation.id !== relationId);
        return { tables: syncFkFlags(project.tables, relations), relations };
      });
      const { selection } = get();
      if (selection?.kind === "relation" && selection.relationId === relationId) {
        set({ selection: null });
      }
    },

    setCardinality: (relationId, cardinality) =>
      patchProject((project) => ({
        relations: project.relations.map((relation) =>
          relation.id === relationId ? { ...relation, cardinality } : relation,
        ),
      })),
  };
});
