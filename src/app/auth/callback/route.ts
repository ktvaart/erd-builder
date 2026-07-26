import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Vercel 등 프록시 뒤에서는 request.url 의 host 가 내부 주소일 수 있다. */
function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) return new URL(request.url).origin;
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${forwardedHost}`;
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(message)}`);

  if (!isSupabaseConfigured()) return fail("Supabase가 설정되지 않았습니다.");
  if (oauthError) return fail(oauthError);
  if (!code) return fail("인증 코드가 없습니다.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);

  return NextResponse.redirect(origin);
}
