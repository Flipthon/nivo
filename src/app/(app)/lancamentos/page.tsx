import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile/queries";
import { localMonthISO, monthLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money/format";
import { getMonthByCategory, getMonthTotals, listMonth, shiftMonth } from "@/lib/transactions/queries";
import { TxItem } from "./TxItem";

export const metadata = { title: "Lançamentos · Nivo" };

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function LancamentosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  const current = localMonthISO(new Date(), profile.timezone);
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && mes >= "2000-01" && mes <= "2100-12" ? mes : current;

  const [rows, totals, byCat, cats] = await Promise.all([
    listMonth(supabase, month),
    getMonthTotals(supabase, month),
    getMonthByCategory(supabase, month),
    supabase.from("categories").select("id, name, kind").is("archived_at", null).order("name"),
  ]);
  const categories = (cats.data ?? []) as Array<{ id: string; name: string; kind: "expense" | "income" }>;

  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = days.get(r.occurred_on) ?? [];
    list.push(r);
    days.set(r.occurred_on, list);
  }
  const maxCat = byCat[0]?.expense_cents ?? 0;

  return (
    <>
      <header className="page-head"><h1>Lançamentos</h1></header>

      <nav className="month-nav" aria-label="Mês">
        <Link href={`/lancamentos?mes=${shiftMonth(month, -1)}`} aria-label="Mês anterior"><ChevronLeft size={22} /></Link>
        <strong>{monthLabel(month)}</strong>
        {month < current ? (
          <Link href={`/lancamentos?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês"><ChevronRight size={22} /></Link>
        ) : (
          <span style={{ width: 44 }} aria-hidden="true" />
        )}
      </nav>

      <div className="totals-row">
        <div>Receitas<strong className="tx-amount income">{formatCents(totals.income)}</strong></div>
        <div>Despesas<strong>{formatCents(totals.expense)}</strong></div>
        <div>Saldo<strong>{formatCents(totals.income - totals.expense)}</strong></div>
      </div>

      {byCat.length > 0 && (
        <section className="panel" aria-labelledby="por-categoria">
          <h2 id="por-categoria" style={{ marginBottom: 12 }}>Gastos por categoria</h2>
          <ul className="cat-bars">
            {byCat.slice(0, 6).map((c) => (
              <li key={c.category_id ?? "none"}>
                <span className="bar-label"><span>{c.category_name}</span><strong>{formatCents(c.expense_cents)}</strong></span>
                <span className="bar" aria-hidden="true"><i style={{ width: `${maxCat ? Math.max(4, (c.expense_cents / maxCat) * 100) : 0}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="empty">Nenhum lançamento em {monthLabel(month)}.<br />Conte um gasto na tela Início.</p>
      ) : (
        [...days.entries()].map(([day, list]) => (
          <section key={day} className="day-group">
            <h2>{WEEKDAY.format(new Date(`${day}T12:00:00Z`))}</h2>
            <ul className="tx-list">
              {list.map((r) => (
                <li key={r.id}>
                  <TxItem
                    tx={{
                      id: r.id,
                      kind: r.kind,
                      cents: r.amount_cents,
                      description: r.description,
                      occurredOn: r.occurred_on,
                      categoryId: r.category_id,
                      categoryName: r.categories?.name ?? null,
                      cardName: r.cards?.name ?? null,
                      installment: r.installment_total > 1 ? `${r.installment_number}/${r.installment_total}` : null,
                    }}
                    categories={categories.filter((c) => c.kind === r.kind)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
