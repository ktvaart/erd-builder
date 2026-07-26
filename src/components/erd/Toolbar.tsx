"use client";

import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import { Eraser, Maximize2, Plus } from "lucide-react";
import { Button } from "@/components/common/ui";
import { selectProject, useERDStore } from "@/hooks/useERDStore";
import { TABLE_NODE_WIDTH } from "./TableNode";

export function Toolbar() {
  const addTable = useERDStore((state) => state.addTable);
  const clearAll = useERDStore((state) => state.clearAll);
  const tableCount = useERDStore((state) => selectProject(state).tables.length);

  const { screenToFlowPosition, fitView, getViewport } = useReactFlow();

  /** 현재 보이는 화면 중앙에 테이블을 놓는다. */
  const handleAddTable = () => {
    const container = document.querySelector<HTMLElement>(".react-flow");
    if (!container) {
      addTable();
      return;
    }
    const rect = container.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    // 화면 중앙에 이미 테이블이 있으면 살짝 어긋나게 놓아 겹침을 줄인다.
    const jitter = (tableCount % 5) * 24;
    addTable({ x: center.x - TABLE_NODE_WIDTH / 2 + jitter, y: center.y - 90 + jitter });
  };

  const handleClear = () => {
    if (tableCount === 0) return;
    if (!window.confirm("모든 테이블과 관계를 삭제합니다. 계속할까요?")) return;
    clearAll();
  };

  // getViewport 는 fitView 직후 확대율을 확인하는 용도로만 쓰인다.
  const handleFitView = () => {
    fitView({ padding: 0.25, duration: 300, maxZoom: Math.max(1, getViewport().zoom) });
  };

  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-line bg-surface/95 p-1 shadow-sm backdrop-blur">
      <Button variant="primary" onClick={handleAddTable}>
        <Plus className="size-3.5" />
        테이블 추가
      </Button>
      <span className="mx-0.5 h-5 w-px bg-line" />
      <Button variant="ghost" onClick={handleFitView} disabled={tableCount === 0}>
        <Maximize2 className="size-3.5" />
        화면 맞춤
      </Button>
      <Button variant="ghost" onClick={handleClear} disabled={tableCount === 0}>
        <Eraser className="size-3.5" />
        전체 삭제
      </Button>
    </div>
  );
}
