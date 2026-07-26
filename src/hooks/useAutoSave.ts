"use client";

import * as React from "react";
import { useERDStore } from "@/hooks/useERDStore";
import { useUIStore } from "@/hooks/useUIStore";
import { LIBRARY_VERSION, loadLibrary, saveLibrary } from "@/lib/storage";

/** 변경이 잦아 매번 저장하면 낭비다. 마지막 변경 후 이만큼 조용하면 저장한다. */
const DEBOUNCE_MS = 500;

/**
 * 마운트 시 LocalStorage 에서 라이브러리를 복원하고,
 * 이후 프로젝트 변경을 debounce 해서 다시 저장한다.
 * @returns 복원이 끝났는지 여부
 */
export function useAutoSave(): boolean {
  const [hydrated, setHydrated] = React.useState(false);

  // 복원은 클라이언트에서만, 한 번만.
  React.useEffect(() => {
    const library = loadLibrary();
    if (library.projects.length > 0) {
      useERDStore.getState().replaceLibrary(library.projects, library.currentProjectId);
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;

    const setSaveState = useUIStore.getState().setSaveState;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      const { projects, currentProjectId } = useERDStore.getState();
      const ok = saveLibrary({ version: LIBRARY_VERSION, currentProjectId, projects });
      setSaveState(ok ? "saved" : "error");
    };

    const unsubscribe = useERDStore.subscribe((state, previous) => {
      // 선택(selection)만 바뀐 경우는 저장할 게 없다.
      if (state.projects === previous.projects && state.currentProjectId === previous.currentProjectId) {
        return;
      }
      setSaveState("pending");
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    });

    // 마지막 debounce 구간에서 창을 닫아도 잃지 않도록
    window.addEventListener("beforeunload", flush);

    return () => {
      window.removeEventListener("beforeunload", flush);
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
    };
  }, [hydrated]);

  return hydrated;
}
