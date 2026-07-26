"use client";

import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import { Check, ChevronDown, Copy, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton, Input } from "@/components/common/ui";
import { selectProject, useERDStore } from "@/hooks/useERDStore";
import { summarizeProject, type ProjectSummary } from "@/lib/project";
import { cn } from "@/lib/utils";

export function ProjectMenu() {
  const [open, setOpen] = React.useState(false);
  // projects 는 참조가 안정적이므로 셀렉터로 받고, 가공은 useMemo 에서 한다.
  const projects = useERDStore((state) => state.projects);
  const currentId = useERDStore((state) => state.currentProjectId);
  const summaries = React.useMemo(() => projects.map(summarizeProject), [projects]);

  return (
    <div className="relative shrink-0">
      <Button onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <FolderOpen className="size-3.5" />
        프로젝트
        <span className="text-ink-faint tabular-nums">{summaries.length}</span>
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <>
          {/* 바깥 클릭으로 닫기 */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <ProjectList
            summaries={summaries}
            currentId={currentId}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function ProjectList({
  summaries,
  currentId,
  onClose,
}: {
  summaries: ProjectSummary[];
  currentId: string;
  onClose: () => void;
}) {
  const createProject = useERDStore((state) => state.createProject);
  const { fitView } = useReactFlow();

  // 최근 수정 순으로 보여준다.
  const sorted = React.useMemo(
    () => [...summaries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [summaries],
  );

  const refit = () => requestAnimationFrame(() => fitView({ padding: 0.25, maxZoom: 1 }));

  return (
    <div className="absolute top-full right-0 z-30 mt-1 flex max-h-[70vh] w-[340px] flex-col rounded-lg border border-line bg-surface shadow-lg">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[10px] font-semibold tracking-wide text-ink-faint uppercase">
          프로젝트 {summaries.length}개
        </span>
        <Button
          variant="primary"
          onClick={() => {
            createProject();
            refit();
            onClose();
          }}
        >
          <Plus className="size-3.5" />
          새 프로젝트
        </Button>
      </div>

      <ul className="erd-scroll flex-1 overflow-y-auto p-1">
        {sorted.map((summary) => (
          <ProjectRow
            key={summary.id}
            summary={summary}
            active={summary.id === currentId}
            canDelete={summaries.length > 1}
            onOpened={() => {
              refit();
              onClose();
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function ProjectRow({
  summary,
  active,
  canDelete,
  onOpened,
}: {
  summary: ProjectSummary;
  active: boolean;
  canDelete: boolean;
  onOpened: () => void;
}) {
  const openProject = useERDStore((state) => state.openProject);
  const duplicateProject = useERDStore((state) => state.duplicateProject);
  const deleteProject = useERDStore((state) => state.deleteProject);
  const renameProjectById = useERDStore((state) => state.renameProjectById);

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(summary.name);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== summary.name) renameProjectById(summary.id, next);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="flex items-center gap-1 p-1">
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setEditing(false);
          }}
        />
        <IconButton label="이름 저장" variant="primary" onMouseDown={commit}>
          <Check className="size-3.5" />
        </IconButton>
      </li>
    );
  }

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
          active ? "bg-accent-soft" : "hover:bg-surface-muted",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (!active) openProject(summary.id);
            onOpened();
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className={cn("truncate text-xs", active ? "font-semibold text-accent" : "text-ink")}>
            {summary.name}
          </p>
          <p className="truncate text-[10px] text-ink-faint">
            테이블 {summary.tableCount} · 관계 {summary.relationCount} ·{" "}
            {summary.dbms.toUpperCase()} · {formatRelativeTime(summary.updatedAt)}
          </p>
        </button>

        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconButton
            label="이름 변경"
            className="size-6"
            onClick={() => {
              setDraft(summary.name);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
          </IconButton>
          <IconButton
            label="복제"
            className="size-6"
            onClick={() => {
              duplicateProject(summary.id);
              onOpened();
            }}
          >
            <Copy className="size-3.5" />
          </IconButton>
          <IconButton
            label="삭제"
            variant="danger"
            className="size-6"
            disabled={!canDelete}
            title={canDelete ? "삭제" : "마지막 프로젝트는 삭제할 수 없습니다"}
            onClick={() => {
              if (window.confirm(`'${summary.name}' 프로젝트를 삭제할까요?`)) {
                deleteProject(summary.id);
              }
            }}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </span>
      </div>
    </li>
  );
}

/** 팝오버가 열릴 때만 렌더되므로 SSR 불일치 걱정이 없다. */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "-";
  const diffMinutes = Math.floor((Date.now() - then) / 60_000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

/** 헤더에서 활성 프로젝트 이름을 인라인 편집하는 입력 */
export function ProjectNameInput() {
  const name = useERDStore((state) => selectProject(state).name);
  const renameProject = useERDStore((state) => state.renameProject);

  return (
    <input
      value={name}
      onChange={(event) => renameProject(event.target.value)}
      aria-label="프로젝트 이름"
      className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium outline-none transition-colors hover:border-line focus:border-accent focus:ring-2 focus:ring-accent/20"
    />
  );
}
