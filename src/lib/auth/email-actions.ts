"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./redirect";
import { fieldErrors, newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from "./schema";

export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> }
  | { status: "sent"; message: string };

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function captcha(formData: FormData) {
  const token = formData.get("cf-turnstile-response");
  return typeof token === "string" && token ? token : undefined;
}

function friendly(code: string | undefined, fallback: string) {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
    case "captcha_failed":
      return "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.";
    case "weak_password":
      return "Essa senha é fácil de adivinhar. Escolha outra.";
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    default:
      return fallback;
  }
}

export async function signInWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: "Revise os campos.", fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken: captcha(formData) },
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: "Confirme seu e-mail antes de entrar. Procure o link que enviamos (veja também o spam)." };
    }
    // Mesma mensagem para e-mail inexistente ou senha errada: não revela quem tem conta.
    return { status: "error", message: friendly(error.code, "E-mail ou senha incorretos.") };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "/")));
}

export async function signUpWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { status: "error", message: "Revise os campos.", fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/`,
      captchaToken: captcha(formData),
    },
  });

  if (error) {
    return { status: "error", message: friendly(error.code, "Não consegui criar sua conta agora. Tente de novo em instantes.") };
  }

  // Mesma resposta para e-mail novo ou já cadastrado, para não revelar quem tem conta.
  return {
    status: "sent",
    message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra o e-mail e toque no link para ativar sua conta. Se não chegar em alguns minutos, veja a caixa de spam.`,
  };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Revise os campos.", fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/redefinir-senha`,
    captchaToken: captcha(formData),
  });

  if (error && (error.code?.startsWith("over_") || error.code === "captcha_failed")) {
    return { status: "error", message: friendly(error.code, "") };
  }

  return {
    status: "sent",
    message: "Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha.",
  };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { status: "error", message: "Revise os campos.", fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", message: "O link expirou. Peça um novo na tela de login." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: friendly(error.code, "Não consegui trocar sua senha. Tente de novo.") };

  redirect("/?senha=alterada");
}
