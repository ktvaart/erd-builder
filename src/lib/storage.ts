import { normalizeProject } from "@/lib/project";
import type { ERDProject } from "@/types/erd";

const LIBRARY_KEY = "erd-builder:library";
/** v1 은 프로젝트 1개만 저장했다. 발견하면 라이브러리로 옮기고 지운다. */
const LEGACY_PROJECT_KEY = "erd-builder:project";

export const LIBRARY_VERSION = 2;

export interface StoredLibrary {
  version: number;
  currentProjectId: string | null;
  projects: ERDProject[];
}

export const EMPTY_LIBRARY: StoredLibrary = {
  version: LIBRARY_VERSION,
  currentProjectId: null,
  projects: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLibrary(raw: unknown): StoredLibrary | null {
  if (!isRecord(raw) || !Array.isArray(raw.projects)) return null;
  const projects = raw.projects
    .map((project) => normalizeProject(project))
    .filter((project): project is ERDProject => project !== null);
  const currentProjectId =
    typeof raw.currentProjectId === "string" &&
    projects.some((project) => project.id === raw.currentProjectId)
      ? raw.currentProjectId
      : (projects[0]?.id ?? null);
  return { version: LIBRARY_VERSION, currentProjectId, projects };
}

/** v1 저장본 `{version:1, project}` 를 라이브러리 형태로 끌어올린다. */
function migrateLegacy(): StoredLibrary | null {
  try {
    const text = window.localStorage.getItem(LEGACY_PROJECT_KEY);
    if (!text) return null;
    const envelope = JSON.parse(text) as { version?: number; project?: unknown };
    const project = isRecord(envelope) ? normalizeProject(envelope.project) : null;
    if (!project) return null;
    const library: StoredLibrary = {
      version: LIBRARY_VERSION,
      currentProjectId: project.id,
      projects: [project],
    };
    saveLibrary(library);
    window.localStorage.removeItem(LEGACY_PROJECT_KEY);
    return library;
  } catch {
    return null;
  }
}

export function loadLibrary(): StoredLibrary {
  if (typeof window === "undefined") return EMPTY_LIBRARY;
  try {
    const text = window.localStorage.getItem(LIBRARY_KEY);
    if (text) {
      const parsed = JSON.parse(text) as unknown;
      const library = isRecord(parsed) && parsed.version === LIBRARY_VERSION ? normalizeLibrary(parsed) : null;
      if (library) return library;
    }
    return migrateLegacy() ?? EMPTY_LIBRARY;
  } catch {
    // 저장본이 깨졌다고 앱이 죽으면 안 된다. 빈 상태로 시작한다.
    return EMPTY_LIBRARY;
  }
}

export function saveLibrary(library: StoredLibrary): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify({ ...library, version: LIBRARY_VERSION }),
    );
    return true;
  } catch {
    // 용량 초과(QuotaExceededError) 등
    return false;
  }
}

export function clearLibrary(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LIBRARY_KEY);
  } catch {
    /* 무시 */
  }
}
