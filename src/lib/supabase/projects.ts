"use client";

import { normalizeProject } from "@/lib/project";
import { getSupabaseClient } from "./client";
import { PROJECTS_TABLE, type ProjectRow } from "./config";
import type { ERDProject } from "@/types/erd";

export type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** 서버가 돌려준 행을 ERDProject 로 되돌린다. data 는 신뢰하지 않고 정규화한다. */
function rowToProject(row: ProjectRow): ERDProject | null {
  const project = normalizeProject(row.data);
  if (!project) return null;
  // 행의 메타데이터가 진실이다. data 안의 값이 어긋나 있어도 행 기준으로 맞춘다.
  return { ...project, id: row.id, name: row.name, updatedAt: row.updated_at };
}

function projectToRow(project: ERDProject, ownerId: string) {
  return {
    id: project.id,
    owner_id: ownerId,
    name: project.name,
    dbms: project.dbms,
    data: project,
    updated_at: project.updatedAt,
  };
}

export async function fetchRemoteProjects(): Promise<RemoteResult<ERDProject[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "Supabase가 설정되지 않았습니다." };

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("id, owner_id, name, dbms, data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const projects = (data as ProjectRow[])
    .map(rowToProject)
    .filter((project): project is ERDProject => project !== null);

  return { ok: true, value: projects };
}

export interface PushOutcome {
  /** 서버에 이미 더 새로운 내용이 있어 덮어쓰지 않은 프로젝트 ID */
  conflicted: string[];
}

/**
 * 프로젝트를 서버에 올린다.
 *
 * 낙관적 동시성: `updated_at` 이 우리가 마지막으로 본 값과 같을 때만 갱신한다.
 * 다른 탭/기기가 먼저 저장했다면 0행이 갱신되고 conflicted 에 담긴다.
 * 신규 행은 insert 로 넣는다 (중복 키는 그대로 충돌로 본다).
 */
export async function pushProject(
  project: ERDProject,
  ownerId: string,
  lastKnownUpdatedAt: string | null,
): Promise<RemoteResult<PushOutcome>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "Supabase가 설정되지 않았습니다." };

  const row = projectToRow(project, ownerId);

  if (lastKnownUpdatedAt === null) {
    const { error } = await supabase.from(PROJECTS_TABLE).insert(row);
    if (!error) return { ok: true, value: { conflicted: [] } };
    // 23505 = unique_violation. 이미 있는 행이면 충돌로 처리한다.
    if (error.code === "23505") return { ok: true, value: { conflicted: [project.id] } };
    return { ok: false, error: error.message };
  }

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .update(row)
    .eq("id", project.id)
    .eq("updated_at", lastKnownUpdatedAt)
    .select("id");

  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { conflicted: data.length === 0 ? [project.id] : [] } };
}

export async function deleteRemoteProject(projectId: string): Promise<RemoteResult<null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "Supabase가 설정되지 않았습니다." };

  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: null };
}
