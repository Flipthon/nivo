"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { findAmounts, MAX_CENTS } from "@/lib/money/parse";

export type FormState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

/** Lê "1.234,56", "35", "R$ 20" etc. num único valor em centavos. */
function amountFrom(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  const found = findAmounts(s);
  if (found.length !== 1) return null;
  const c = found[0].cents;
  return c > 0 && c <= MAX_CENTS ? c : null;
}

const editSchema = z.object({
  id: uuid,
  description: z.string().trim().min(1, "Descreva o lançamento").max(80),
  occurred_on: isoDate,
  category_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
});

export async function updateTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = editSchema.safeParse({
    id: formData.get("id"),
    description: formData.get("description"),
    occurred_on: formData.get("occurred_on"),
    category_id: formData.get("category_id") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const cents = amountFrom(formData.get("amount"));
  if (cents === null) return { status: "error", message: "Valor inválido. Ex.: 35,90" };

  const { supabase } = await requireUser();
  const { id, ...fields } = parsed.data;
  const { data, error } = await supabase
    .from("transactions")
    .update({ ...fields, amount_cents: cents })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    return {
      status: "error",
      message: error.code === "23514" ? "Essa categoria não combina com o lançamento." : "Não consegui salvar. Tente de novo.",
    };
  }
  if (!data) return { status: "error", message: "Lançamento não encontrado." };
  revalidatePath("/", "layout");
  return { status: "ok", message: "Salvo." };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  const all = formData.get("all") === "1";
  if (all) {
    const { data } = await supabase.from("transactions").select("installment_group").eq("id", id.data).maybeSingle();
    if (data?.installment_group) {
      await supabase.from("transactions").delete().eq("installment_group", data.installment_group);
      revalidatePath("/", "layout");
      return;
    }
  }
  await supabase.from("transactions").delete().eq("id", id.data);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------
const day = z
  .union([z.literal(""), z.coerce.number().int().min(1).max(31)])
  .transform((v) => (v === "" ? null : v));

const cardSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao cartão").max(30, "Nome muito longo"),
  kind: z.enum(["credit", "meal", "transport"]),
  closing_day: day,
  due_day: day,
});

export async function createCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = cardSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    closing_day: formData.get("closing_day") ?? "",
    due_day: formData.get("due_day") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cards").insert(parsed.data);
  if (error) {
    return { status: "error", message: error.code === "23505" ? "Você já tem um cartão com esse nome." : "Não consegui salvar. Tente de novo." };
  }
  revalidatePath("/", "layout");
  return { status: "ok", message: "Cartão adicionado." };
}

export async function archiveCard(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("cards").update({ archived_at: new Date().toISOString() }).eq("id", id.data);
  revalidatePath("/", "layout");
}
