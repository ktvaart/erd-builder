"use client";

import { create } from "zustand";

export type ExportTab = "ddl" | "json";
export type SaveState = "idle" | "pending" | "saved" | "error";
/** off = 로그아웃 상태이거나 Supabase 미설정 */
export type CloudState = "off" | "syncing" | "synced" | "error";

interface UIState {
  exportOpen: boolean;
  exportTab: ExportTab;
  saveState: SaveState;
  cloudState: CloudState;
  cloudMessage: string | null;

  toggleExport: (tab?: ExportTab) => void;
  closeExport: () => void;
  setExportTab: (tab: ExportTab) => void;
  setSaveState: (state: SaveState) => void;
  setCloud: (state: CloudState, message?: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  exportOpen: false,
  exportTab: "ddl",
  saveState: "idle",
  cloudState: "off",
  cloudMessage: null,

  toggleExport: (tab) => {
    const { exportOpen, exportTab } = get();
    // 닫혀 있으면 열고, 열려 있는데 다른 탭을 누르면 그 탭으로 전환한다.
    if (!exportOpen) return set({ exportOpen: true, exportTab: tab ?? exportTab });
    if (tab && tab !== exportTab) return set({ exportTab: tab });
    set({ exportOpen: false });
  },
  closeExport: () => set({ exportOpen: false }),
  setExportTab: (exportTab) => set({ exportTab }),
  setSaveState: (saveState) => set({ saveState }),
  setCloud: (cloudState, cloudMessage = null) => set({ cloudState, cloudMessage }),
}));
