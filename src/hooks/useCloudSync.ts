"use client";

import * as React from "react";
import { useAuthStore } from "@/hooks/useAuth";
import { useERDStore } from "@/hooks/useERDStore";
import { useUIStore } from "@/hooks/useUIStore";
import { copyName, mergeLibraries } from "@/lib/project";
import { newId } from "@/lib/ids";
import { deleteRemoteProject, fetchRemoteProjects, pushProject } from "@/lib/supabase/projects";
import type { ERDProject } from "@/types/erd";

/** 로컬 저장(500ms)보다 길게 잡는다. 서버 왕복은 비싸다. */
const PUSH_DEBOUNCE_MS = 2000;

/**
 * 로그인 상태에서 라이브러리를 Supabase 와 동기화한다.
 *
 * - 로그인 직후: 서버 목록을 받아 로컬과 병합한다. 어느 쪽도 버리지 않는다.
 * - 이후 변경: 2초 debounce 후 바뀐 프로젝트만 올린다.
 * - 충돌: 서버가 더 새로우면 서버 버전을 **별도 프로젝트로 복사해 두고** 로컬을 올린다.
 *   (양쪽 다 남기고 사용자가 직접 정리하게 한다)
 *
 * @param localReady LocalStorage 복원이 끝났는지. 끝나기 전에 동기화하면 안 된다.
 */
export function useCloudSync(localReady: boolean): void {
  const enabled = useAuthStore((state) => state.enabled);
  const authReady = useAuthStore((state) => state.ready);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  /** 서버 행의 updated_at. 낙관적 동시성 검사의 기준선이자 "서버에 존재함"의 표시. */
  const baseline = React.useRef(new Map<string, string>());
  /** 마지막으로 서버에 올린 프로젝트 객체. 참조가 다르면 dirty. */
  const lastPushed = React.useRef(new Map<string, ERDProject>());
  /** 초기 동기화가 끝나기 전에는 푸시하지 않는다. */
  const primed = React.useRef(false);

  /* ---------- 초기 동기화 ---------- */
  React.useEffect(() => {
    const { setCloud } = useUIStore.getState();

    primed.current = false;
    baseline.current.clear();
    lastPushed.current.clear();

    if (!enabled || !authReady || !localReady || !userId) {
      setCloud("off");
      return;
    }

    let cancelled = false;

    (async () => {
      setCloud("syncing");
      const result = await fetchRemoteProjects();
      if (cancelled) return;

      if (!result.ok) {
        setCloud("error", result.error);
        return;
      }

      const remote = result.value;
      const store = useERDStore.getState();
      const merged = mergeLibraries(store.projects, remote);

      for (const project of remote) {
        baseline.current.set(project.id, project.updatedAt);
        // 병합 결과가 서버 객체 그대로면 다시 올릴 필요가 없다.
        const chosen = merged.find((candidate) => candidate.id === project.id);
        if (chosen === project) lastPushed.current.set(project.id, project);
      }

      store.replaceLibrary(merged, store.currentProjectId);
      primed.current = true;
      setCloud("synced");
      // 서버에 없던 로컬 프로젝트는 아래 구독이 dirty 로 감지해 올린다.
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, authReady, localReady, userId]);

  /* ---------- 변경 푸시 ---------- */
  React.useEffect(() => {
    if (!enabled || !authReady || !localReady || !userId) return;

    const { setCloud } = useUIStore.getState();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const flush = async () => {
      if (!primed.current || inFlight) return;
      inFlight = true;
      try {
        const projects = useERDStore.getState().projects;
        const currentIds = new Set(projects.map((project) => project.id));

        const dirty = projects.filter((project) => lastPushed.current.get(project.id) !== project);
        const removed = [...baseline.current.keys()].filter((id) => !currentIds.has(id));

        if (dirty.length === 0 && removed.length === 0) return;

        setCloud("syncing");
        let failure: string | null = null;

        for (const id of removed) {
          const result = await deleteRemoteProject(id);
          if (result.ok) {
            baseline.current.delete(id);
            lastPushed.current.delete(id);
          } else {
            failure = result.error;
          }
        }

        for (const project of dirty) {
          const result = await pushProject(project, userId, baseline.current.get(project.id) ?? null);
          if (!result.ok) {
            failure = result.error;
            continue;
          }
          if (result.value.conflicted.length > 0) {
            await resolveConflict(project, baseline, lastPushed);
            continue;
          }
          baseline.current.set(project.id, project.updatedAt);
          lastPushed.current.set(project.id, project);
        }

        setCloud(failure ? "error" : "synced", failure);
      } finally {
        inFlight = false;
      }
    };

    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void flush(), PUSH_DEBOUNCE_MS);
    };

    const unsubscribe = useERDStore.subscribe((state, previous) => {
      if (state.projects === previous.projects) return;
      schedule();
    });

    // 초기 동기화 직후 남아 있는 미업로드분을 한 번 밀어준다.
    schedule();

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, authReady, localReady, userId]);
}

/**
 * 서버가 더 새로워 덮어쓰지 못한 경우.
 * 서버 버전을 새 프로젝트로 복사해 두고(이름에 표시), 로컬 버전은 다음 푸시에서 올라가게 한다.
 * 어느 쪽도 사라지지 않는다.
 */
async function resolveConflict(
  local: ERDProject,
  baseline: React.RefObject<Map<string, string>>,
  lastPushed: React.RefObject<Map<string, ERDProject>>,
): Promise<void> {
  const result = await fetchRemoteProjects();
  if (!result.ok) return;

  const server = result.value.find((project) => project.id === local.id);
  if (!server) {
    // 서버에서 지워졌다면 기준선을 비워 다음 푸시가 insert 로 들어가게 한다.
    baseline.current.delete(local.id);
    lastPushed.current.delete(local.id);
    return;
  }

  const store = useERDStore.getState();
  const names = store.projects.map((project) => project.name);
  const preserved: ERDProject = {
    ...server,
    id: newId(),
    name: copyName(`${server.name} (서버 버전)`, names),
  };

  store.replaceLibrary([...store.projects, preserved], store.currentProjectId);

  // 기준선을 서버 값으로 맞춰 다음 푸시에서 로컬 버전이 반영되게 한다.
  baseline.current.set(local.id, server.updatedAt);
  lastPushed.current.delete(local.id);

  useUIStore
    .getState()
    .setCloud("error", `'${local.name}'이(가) 다른 곳에서도 수정되어 서버 버전을 따로 보관했습니다.`);
}
