import type { Cardinality, ColumnType, Dbms } from "@/types/erd";

export const CARDINALITIES: Cardinality[] = ["1:1", "1:N", "N:M"];

export interface DbmsOption {
  value: Dbms;
  label: string;
  /** v1 에서 DDL 생성까지 지원하는 DBMS 인지 여부 */
  supported: boolean;
}

export const DBMS_OPTIONS: DbmsOption[] = [
  { value: "mysql", label: "MySQL", supported: true },
  { value: "mssql", label: "MSSQL", supported: true },
  { value: "postgresql", label: "PostgreSQL", supported: false },
  { value: "oracle", label: "Oracle", supported: false },
  { value: "sqlite", label: "SQLite", supported: false },
  { value: "mariadb", label: "MariaDB", supported: false },
];

export const COLUMN_TYPES: ColumnType[] = [
  "INT",
  "BIGINT",
  "VARCHAR",
  "TEXT",
  "DATETIME",
  "DATE",
  "BOOLEAN",
  "DECIMAL",
  "FLOAT",
  "UUID",
];

export interface TypeSpec {
  /** 실제 DDL 에 찍히는 타입. `{n}` 자리에 length 가 치환된다. */
  sql: string;
  defaultLength?: number;
}

/**
 * DBMS 별 타입 매핑.
 * MySQL 의 VARCHAR(255) 와 MSSQL 의 NVARCHAR(255) 처럼 이름이 다르므로
 * 논리 타입(ColumnType) → 물리 타입(sql) 매핑을 DBMS 별로 분리해서 관리한다.
 */
export const TYPE_PRESETS: Record<Dbms, Record<ColumnType, TypeSpec>> = {
  mysql: {
    INT: { sql: "INT" },
    BIGINT: { sql: "BIGINT" },
    VARCHAR: { sql: "VARCHAR({n})", defaultLength: 255 },
    TEXT: { sql: "TEXT" },
    DATETIME: { sql: "DATETIME" },
    DATE: { sql: "DATE" },
    BOOLEAN: { sql: "TINYINT(1)" },
    DECIMAL: { sql: "DECIMAL({n}, 2)", defaultLength: 18 },
    FLOAT: { sql: "FLOAT" },
    UUID: { sql: "CHAR(36)" },
  },
  mariadb: {
    INT: { sql: "INT" },
    BIGINT: { sql: "BIGINT" },
    VARCHAR: { sql: "VARCHAR({n})", defaultLength: 255 },
    TEXT: { sql: "TEXT" },
    DATETIME: { sql: "DATETIME" },
    DATE: { sql: "DATE" },
    BOOLEAN: { sql: "BOOLEAN" },
    DECIMAL: { sql: "DECIMAL({n}, 2)", defaultLength: 18 },
    FLOAT: { sql: "FLOAT" },
    UUID: { sql: "UUID" },
  },
  mssql: {
    INT: { sql: "INT" },
    BIGINT: { sql: "BIGINT" },
    VARCHAR: { sql: "NVARCHAR({n})", defaultLength: 255 },
    TEXT: { sql: "NVARCHAR(MAX)" },
    DATETIME: { sql: "DATETIME2" },
    DATE: { sql: "DATE" },
    BOOLEAN: { sql: "BIT" },
    DECIMAL: { sql: "DECIMAL({n}, 2)", defaultLength: 18 },
    FLOAT: { sql: "FLOAT" },
    UUID: { sql: "UNIQUEIDENTIFIER" },
  },
  postgresql: {
    INT: { sql: "INTEGER" },
    BIGINT: { sql: "BIGINT" },
    VARCHAR: { sql: "VARCHAR({n})", defaultLength: 255 },
    TEXT: { sql: "TEXT" },
    DATETIME: { sql: "TIMESTAMP" },
    DATE: { sql: "DATE" },
    BOOLEAN: { sql: "BOOLEAN" },
    DECIMAL: { sql: "NUMERIC({n}, 2)", defaultLength: 18 },
    FLOAT: { sql: "REAL" },
    UUID: { sql: "UUID" },
  },
  oracle: {
    INT: { sql: "NUMBER(10)" },
    BIGINT: { sql: "NUMBER(19)" },
    VARCHAR: { sql: "VARCHAR2({n})", defaultLength: 255 },
    TEXT: { sql: "CLOB" },
    DATETIME: { sql: "TIMESTAMP" },
    DATE: { sql: "DATE" },
    BOOLEAN: { sql: "NUMBER(1)" },
    DECIMAL: { sql: "NUMBER({n}, 2)", defaultLength: 18 },
    FLOAT: { sql: "BINARY_FLOAT" },
    UUID: { sql: "RAW(16)" },
  },
  sqlite: {
    INT: { sql: "INTEGER" },
    BIGINT: { sql: "INTEGER" },
    VARCHAR: { sql: "VARCHAR({n})", defaultLength: 255 },
    TEXT: { sql: "TEXT" },
    DATETIME: { sql: "DATETIME" },
    DATE: { sql: "DATE" },
    BOOLEAN: { sql: "INTEGER" },
    DECIMAL: { sql: "NUMERIC" },
    FLOAT: { sql: "REAL" },
    UUID: { sql: "TEXT" },
  },
};

/** 해당 DBMS 에서 이 타입이 길이 인자를 받는지 */
export function typeHasLength(dbms: Dbms, type: ColumnType): boolean {
  return TYPE_PRESETS[dbms][type].sql.includes("{n}");
}

/** 논리 타입 + 길이를 DBMS 물리 타입 문자열로 변환. DDL 생성기와 노드 렌더링이 공유한다. */
export function formatColumnType(dbms: Dbms, type: ColumnType, length?: number): string {
  const spec = TYPE_PRESETS[dbms][type];
  if (!spec.sql.includes("{n}")) return spec.sql;
  return spec.sql.replace("{n}", String(length ?? spec.defaultLength ?? 255));
}

/** 타입을 바꿀 때 채워 넣을 기본 길이 */
export function defaultLengthFor(dbms: Dbms, type: ColumnType): number | undefined {
  return typeHasLength(dbms, type) ? TYPE_PRESETS[dbms][type].defaultLength : undefined;
}

export const TABLE_COLORS = [
  "#64748b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
] as const;
