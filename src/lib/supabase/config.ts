/**
 * Supabase 는 선택 기능이다.
 * 환경변수가 없으면 로그인/동기화 UI 를 통째로 감추고 LocalStorage 전용으로 동작한다.
 * 이 파일은 서버/클라이언트 양쪽에서 쓰이므로 브라우저 전용 API 를 넣지 말 것.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/** projects 테이블 한 행. id 는 uuid 가 아니라 text — 로컬에서 만든 ID 를 그대로 올리기 위함. */
export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  dbms: string;
  data: unknown;
  updated_at: string;
}

export const PROJECTS_TABLE = "projects";
