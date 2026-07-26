"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useAuthBootstrap } from "@/hooks/useAuth";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useCloudSync } from "@/hooks/useCloudSync";
import { ERDCanvas } from "./ERDCanvas";
import { ExportPanel } from "./ExportPanel";
import { Header } from "./Header";
import { SidePanel } from "./SidePanel";
import { Toolbar } from "./Toolbar";

export function ERDBuilder() {
  return (
    <ReactFlowProvider>
      <ERDBuilderLayout />
    </ReactFlowProvider>
  );
}

/** Toolbar / ExportPanel 이 useReactFlow 를 쓰기 때문에 Provider 안쪽에 있어야 한다. */
function ERDBuilderLayout() {
  useAuthBootstrap();
  // LocalStorage 복원이 끝난 뒤에 서버와 병합해야 로컬 작업물이 안 밀린다.
  const localReady = useAutoSave();
  useCloudSync(localReady);

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <Toolbar />
          <ERDCanvas />
          <ExportPanel />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
