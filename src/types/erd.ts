export type ColumnType =
  | "INT"
  | "BIGINT"
  | "VARCHAR"
  | "TEXT"
  | "DATETIME"
  | "DATE"
  | "BOOLEAN"
  | "DECIMAL"
  | "FLOAT"
  | "UUID";

export type Dbms = "mysql" | "mssql" | "postgresql" | "oracle" | "sqlite" | "mariadb";

export type Cardinality = "1:1" | "1:N" | "N:M";

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  /** VARCHAR(50) 의 50. 길이를 갖지 않는 타입이면 undefined */
  length?: number;
  isPK: boolean;
  /** 관계선으로부터 파생되는 값. 직접 수정하지 말고 relation 을 통해 갱신한다. */
  isFK: boolean;
  notNull: boolean;
  unique: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface TableData {
  id: string;
  name: string;
  columns: Column[];
  position: { x: number; y: number };
  color?: string;
}

export interface Relation {
  id: string;
  /** 참조하는 쪽 (FK 를 들고 있는 테이블) */
  sourceTableId: string;
  sourceColumnId: string;
  /** 참조되는 쪽 (보통 PK) */
  targetTableId: string;
  targetColumnId: string;
  cardinality: Cardinality;
}

export interface ERDProject {
  id: string;
  name: string;
  dbms: Dbms;
  tables: TableData[];
  relations: Relation[];
  updatedAt: string;
}
