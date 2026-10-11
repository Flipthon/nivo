// Regras puras dos lançamentos: parcelas, datas das parcelas e quando pedir confirmação.
// Sem acesso ao banco, para ser testado isoladamente.

import { z } from "zod";
import { MAX_CENTS } from "@/lib/money/parse";
import { formatCents } from "@/lib/money/format";
import { MAX_INSTALLMENTS } from "@/lib/chat/interpret";

export const OUTLIER_FACTOR = 10;
export const OUTLIER_DEFAULT_CENTS = 1_000_000; // R$ 10.000,00 quando ainda não há histórico

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= "2000-01-01" && s <= "2100-12-31";
  }, "Data inválida");

/** Item pronto para salvar, já com ids resolvidos. É o que o cliente pode revisar e devolver. */
export const itemSchema = z.object({
  kind: z.enum(["expense", "income"]),
  cents: z.number().int().min(1).max(MAX_CENTS),
  description: z.string().trim().min(1, "Descreva o lançamento").max(80),
  categoryId: z.string().uuid().nullable(),
  occurredOn: isoDate,
  installments: z.number().int().min(1).max(MAX_INSTALLMENTS),
  cardId: z.string().uuid().nullable(),
  newCardName: z.string().trim().min(1).max(30).nullable(),
});
export type Item = z.infer<typeof itemSchema>;
export const itemsSchema = z.array(itemSchema).min(1).max(10);

/** Divide o total em parcelas de centavos inteiros; a diferença de arredondamento vai na 1ª. */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < n || n < 1) throw new RangeError("Parcelamento inválido");
  const base = Math.floor(totalCents / n);
  const parts = Array.from({ length: n }, () => base);
  parts[0] += totalCents - base * n;
  return parts;
}

/** Soma meses mantendo o dia; se o mês não tiver o dia (31/02), usa o último dia do mês. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

export type Row = {
  kind: "expense" | "income";
  amount_cents: number;
  description: string;
  category_id: string | null;
  card_id: string | null;
  occurred_on: string;
  installment_number: number;
  installment_total: number;
  installment_group: string | null;
  source: "chat" | "manual";
  request_id: string;
  item_index: number;
};

export function buildRows(
  items: Array<Omit<Item, "newCardName"> & { cardId: string | null }>,
  requestId: string,
  source: "chat" | "manual" = "chat",
  newId: () => string = () => crypto.randomUUID(),
): Row[] {
  const rows: Row[] = [];
  items.forEach((it, index) => {
    const n = it.kind === "expense" ? it.installments : 1;
    const parts = n > 1 ? splitInstallments(it.cents, n) : [it.cents];
    const group = n > 1 ? newId() : null;
    parts.forEach((cents, k) => {
      rows.push({
        kind: it.kind,
        amount_cents: cents,
        description: it.description.trim(),
        category_id: it.categoryId,
        card_id: it.kind === "expense" ? it.cardId : null,
        occurred_on: k === 0 ? it.occurredOn : addMonths(it.occurredOn, k),
        installment_number: k + 1,
        installment_total: n,
        installment_group: group,
        source,
        request_id: requestId,
        item_index: index,
      });
    });
  });
  return rows;
}

export type Review = { approximate?: boolean; refund?: boolean; cardMention?: string | null };

/** Motivos para pedir confirmação antes de salvar. Lista vazia = salva direto (com desfazer). */
export function confirmationReasons(
  items: Item[],
  ctx: { today: string; maxRecentExpenseCents: number | null },
  review: Review[] = [],
): string[] {
  const reasons = new Set<string>();
  const limit =
    ctx.maxRecentExpenseCents && ctx.maxRecentExpenseCents > 0
      ? ctx.maxRecentExpenseCents * OUTLIER_FACTOR
      : OUTLIER_DEFAULT_CENTS;
  items.forEach((it, i) => {
    const r = review[i] ?? {};
    if (!it.description.trim()) reasons.add("Falta dizer com o que foi.");
    if (r.approximate) reasons.add("Você falou um valor aproximado. Confira o valor exato.");
    if (it.kind === "expense" && it.cents > limit) {
      reasons.add(`${formatCents(it.cents)} é bem acima dos seus gastos recentes. Confere?`);
    }
    if (it.kind === "income" && it.cents > Math.max(limit, OUTLIER_DEFAULT_CENTS) * 5) {
      reasons.add(`${formatCents(it.cents)} é um valor alto. Confere?`);
    }
    if (it.newCardName) reasons.add(`Ainda não conheço o cartão “${it.newCardName}”. Ele será cadastrado.`);
    if (it.occurredOn > ctx.today) reasons.add("A data está no futuro.");
    if (r.refund) reasons.add("Estornos entram como receita.");
  });
  return [...reasons];
}
