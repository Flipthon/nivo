"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { profileUpdateSchema } from "./schema";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();

  const parsed = profileUpdateSchema.safeParse({
    display_name: formData.get("display_name"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { status: "error", message: "Revise os campos destacados.", fieldErrors };
  }

  // O id vem da sessão. Mesmo que alguém envie outro id, ele é ignorado.
  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "Não consegui salvar seu perfil. Tente de novo em instantes." };
  }

  revalidatePath("/", "layout");
  return { status: "saved" };
}
