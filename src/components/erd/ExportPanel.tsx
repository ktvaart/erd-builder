"use client";

import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import { AlertTriangle, Check, Copy, Download, Upload, X } from "lucide-react";
import { Button, Checkbox, IconButton } from "@/components/common/ui";
import { selectProject, useERDStore } from "@/hooks/useERDStore";
import { useUIStore, type ExportTab } from "@/hooks/useUIStore";
import {
  DEFAULT_DDL_OPTIONS,
  dialectSupportsIfNotExists,
  generateDDL,
  type DDLOptions,
} from "@/lib/ddl-generator";
import { parseProjectJSON, serializeProject, toFileName } from "@/lib/project";
import { copyToClipboard, downloadTextFile } from "@/lib/utils";

export function ExportPanel() {
  const open = useUIStore((state) => state.exportOpen);
  const tab = useUIStore((state) => state.exportTab);
  const setExportTab = useUIStore((state) => state.setExportTab);
  const closeExport = useUIStore((state) => state.closeExport);

  if (!open) return null;

  return (
    <section className="absolute inset-x-0 bottom-0 z-10 flex h-[46%] min-h-[240px] flex-col border-t border-line bg-surface shadow-[0_-4px_16px_rgba(28,36,52,0.08)]">
      <header className="flex shrink-0 items-center gap-1 border-b border-line px-2">
        {(["ddl", "json"] as ExportTab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setExportTab(value)}
            className={
              "relative px-3 py-2 text-xs font-semibold transition-colors " +
              (tab === value
                ? "text-accent after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-accent"
                : "text-ink-faint hover:text-ink-muted")
            }
          >
            {value === "ddl" ? "DDL" : "JSON"}
          </button>
        ))}
        <IconButton label="닫기" className="ml-auto" onClick={closeExport}>
          <X className="size-4" />
        </IconButton>
      </header>

      {tab === "ddl" ? <DDLTab /> : <JSONTab />}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 공통                                                                 */
/* ------------------------------------------------------------------ */

function CodeView({ text }: { text: string }) {
  return (
    <pre className="erd-scroll m-0 h-full overflow-auto rounded-md border border-line bg-surface-muted p-3 font-mono text-[11px] leading-relaxed whitespace-pre text-ink">
      {text}
    </pre>
  );
}

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      disabled={disabled}
      onClick={async () => setCopied(await copyToClipboard(text))}
    >
      {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
      {copied ? "복사됨" : "복사"}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* DDL                                                                 */
/* ------------------------------------------------------------------ */

function DDLTab() {
  const project = useERDStore(selectProject);
  const [options, setOptions] = React.useState<DDLOptions>(DEFAULT_DDL_OPTIONS);

  const supportsIfNotExists = dialectSupportsIfNotExists(project.dbms);
  const { sql, warnings } = React.useMemo(() => generateDDL(project, options), [project, options]);

  const patch = (values: Partial<DDLOptions>) => setOptions((current) => ({ ...current, ...values }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Checkbox
          label="FK 제약조건"
          checked={options.includeForeignKeys}
          onChange={(event) => patch({ includeForeignKeys: event.target.checked })}
        />
        <Checkbox
          label="컬럼 주석"
          checked={options.includeComments}
          onChange={(event) => patch({ includeComments: event.target.checked })}
        />
        <Checkbox
          label="IF NOT EXISTS"
          checked={options.ifNotExists && supportsIfNotExists}
          disabled={!supportsIfNotExists}
          title={supportsIfNotExists ? undefined : `${project.dbms.toUpperCase()}는 지원하지 않습니다`}
          onChange={(event) => patch({ ifNotExists: event.target.checked })}
        />
        <Checkbox
          label="식별자 인용"
          checked={options.quoteIdentifiers}
          onChange={(event) => patch({ quoteIdentifiers: event.target.checked })}
        />

        <div className="ml-auto flex items-center gap-1.5">
          <CopyButton text={sql} disabled={project.tables.length === 0} />
          <Button
            variant="primary"
            disabled={project.tables.length === 0}
            onClick={() => downloadTextFile(toFileName(project.name, "sql"), sql, "text/plain")}
          >
            <Download className="size-3.5" />
            .sql 저장
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="shrink-0 space-y-0.5 rounded-md border border-pk/40 bg-pk/5 px-2.5 py-1.5">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-1.5 text-[11px] text-ink-muted">
              <AlertTriangle className="mt-px size-3 shrink-0 text-pk" />
              {warning}
            </li>
          ))}
        </ul>
      )}

      <div className="min-h-0 flex-1">
        <CodeView text={sql} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* JSON                                                                */
/* ------------------------------------------------------------------ */

function JSONTab() {
  const project = useERDStore(selectProject);
  const importProject = useERDStore((state) => state.importProject);
  const { fitView } = useReactFlow();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const json = React.useMemo(() => serializeProject(project), [project]);

  const handleImport = async (file: File) => {
    setError(null);
    const result = parseProjectJSON(await file.text());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // 덮어쓰지 않고 새 프로젝트로 추가한다. 작업 중이던 ERD 는 그대로 남는다.
    importProject(result.project);
    // 노드가 화면 밖 좌표일 수 있으니 렌더 이후 한 번 맞춰준다.
    requestAnimationFrame(() => fitView({ padding: 0.25, duration: 300, maxZoom: 1 }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-[11px] text-ink-faint">
          테이블 {project.tables.length}개 · 관계 {project.relations.length}개
        </p>

        <div className="ml-auto flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              // 같은 파일을 다시 골라도 change 가 발생하도록 초기화
              event.target.value = "";
            }}
          />
          <Button onClick={() => inputRef.current?.click()}>
            <Upload className="size-3.5" />
            JSON 불러오기
          </Button>
          <CopyButton text={json} />
          <Button
            variant="primary"
            onClick={() => downloadTextFile(toFileName(project.name, "json"), json, "application/json")}
          >
            <Download className="size-3.5" />
            .json 저장
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex shrink-0 items-center gap-1.5 rounded-md border border-danger/40 bg-danger/5 px-2.5 py-1.5 text-[11px] text-danger">
          <AlertTriangle className="size-3 shrink-0" />
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <CodeView text={json} />
      </div>
    </div>
  );
}
