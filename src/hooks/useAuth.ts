"use client";

import * as React from "react";
import { create } from "zustand";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

interface AuthState {
  /** Supabase 환경변수가 있는지. false 면 로그인 UI 자체를 감춘다. */
  enabled: boolean;
  /** 최초 세션 확인이 끝났는지 */
  ready: boolean;
  user: AuthUser | null;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  enabled: isSupabaseConfigured(),
  // Supabase 를 안 쓰면 기다릴 게 없으므로 곧바로 준비 완료.
  ready: !isSupabaseConfigured(),
  user: null,
  error: null,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error }),
}));

function toAuthUser(raw: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): AuthUser {
  const metadata = raw.user_metadata ?? {};
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
    return undefined;
  };
  return {
    id: raw.id,
    email: raw.email,
    name: pick("user_name", "preferred_username", "full_name", "name"),
    avatarUrl: pick("avatar_url", "picture"),
  };
}

/** 앱 진입점에서 한 번만 호출한다. 세션을 읽고 이후 변화를 구독한다. */
export function useAuthBootstrap(): void {
  React.useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { setUser, setReady, setError } = useAuthStore.getState();

    // OAuth 콜백이 ?auth_error= 로 실패를 알려준다.
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setError(authError);
      // 새로고침해도 에러가 반복되지 않도록 쿼리를 지운다.
      window.history.replaceState({}, "", window.location.pathname);
    }

    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user ? toAuthUser(data.user) : null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);
}

export async function signInWithGitHub(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    // 다른 provider 를 쓰려면 Supabase 대시보드에서 켠 뒤 이 값만 바꾸면 된다.
    provider: "github",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) useAuthStore.getState().setError(error.message);
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
  useAuthStore.getState().setUser(null);
}
