import { formatColumnType } from "@/constants/column-types";
import type { Column, Dbms, ERDProject, Relation, TableData } from "@/types/erd";

export interface DDLOptions {
  /** FOREIGN KEY 제약조건 포함 여부 */
  includeForeignKeys: boolean;
  /** 컬럼 설명(comment) 포함 여부 */
  includeComments: boolean;
  /** CREATE TABLE IF NOT EXISTS 사용 (지원 DBMS 한정) */
  ifNotExists: boolean;
  /** 식별자를 백틱/대괄호/쌍따옴표로 감쌀지 여부 */
  quoteIdentifiers: boolean;
}

export const DEFAULT_DDL_OPTIONS: DDLOptions = {
  includeForeignKeys: true,
  includeComments: true,
  ifNotExists: false,
  quoteIdentifiers: true,
};

interface Dialect {
  open: string;
  close: string;
  /** MySQL 계열만 컬럼 정의 뒤에 COMMENT '...' 를 붙일 수 있다 */
  inlineColumnComment: boolean;
  supportsIfNotExists: boolean;
  /** PK/UNIQUE/FK 에 CONSTRAINT 이름을 붙이는 스타일인지 */
  namedConstraints: boolean;
}

const DIALECTS: Record<Dbms, Dialect> = {
  mysql: { open: "`", close: "`", inlineColumnComment: true, supportsIfNotExists: true, namedConstraints: false },
  mariadb: { open: "`", close: "`", inlineColumnComment: true, supportsIfNotExists: true, namedConstraints: false },
  mssql: { open: "[", close: "]", inlineColumnComment: false, supportsIfNotExists: false, namedConstraints: true },
  postgresql: { open: '"', close: '"', inlineColumnComment: false, supportsIfNotExists: true, namedConstraints: true },
  oracle: { open: '"', close: '"', inlineColumnComment: false, supportsIfNotExists: false, namedConstraints: true },
  sqlite: { open: '"', close: '"', inlineColumnComment: false, supportsIfNotExists: true, namedConstraints: false },
};

export function dialectSupportsIfNotExists(dbms: Dbms): boolean {
  return DIALECTS[dbms].supportsIfNotExists;
}

/* ------------------------------------------------------------------ */
/* 위상정렬                                                             */
/* ------------------------------------------------------------------ */

export interface SortResult {
  order: TableData[];
  /** 순환 참조가 있어 CREATE 순서만으로는 FK 를 만족시킬 수 없는 경우 */
  cyclic: boolean;
}

/**
 * FK 가 참조하는 테이블이 먼저 생성되도록 테이블을 정렬한다 (Kahn's algorithm).
 * 자기 참조(self reference)는 순서에 영향을 주지 않으므로 의존성에서 제외한다.
 */
export function sortTablesByDependency(tables: TableData[], relations: Relation[]): SortResult {
  const byId = new Map(tables.map((table) => [table.id, table]));
  const dependencies = new Map<string, Set<string>>(tables.map((table) => [table.id, new Set()]));

  for (const relation of relations) {
    if (relation.sourceTableId === relation.targetTableId) continue;
    if (!byId.has(relation.sourceTableId) || !byId.has(relation.targetTableId)) continue;
    dependencies.get(relation.sourceTableId)!.add(relation.targetTableId);
  }

  const order: TableData[] = [];
  // Set 은 삽입 순서를 유지하므로 의존성이 같은 테이블끼리는 원래 순서가 보존된다.
  const remaining = new Set(tables.map((table) => table.id));

  let progressed = true;
  while (remaining.size > 0 && progressed) {
    progressed = false;
    for (const id of [...remaining]) {
      const deps = dependencies.get(id)!;
      const ready = [...deps].every((dep) => !remaining.has(dep));
      if (!ready) continue;
      order.push(byId.get(id)!);
      remaining.delete(id);
      progressed = true;
    }
  }

  const cyclic = remaining.size > 0;
  for (const id of remaining) order.push(byId.get(id)!);

  return { order, cyclic };
}

/* ------------------------------------------------------------------ */
/* DDL 생성                                                             */
/* ------------------------------------------------------------------ */

export interface GeneratedDDL {
  sql: string;
  /** 사용자에게 보여줄 경고 (순환 참조, 빈 테이블 등) */
  warnings: string[];
}

export function generateDDL(project: ERDProject, options: DDLOptions = DEFAULT_DDL_OPTIONS): GeneratedDDL {
  const dialect = DIALECTS[project.dbms];
  const warnings: string[] = [];

  const quote = (identifier: string) =>
    options.quoteIdentifiers ? `${dialect.open}${identifier}${dialect.close}` : identifier;

  if (project.tables.length === 0) {
    return { sql: "-- 테이블이 없습니다. 캔버스에 테이블을 추가해 주세요.", warnings };
  }

  const { order, cyclic } = sortTablesByDependency(project.tables, project.relations);
  if (cyclic) {
    warnings.push(
      "테이블 간 순환 참조가 있어 CREATE 순서만으로는 FK를 만들 수 없습니다. FK를 ALTER TABLE 문으로 분리했습니다.",
    );
  }

  // 순환 참조가 있으면 FK 를 전부 뒤로 빼야 항상 실행 가능한 스크립트가 된다.
  const fkAsAlter = cyclic;
  const tableById = new Map(project.tables.map((table) => [table.id, table]));
  const usedConstraintNames = new Set<string>();

  /** 스키마 전체에서 유일한 제약조건 이름을 만든다. */
  const uniqueConstraintName = (base: string) => {
    let name = base;
    let index = 2;
    while (usedConstraintNames.has(name.toLowerCase())) {
      name = `${base}_${index}`;
      index += 1;
    }
    usedConstraintNames.add(name.toLowerCase());
    return name;
  };

  const resolveRelation = (relation: Relation) => {
    const sourceTable = tableById.get(relation.sourceTableId);
    const targetTable = tableById.get(relation.targetTableId);
    const sourceColumn = sourceTable?.columns.find((c) => c.id === relation.sourceColumnId);
    const targetColumn = targetTable?.columns.find((c) => c.id === relation.targetColumnId);
    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) return null;
    return { sourceTable, targetTable, sourceColumn, targetColumn };
  };

  const foreignKeyClause = (relation: Relation) => {
    const resolved = resolveRelation(relation);
    if (!resolved) return null;
    const { sourceTable, targetTable, sourceColumn, targetColumn } = resolved;
    const name = uniqueConstraintName(`fk_${sourceTable.name}_${sourceColumn.name}`);
    const clause =
      `FOREIGN KEY (${quote(sourceColumn.name)}) ` +
      `REFERENCES ${quote(targetTable.name)} (${quote(targetColumn.name)})`;
    return { name, clause, sourceTable };
  };

  const statements: string[] = [];
  const alterStatements: string[] = [];

  for (const table of order) {
    if (table.columns.length === 0) {
      warnings.push(`'${table.name}' 테이블에 컬럼이 없어 건너뛰었습니다.`);
      continue;
    }

    const lines: { sql: string; comment?: string }[] = [];

    // --- 컬럼 ---
    for (const column of table.columns) {
      lines.push({
        sql: columnDefinition(column, project.dbms, dialect, options, quote),
        comment:
          !dialect.inlineColumnComment && options.includeComments && column.comment
            ? column.comment
            : undefined,
      });
    }

    // --- PRIMARY KEY ---
    const pkColumns = table.columns.filter((column) => column.isPK);
    if (pkColumns.length > 0) {
      const columnList = pkColumns.map((column) => quote(column.name)).join(", ");
      const constraint = `PRIMARY KEY (${columnList})`;
      lines.push({
        sql: dialect.namedConstraints
          ? `CONSTRAINT ${quote(uniqueConstraintName(`pk_${table.name}`))} ${constraint}`
          : constraint,
      });
    } else {
      warnings.push(`'${table.name}' 테이블에 PK가 없습니다.`);
    }

    // --- UNIQUE (단독 PK 인 컬럼은 이미 유니크하므로 제외) ---
    for (const column of table.columns) {
      if (!column.unique || column.isPK) continue;
      const constraint = `UNIQUE (${quote(column.name)})`;
      lines.push({
        sql: dialect.namedConstraints
          ? `CONSTRAINT ${quote(uniqueConstraintName(`uq_${table.name}_${column.name}`))} ${constraint}`
          : constraint,
      });
    }

    // --- FOREIGN KEY ---
    if (options.includeForeignKeys) {
      const outgoing = project.relations.filter((relation) => relation.sourceTableId === table.id);
      for (const relation of outgoing) {
        const fk = foreignKeyClause(relation);
        if (!fk) continue;
        if (fkAsAlter) {
          alterStatements.push(
            `ALTER TABLE ${quote(table.name)}\n` +
              `  ADD CONSTRAINT ${quote(fk.name)} ${fk.clause};`,
          );
        } else {
          // FK 는 어느 DBMS 든 이름을 붙여 두는 편이 이후 DROP/변경에 유리하다.
          lines.push({ sql: `CONSTRAINT ${quote(fk.name)} ${fk.clause}` });
        }
      }
    }

    const body = lines
      .map((line, index) => {
        const comma = index < lines.length - 1 ? "," : "";
        const trailing = line.comment ? ` -- ${line.comment.replace(/\r?\n/g, " ")}` : "";
        return `  ${line.sql}${comma}${trailing}`;
      })
      .join("\n");

    const ifNotExists = options.ifNotExists && dialect.supportsIfNotExists ? "IF NOT EXISTS " : "";
    statements.push(`CREATE TABLE ${ifNotExists}${quote(table.name)} (\n${body}\n);`);
  }

  const header = [
    `-- ${project.name}`,
    `-- ${project.dbms.toUpperCase()} · ERD Builder`,
    "",
    "",
  ].join("\n");

  const sections = [header + statements.join("\n\n")];
  if (alterStatements.length > 0) {
    sections.push(["-- 순환 참조로 인해 분리된 FK 제약조건", alterStatements.join("\n\n")].join("\n"));
  }

  return { sql: sections.join("\n\n") + "\n", warnings };
}

/* ------------------------------------------------------------------ */

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function columnDefinition(
  column: Column,
  dbms: Dbms,
  dialect: Dialect,
  options: DDLOptions,
  quote: (identifier: string) => string,
): string {
  const parts = [quote(column.name), formatColumnType(dbms, column.type, column.length)];

  if (column.notNull || column.isPK) parts.push("NOT NULL");
  // DEFAULT 는 SQL 표현식으로 그대로 넘긴다 (0, 'abc', CURRENT_TIMESTAMP 등).
  if (column.defaultValue) parts.push(`DEFAULT ${column.defaultValue}`);
  if (dialect.inlineColumnComment && options.includeComments && column.comment) {
    parts.push(`COMMENT '${escapeSqlString(column.comment)}'`);
  }

  return parts.join(" ");
}
