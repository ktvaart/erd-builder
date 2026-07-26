import { customAlphabet } from "nanoid";

/**
 * 핸들 ID 를 `${tableId}::${columnId}::${side}` 로 조합하기 때문에
 * 구분자와 충돌하지 않도록 영숫자만 쓰는 알파벳을 사용한다.
 */
export const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
