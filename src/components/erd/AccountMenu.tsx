"use client";

import * as React from "react";
// lucide v1 부터 브랜드 아이콘(Github 등)이 빠져서 범용 아이콘을 쓴다.
import { AlertTriangle, Cloud, CloudOff, LogIn, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/common/ui";
import { signInWithGitHub, signOut, useAuthStore } from "@/hooks/useAuth";
import { useUIStore } from "@/hooks/useUIStore";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const enabled = useAuthStore((state) => state.enabled);
  const ready = useAuthStore((state) => state.ready);
  const user = useAuthStore((state) => state.user);
  const authError = useAuthStore((state) => state.error);

  // Supabase 미설정 배포에서는 계정 UI 자체를 감춘다. 앱은 로컬 전용으로 정상 동작한다.
  if (!enabled) return null;

  if (!ready) {
    return <span className="shrink-0 text-[11px] text-ink-faint">확인 중…</span>;
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {authError && (
          <span title={authError} className="flex items-center gap-1 text-[11px] text-danger">
            <AlertTriangle className="size-3" />
            로그인 실패
          </span>
        )}
        <Button onClick={() => void signInWithGitHub()}>
          <LogIn className="size-3.5" />
          GitHub로 로그인
        </Button>
      </div>
    );
  }

  return <SignedIn name={user.name ?? user.email ?? "계정"} avatarUrl={user.avatarUrl} />;
}

function SignedIn({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const [open, setOpen] = React.useState(false);
  const cloudState = useUIStore((state) => state.cloudState);
  const cloudMessage = useUIStore((state) => state.cloudMessage);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 text-xs transition-colors hover:bg-surface-muted"
      >
        {avatarUrl ? (
          // 외부 아바타라 next/image 최적화 도메인 설정이 필요해진다. 24px 고정이라 img 로 충분.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-5 rounded-full" />
        ) : (
          <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="max-w-[120px] truncate font-medium">{name}</span>
        <CloudBadge state={cloudState} message={cloudMessage} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-30 mt-1 w-[280px] rounded-lg border border-line bg-surface p-3 shadow-lg">
            <p className="truncate text-xs font-semibold">{name}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              {cloudState === "synced" && "모든 프로젝트가 계정에 저장되어 있습니다."}
              {cloudState === "syncing" && "동기화 중…"}
              {cloudState === "error" && (cloudMessage ?? "동기화에 실패했습니다.")}
              {cloudState === "off" && "이 브라우저에만 저장됩니다."}
            </p>
            <Button
              className="mt-3 w-full justify-center"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <LogOut className="size-3.5" />
              로그아웃
            </Button>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
              로그아웃해도 이 브라우저의 사본은 남습니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function CloudBadge({ state, message }: { state: string; message: string | null }) {
  if (state === "syncing") {
    return <RefreshCw className="size-3 shrink-0 animate-spin text-ink-faint" aria-label="동기화 중" />;
  }
  if (state === "error") {
    return <CloudOff className={cn("size-3 shrink-0 text-danger")} aria-label={message ?? "동기화 실패"} />;
  }
  return <Cloud className="size-3 shrink-0 text-ink-faint" aria-label="동기화됨" />;
}
