import Link from "next/link";
import { HomeConversation } from "@/components/HomeConversation";
import { requireUser } from "@/lib/auth/session";
import { firstName, getProfile } from "@/lib/profile/queries";
import { greeting, localMonthISO, monthLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money/format";
import { getMonthTotals, hasAnyEntry } from "@/lib/transactions/queries";

export const metadata = { title: "Início · Nivo" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const { senha } = await searchParams;
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  const now = new Date();
  const name = firstName(profile);
  const monthISO = localMonthISO(now, profile.timezone);
  const month = monthLabel(monthISO); // ex.: "outubro de 2026"
  const monthName = month.split(" de ")[0];

  const [totals, hasEntries] = await Promise.all([getMonthTotals(supabase, monthISO), hasAnyEntry(supabase)]);

  return (
    <>
      <header className="topbar">
        <p className="hello">
          {greeting(now, profile.timezone)}
          {name ? "," : ""}
          {name && <strong>{name}</strong>}
        </p>
        <Link href="/mais" className="avatar" aria-label="Perfil e configurações">
          {(name ?? profile.email ?? "?").charAt(0).toUpperCase()}
        </Link>
      </header>

      {senha === "alterada" && <p className="login-ok" role="status" style={{ margin: "0 0 12px" }}>Senha alterada.</p>}

      <section className="month-card" aria-label={`Resumo de ${month}`}>
        <div className="row">
          <span>Saldo de {monthName}</span>
          <span className="chip">{month.replace(" de ", " ")}</span>
        </div>
        <p className="balance">{formatCents(totals.income - totals.expense)}</p>
        <p className="sub">Receitas menos despesas do mês</p>
        <div className="split">
          <div>Receitas<strong>{formatCents(totals.income)}</strong></div>
          <div>Despesas<strong>{formatCents(totals.expense)}</strong></div>
        </div>
      </section>

      <HomeConversation showWelcome={!hasEntries} />
    </>
  );
}
