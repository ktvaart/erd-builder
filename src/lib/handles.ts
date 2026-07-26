export type HandleSide = "left" | "right";

const SEP = "::";

/**
 * 컬럼 row 하나당 좌/우 두 개의 핸들을 만든다.
 * ConnectionMode.Loose 로 동작하므로 핸들 타입은 모두 source 이고,
 * source/target(= FK/PK) 방향은 연결이 끝난 뒤 컬럼 속성으로 판단한다.
 */
export function handleId(tableId: string, columnId: string, side: HandleSide): string {
  return [tableId, columnId, side].join(SEP);
}

export interface ParsedHandle {
  tableId: string;
  columnId: string;
  side: HandleSide;
}

export function parseHandleId(id: string | null | undefined): ParsedHandle | null {
  if (!id) return null;
  const [tableId, columnId, side] = id.split(SEP);
  if (!tableId || !columnId || (side !== "left" && side !== "right")) return null;
  return { tableId, columnId, side };
}
