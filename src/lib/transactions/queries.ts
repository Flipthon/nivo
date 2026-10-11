import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

export type MonthTotals = { income: number; expense: number; entries: number };

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export async function getMonthTotals(supabase: Db, month: string): Promise<MonthTotals> {
  const { from, to } = monthRange(month);
  const { data } = await supabase
    .rpc("period_summary", { p_from: from, p_to: to })
    .single<{ income_cents: number; expense_cents: number; entries: number }>();
  return {
    income: Number(data?.income_cents ?? 0),
    expense: Number(data?.expense_cents ?? 0),
    entries: Number(data?.entries ?? 0),
  };
}

export async function hasAnyEntry(supabase: Db): Promise<boolean> {
  const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

export type CategorySlice = { category_id: string | null; category_name: string; expense_cents: number };

export async function getMonthByCategory(supabase: Db, month: string): Promise<CategorySlice[]> {
  const { from, to } = monthRange(month);
  const { data } = await supabase.rpc("period_by_category", { p_from: from, p_to: to });
  return ((data ?? []) as CategorySlice[]).map((r) => ({ ...r, expense_cents: Number(r.expense_cents) }));
}

export type TxRow = {
  id: string;
  kind: "expense" | "income" | "card_payment";
  amount_cents: number;
  description: string;
  occurred_on: string;
  category_id: string | null;
  card_id: string | null;
  installment_number: number;
  installment_total: number;
  installment_group: string | null;
  categories: { name: string } | null;
  cards: { name: string } | null;
};

export async function listMonth(supabase: Db, month: string): Promise<TxRow[]> {
  const { from, to } = monthRange(month);
  const { data } = await supabase
    .from("transactions")
    .select(
      "id, kind, amount_cents, description, occurred_on, category_id, card_id, installment_number, installment_total, installment_group, categories(name), cards(name)",
    )
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as TxRow[]).map((r) => ({ ...r, amount_cents: Number(r.amount_cents) }));
}
