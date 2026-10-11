"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

export type DeleteAccountState = { status: "idle" } | { status: "error"; message: string } | { status: "reauth" };

const CONFIRMATION_WORD = "EXCLUIR";
const MAX_LOGIN_AGE_MS = 15 * 60 * 1000; // exige login recente para uma ação irreversível

export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const { supabase, user } = await requireUser();

  if (String(formData.get("confirmacao") ?? "").trim().toUpperCase() !== CONFIRMATION_WORD) {
    return { status: "error", message: `Digite ${CONFIRMATION_WORD} para confirmar.` };
  }

  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  if (!lastSignIn || Date.now() - lastSignIn > MAX_LOGIN_AGE_MS) {
    return { status: "reauth" };
  }

  // A função do banco usa a identidade da sessão; não recebe id de ninguém.
  const { error } = await supabase.rpc("delete_my_account");
  if (error?.code === "28000") return { status: "reauth" }; // o banco também exige login recente
  if (error) {
    return { status: "error", message: "Não consegui excluir sua conta. Nada foi apagado. Tente de novo em instantes." };
  }

  await supabase.auth.signOut().catch(() => undefined);
  redirect("/excluir-conta?ok=1");
}

export async function reauthenticate() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login?next=/mais/excluir-conta&motivo=confirmar");
}
