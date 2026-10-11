"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile/queries";
import { localDateISO } from "@/lib/dates";
import { formatCents } from "@/lib/money/format";
import { fold } from "@/lib/money/parse";
import { interpret, MAX_MESSAGE_LENGTH, type CardRef, type Draft } from "@/lib/chat/interpret";
import { resolveCategory, type CategoryRef } from "@/lib/chat/categories";
import { buildRows, confirmationReasons, itemsSchema, type Item } from "./plan";

type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];

export type SavedLine = { description: string; cents: number; kind: "expense" | "income" | "card_payment"; detail: string };
export type Choice = { id: string; name: string };

export type ChatReply =
  | { kind: "saved"; requestId: string; text: string; lines: SavedLine[] }
  | {
      kind: "confirm";
      requestId: string;
      text: string;
      reasons: string[];
      items: Item[];
      categories: Array<Choice & { kind: "expense" | "income" }>;
      cards: Choice[];
    }
  | { kind: "answer"; text: string }
  | { kind: "error"; text: string };

const requestIdSchema = z.string().uuid();
const GENERIC_ERROR = "Não consegui salvar agora. Nada foi lançado — tente de novo em instantes.";

async function loadContext(supabase: Db, userId: string) {
  const [profile, cats, cards] = await Promise.all([
    getProfile(supabase, userId),
    supabase.from("categories").select("id, name, kind").is("archived_at", null).order("name"),
    supabase.from("cards").select("id, name, kind").is("archived_at", null).order("name"),
  ]);
  const today = localDateISO(new Date(), profile.timezone);
  return {
    today,
    categories: (cats.data ?? []) as CategoryRef[],
    cards: (cards.data ?? []) as CardRef[],
  };
}

function detailFor(row: { occurred_on: string; installment_total: number }, today: string, categoryName?: string, cardName?: string) {
  const parts: string[] = [];
  if (categoryName) parts.push(categoryName);
  if (row.installment_total > 1) parts.push(`${row.installment_total}x`);
  if (cardName) parts.push(cardName);
  if (row.occurred_on !== today) {
    const [, m, d] = row.occurred_on.split("-");
    parts.push(`${d}/${m}`);
  }
  return parts.join(" · ");
}

function draftToItem(d: Draft, ctx: Awaited<ReturnType<typeof loadContext>>): Item {
  const cat = resolveCategory(d.categoryName, d.kind, ctx.categories);
  let cardId = d.cardId;
  let newCardName: string | null = null;
  if (!cardId && d.cardMention) {
    const credit = ctx.cards.filter((c) => c.kind === "credit");
    if (d.cardMention === "cartão") {
      if (credit.length === 1) cardId = credit[0].id;
      else if (credit.length === 0) newCardName = "Cartão de crédito";
    } else {
      const name = d.cardMention.charAt(0).toUpperCase() + d.cardMention.slice(1);
      const existing = ctx.cards.find((c) => fold(c.name) === fold(name));
      if (existing) cardId = existing.id;
      else newCardName = name.slice(0, 30);
    }
  }
  return {
    kind: d.kind,
    cents: d.cents,
    description: d.description,
    categoryId: cat?.id ?? null,
    occurredOn: d.occurredOn,
    installments: d.installments,
    cardId,
    newCardName,
  };
}

async function maxRecentExpense(supabase: Db, today: string): Promise<number | null> {
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 90);
  const { data } = await supabase
    .from("transactions")
    .select("amount_cents, installment_total")
    .eq("kind", "expense")
    .gte("occurred_on", from.toISOString().slice(0, 10))
    .order("amount_cents", { ascending: false })
    .limit(1);
  if (!data?.length) return null;
  return Number(data[0].amount_cents) * Number(data[0].installment_total);
}

/** Grava os itens (criando cartões novos, se preciso). Idempotente pelo requestId. */
async function saveItems(supabase: Db, items: Item[], requestId: string, today: string, cats: CategoryRef[], cards: CardRef[]): Promise<ChatReply> {
  // Já salvo antes (clique duplo, reenvio)? Devolve o que existe.
  const existing = await supabase.from("transactions").select("id").eq("request_id", requestId).limit(1);
  if (existing.error) return { kind: "error", text: GENERIC_ERROR };
  if (existing.data.length) return { kind: "saved", requestId, text: "Esse lançamento já estava salvo.", lines: [] };

  const cardNames = new Map(cards.map((c) => [c.id, c.name]));
  const resolved: Item[] = [];
  for (const it of items) {
    let cardId = it.kind === "expense" ? it.cardId : null;
    if (it.kind === "expense" && !cardId && it.newCardName) {
      const name = it.newCardName.trim();
      const found = cards.find((c) => fold(c.name) === fold(name));
      if (found) cardId = found.id;
      else {
        const { data, error } = await supabase.from("cards").insert({ name, kind: "credit" }).select("id, name, kind").single();
        if (error || !data) return { kind: "error", text: GENERIC_ERROR };
        cards.push(data as CardRef);
        cardNames.set(data.id, data.name);
        cardId = data.id;
      }
    }
    if (it.categoryId && !cats.some((c) => c.id === it.categoryId && c.kind === it.kind)) {
      return { kind: "error", text: "A categoria escolhida não combina com o lançamento." };
    }
    resolved.push({ ...it, cardId });
  }

  const rows = buildRows(resolved, requestId);
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) {
    if (error.code === "23505") return { kind: "saved", requestId, text: "Esse lançamento já estava salvo.", lines: [] };
    return { kind: "error", text: GENERIC_ERROR };
  }

  const catNames = new Map(cats.map((c) => [c.id, c.name]));
  const lines: SavedLine[] = resolved.map((it) => ({
    kind: it.kind,
    description: it.description,
    cents: it.cents,
    detail: detailFor(
      { occurred_on: it.occurredOn, installment_total: it.kind === "expense" ? it.installments : 1 },
      today,
      it.categoryId ? catNames.get(it.categoryId) : undefined,
      it.cardId ? cardNames.get(it.cardId) : undefined,
    ),
  }));
  const total = resolved.reduce((s, it) => s + it.cents, 0);
  const allIncome = resolved.every((it) => it.kind === "income");
  const text =
    resolved.length === 1
      ? allIncome ? "Receita anotada." : "Gasto anotado."
      : `${resolved.length} lançamentos anotados, somando ${formatCents(total)}.`;
  revalidatePath("/", "layout");
  return { kind: "saved", requestId, text, lines };
}

async function lastRequest(supabase: Db) {
  const { data } = await supabase
    .from("transactions")
    .select("request_id")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.request_id as string | undefined;
}

export async function sendMessage(message: string, requestId: string): Promise<ChatReply> {
  if (typeof message !== "string" || !requestIdSchema.safeParse(requestId).success) {
    return { kind: "error", text: "Mensagem inválida." };
  }
  const text = message.slice(0, MAX_MESSAGE_LENGTH);
  const { supabase, user } = await requireUser();
  const ctx = await loadContext(supabase, user.id);
  const intent = interpret(text, ctx);

  switch (intent.type) {
    case "greeting":
      return { kind: "answer", text: "Oi! Me conte um gasto ou uma receita, ou pergunte “quanto gastei este mês?”." };
    case "help":
    case "clarify":
      return { kind: "answer", text: intent.message };

    case "query": {
      const cat = intent.categoryName ? resolveCategory(intent.categoryName, "expense", ctx.categories) : null;
      const { data, error } = await supabase
        .rpc("period_summary", { p_from: intent.period.from, p_to: intent.period.to, p_category: cat?.id ?? null })
        .single<{ income_cents: number; expense_cents: number; entries: number }>();
      if (error || !data) return { kind: "error", text: "Não consegui consultar agora. Tente de novo." };
      const inc = Number(data.income_cents);
      const exp = Number(data.expense_cents);
      const when = intent.period.label;
      if (intent.metric === "income") return { kind: "answer", text: `Em ${when} você recebeu ${formatCents(inc)}.` };
      if (intent.metric === "balance") {
        return {
          kind: "answer",
          text: `Em ${when}: receitas ${formatCents(inc)}, despesas ${formatCents(exp)}. Saldo de ${formatCents(inc - exp)}.`,
        };
      }
      return {
        kind: "answer",
        text: cat ? `Em ${when} você gastou ${formatCents(exp)} com ${cat.name}.` : `Em ${when} você gastou ${formatCents(exp)}.`,
      };
    }

    case "undo_last": {
      const last = await lastRequest(supabase);
      if (!last) return { kind: "answer", text: "Você ainda não tem lançamentos para apagar." };
      return undoRequest(last);
    }

    case "correct_last": {
      const last = await lastRequest(supabase);
      if (!last) return { kind: "answer", text: "Não encontrei um lançamento para corrigir." };
      const { data: rows } = await supabase
        .from("transactions")
        .select("id, kind, description, amount_cents, installment_total, occurred_on")
        .eq("request_id", last);
      if (!rows || rows.length !== 1 || rows[0].installment_total > 1) {
        return { kind: "answer", text: "O último registro tem mais de um item. Corrija pelo menu Lançamentos." };
      }
      const patch: Record<string, string | number> = {};
      if (intent.cents) patch.amount_cents = intent.cents;
      if (intent.description) patch.description = intent.description;
      if (intent.occurredOn) patch.occurred_on = intent.occurredOn;
      if (!Object.keys(patch).length) return { kind: "answer", text: "O que devo corrigir? Ex.: “na verdade foi 45”." };
      const { error } = await supabase.from("transactions").update(patch).eq("id", rows[0].id);
      if (error) return { kind: "error", text: "Não consegui corrigir agora. Tente de novo." };
      revalidatePath("/", "layout");
      const desc = (patch.description as string) ?? rows[0].description;
      const cents = (patch.amount_cents as number) ?? Number(rows[0].amount_cents);
      return { kind: "saved", requestId: last, text: "Corrigido.", lines: [{ kind: rows[0].kind, description: desc, cents, detail: "" }] };
    }

    case "card_payment": {
      let cardId = intent.cardId;
      const credit = ctx.cards.filter((c) => c.kind === "credit");
      if (!cardId && credit.length === 1) cardId = credit[0].id;
      const { error } = await supabase.from("transactions").insert({
        kind: "card_payment",
        amount_cents: intent.cents,
        description: "Pagamento de fatura",
        card_id: cardId,
        occurred_on: ctx.today,
        request_id: requestId,
        source: "chat",
      });
      if (error && error.code !== "23505") return { kind: "error", text: GENERIC_ERROR };
      revalidatePath("/", "layout");
      return {
        kind: "saved",
        requestId,
        text: "Pagamento de fatura anotado. Ele não conta como gasto novo, porque as compras já foram lançadas.",
        lines: [{ kind: "card_payment", description: "Pagamento de fatura", cents: intent.cents, detail: ctx.cards.find((c) => c.id === cardId)?.name ?? "" }],
      };
    }

    case "entries": {
      const items = intent.drafts.map((d) => draftToItem(d, ctx));
      const review = intent.drafts.map((d) => ({
        approximate: d.approximate,
        refund: intent.notes.some((n) => n.startsWith("Estornos")),
      }));
      const reasons = confirmationReasons(items, { today: ctx.today, maxRecentExpenseCents: await maxRecentExpense(supabase, ctx.today) }, review);
      intent.drafts.forEach((d, i) => {
        if (d.cardMention === "cartão" && !items[i].cardId && !items[i].newCardName) reasons.push("Em qual cartão foi?");
      });
      if (reasons.length) {
        return {
          kind: "confirm",
          requestId,
          text: "Confere antes de eu salvar?",
          reasons,
          items,
          categories: ctx.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
          cards: ctx.cards.map((c) => ({ id: c.id, name: c.name })),
        };
      }
      const reply = await saveItems(supabase, items, requestId, ctx.today, ctx.categories, ctx.cards);
      if (reply.kind === "saved" && intent.notes.length) reply.text += " " + intent.notes.join(" ");
      return reply;
    }
  }
}

/** Salva itens revisados no cartão de confirmação. Tudo é validado de novo no servidor. */
export async function confirmItems(requestId: string, rawItems: unknown): Promise<ChatReply> {
  if (!requestIdSchema.safeParse(requestId).success) return { kind: "error", text: "Pedido inválido." };
  const parsed = itemsSchema.safeParse(rawItems);
  if (!parsed.success) return { kind: "error", text: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const { supabase, user } = await requireUser();
  const ctx = await loadContext(supabase, user.id);
  return saveItems(supabase, parsed.data, requestId, ctx.today, ctx.categories, ctx.cards);
}

/** Desfaz tudo o que uma mensagem gravou (inclusive todas as parcelas). */
export async function undoRequest(requestId: string): Promise<ChatReply> {
  if (!requestIdSchema.safeParse(requestId).success) return { kind: "error", text: "Pedido inválido." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("transactions").delete().eq("request_id", requestId).select("id, description");
  if (error) return { kind: "error", text: "Não consegui desfazer agora. Tente de novo." };
  revalidatePath("/", "layout");
  if (!data.length) return { kind: "answer", text: "Nada para desfazer: esse lançamento já não existe." };
  const names = [...new Set(data.map((d) => d.description))];
  return { kind: "answer", text: `Desfeito: ${names.join(", ")}.` };
}
