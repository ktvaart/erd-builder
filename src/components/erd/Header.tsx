"use client";

import { Check, Cloud, CloudOff, Database, FileCode2 } from "lucide-react";
import { Button, Select } from "@/components/common/ui";
import { DBMS_OPTIONS } from "@/constants/column-types";
import { selectProject, useERDStore } from "@/hooks/useERDStore";
import { useUIStore } from "@/hooks/useUIStore";
import { cn } from "@/lib/utils";
import type { Dbms } from "@/types/erd";
import { AccountMenu } from "./AccountMenu";
import { ProjectMenu, ProjectNameInput } from "./ProjectMenu";

export function Header() {
  const dbms = useERDStore((state) => selectProject(state).dbms);
  const setDbms = useERDStore((state) => state.setDbms);

  const exportOpen = useUIStore((state) => state.exportOpen);
  const toggleExport = useUIStore((state) => state.toggleExport);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-accent" />
        <span className="text-sm font-semibold tracking-tight">ERD Builder</span>
      </div>

      <span className="h-4 w-px bg-line" />

      <ProjectNameInput />

      <SaveIndicator />

      <ProjectMenu />

      <label className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        DBMS
        <Select
          value={dbms}
          onChange={(event) => setDbms(event.target.value as Dbms)}
          className="w-[132px]"
        >
          {DBMS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {option.supported ? "" : " (v2)"}
            </option>
          ))}
        </Select>
      </label>

      <Button
        variant={exportOpen ? "primary" : "default"}
        onClick={() => toggleExport()}
        aria-expanded={exportOpen}
      >
        <FileCode2 className="size-3.5" />
        Export
      </Button>

      <AccountMenu />
    </header>
  );
}

function SaveIndicator() {
  const saveState = useUIStore((state) => state.saveState);
  if (saveState === "idle") return null;

  const view = {
    pending: { icon: Cloud, text: "저장 중…", className: "text-ink-faint" },
    saved: { icon: Check, text: "저장됨", className: "text-ink-faint" },
    error: { icon: CloudOff, text: "저장 실패", className: "text-danger" },
  }[saveState];

  const Icon = view.icon;
  return (
    <span
      title="브라우저 LocalStorage에 자동 저장됩니다"
      className={cn("flex shrink-0 items-center gap-1 text-[11px]", view.className)}
    >
      <Icon className="size-3" />
      {view.text}
    </span>
  );
}
