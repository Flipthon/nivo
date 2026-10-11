import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // O link do e-mail foi aberto em outro aparelho ou já foi usado.
    // A confirmação do e-mail acontece antes de chegar aqui, então a conta já está ativa.
    return NextResponse.redirect(`${origin}/login?erro=link`);
  }

  return NextResponse.redirect(`${origin}/login?erro=auth`);
}
