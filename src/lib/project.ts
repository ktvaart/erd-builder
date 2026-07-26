import { CARDINALITIES, COLUMN_TYPES, DBMS_OPTIONS, defaultLengthFor } from "@/constants/column-types";
import { newId } from "@/lib/ids";
import type { Cardinality, Column, ColumnType, Dbms, ERDProject, Relation, TableData } from "@/types/erd";

/* ------------------------------------------------------------------ */
/* 생성 · 요약                                                          */
/* ------------------------------------------------------------------ */

export function createEmptyProject(name = "Untitled ERD", dbms: Dbms = "mysql"): ERDProject {
  return {
    id: newId(),
    name,
    dbms,
    tables: [],
    relations: [],
    updatedAt: new Date().toISOString(),
  };
}

/** 프로젝트 목록에 뿌릴 메타데이터 */
export interface ProjectSummary {
  id: string;
  name: string;
  dbms: Dbms;
  tableCount: number;
  relationCount: number;
  updatedAt: string;
}

export function summarizeProject(project: ERDProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    dbms: project.dbms,
    tableCount: project.tables.length,
    relationCount: project.relations.length,
    updatedAt: project.updatedAt,
  };
}

/** 이름 뒤에 (사본), (사본 2) … 를 붙여 목록 안에서 겹치지 않게 만든다. */
export function copyName(base: string, taken: string[]): string {
  const used = new Set(taken.map((name) => name.toLowerCase()));
  let candidate = `${base} (사본)`;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (사본 ${index})`;
    index += 1;
  }
  return candidate;
}

export function duplicateProject(project: ERDProject, takenNames: string[]): ERDProject {
  // 테이블/컬럼 ID 를 새로 발급하되 관계가 가리키는 ID 도 함께 갈아끼운다.
  const idMap = new Map<string, string>();
  const remap = (oldId: string) => {
    const existing = idMap.get(oldId);
    if (existing) return existing;
    const fresh = newId();
    idMap.set(oldId, fresh);
    return fresh;
  };

  const tables = project.tables.map((table) => ({
    ...table,
    id: remap(table.id),
    columns: table.columns.map((column) => ({ ...column, id: remap(column.id) })),
    position: { ...table.position },
  }));

  const relations = project.relations.map((relation) => ({
    ...relation,
    id: newId(),
    sourceTableId: remap(relation.sourceTableId),
    sourceColumnId: remap(relation.sourceColumnId),
    targetTableId: remap(relation.targetTableId),
    targetColumnId: remap(relation.targetColumnId),
  }));

  return {
    id: newId(),
    name: copyName(project.name, takenNames),
    dbms: project.dbms,
    tables,
    relations,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 로컬 라이브러리와 서버 라이브러리를 합친다.
 * 같은 id 는 updatedAt 이 더 최신인 쪽을 채택하고, 한쪽에만 있는 건 둘 다 살린다.
 * 원본 객체를 그대로 돌려주므로 호출부가 참조 비교로 "푸시 필요 여부"를 판단할 수 있다.
 */
export function mergeLibraries(local: ERDProject[], remote: ERDProject[]): ERDProject[] {
  const byId = new Map<string, ERDProject>();
  for (const project of local) byId.set(project.id, project);
  for (const project of remote) {
    const existing = byId.get(project.id);
    if (!existing || project.updatedAt > existing.updatedAt) byId.set(project.id, project);
  }
  return [...byId.values()];
}

/* ------------------------------------------------------------------ */
/* 정규화 — LocalStorage · JSON Import · 서버 응답이 함께 쓴다            */
/* ------------------------------------------------------------------ */

const DBMS_VALUES = DBMS_OPTIONS.map((option) => option.value);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeColumn(raw: unknown, dbms: Dbms): Column | null {
  if (!isRecord(raw)) return null;
  const name = asOptionalString(raw.name);
  if (!name) return null;

  const type = (COLUMN_TYPES as string[]).includes(raw.type as string)
    ? (raw.type as ColumnType)
    : "VARCHAR";
  const rawLength = typeof raw.length === "number" && raw.length > 0 ? raw.length : undefined;

  return {
    id: asString(raw.id, newId()),
    name,
    type,
    length: rawLength ?? defaultLengthFor(dbms, type),
    isPK: raw.isPK === true,
    isFK: raw.isFK === true,
    notNull: raw.notNull === true,
    unique: raw.unique === true,
    defaultValue: asOptionalString(raw.defaultValue),
    comment: asOptionalString(raw.comment),
  };
}

function normalizeTable(raw: unknown, dbms: Dbms, index: number): TableData | null {
  if (!isRecord(raw)) return null;
  const name = asOptionalString(raw.name);
  if (!name) return null;

  const position = isRecord(raw.position) ? raw.position : {};
  const columns = Array.isArray(raw.columns)
    ? raw.columns.map((column) => normalizeColumn(column, dbms)).filter((c): c is Column => c !== null)
    : [];

  return {
    id: asString(raw.id, newId()),
    name,
    columns,
    position: {
      x: typeof position.x === "number" ? position.x : 80 + (index % 4) * 320,
      y: typeof position.y === "number" ? position.y : 80 + Math.floor(index / 4) * 280,
    },
    color: asOptionalString(raw.color),
  };
}

function normalizeRelation(raw: unknown, tables: TableData[]): Relation | null {
  if (!isRecord(raw)) return null;

  const hasColumn = (tableId: unknown, columnId: unknown) => {
    const table = tables.find((t) => t.id === tableId);
    return Boolean(table?.columns.some((c) => c.id === columnId));
  };

  // 존재하지 않는 테이블/컬럼을 가리키는 관계는 버린다.
  if (!hasColumn(raw.sourceTableId, raw.sourceColumnId)) return null;
  if (!hasColumn(raw.targetTableId, raw.targetColumnId)) return null;

  return {
    id: asString(raw.id, newId()),
    sourceTableId: raw.sourceTableId as string,
    sourceColumnId: raw.sourceColumnId as string,
    targetTableId: raw.targetTableId as string,
    targetColumnId: raw.targetColumnId as string,
    cardinality: CARDINALITIES.includes(raw.cardinality as Cardinality)
      ? (raw.cardinality as Cardinality)
      : "1:N",
  };
}

/**
 * 신뢰할 수 없는 값(LocalStorage / 업로드 JSON / 서버 응답)을 ERDProject 로 정규화한다.
 * 형태가 아예 다르면 null, 일부만 깨졌으면 그 부분만 버린다.
 */
export function normalizeProject(raw: unknown): ERDProject | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.tables)) return null;

  const dbms = DBMS_VALUES.includes(raw.dbms as Dbms) ? (raw.dbms as Dbms) : "mysql";
  const tables = raw.tables
    .map((table, index) => normalizeTable(table, dbms, index))
    .filter((table): table is TableData => table !== null);

  const relations = Array.isArray(raw.relations)
    ? raw.relations
        .map((relation) => normalizeRelation(relation, tables))
        .filter((relation): relation is Relation => relation !== null)
    : [];

  return {
    id: asString(raw.id, newId()),
    name: asString(raw.name, "Untitled ERD"),
    dbms,
    tables,
    relations,
    updatedAt: asString(raw.updatedAt, new Date().toISOString()),
  };
}

/* ------------------------------------------------------------------ */
/* JSON Export / Import                                                */
/* ------------------------------------------------------------------ */

export function serializeProject(project: ERDProject): string {
  return JSON.stringify(project, null, 2);
}

export type ParseResult = { ok: true; project: ERDProject } | { ok: false; error: string };

export function parseProjectJSON(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON 형식이 아닙니다." };
  }
  const project = normalizeProject(raw);
  if (!project) return { ok: false, error: "ERD 프로젝트 JSON이 아닙니다. (tables 배열이 필요합니다)" };
  return { ok: true, project };
}

/** 프로젝트 이름을 파일명으로 쓸 수 있게 정리한다. */
export function toFileName(name: string, extension: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_") || "erd";
  return `${base}.${extension}`;
}
