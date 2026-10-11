import { StageNotice } from "@/components/StageNotice";
import { requireUser } from "@/lib/auth/session";
import { firstName, getProfile } from "@/lib/profile/queries";
import { greeting, localMonthISO, longDateLabel, monthLabel } from "@/lib/dates";

export const metadata = { title: "Início · Nivo" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const { senha } = await searchParams;
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  const now = new Date();
  const name = firstName(profile);

  return (
    <>
      <header className="page-head">
        <p className="date">{longDateLabel(now, profile.timezone)}</p>
        <h1>{greeting(now, profile.timezone)}{name ? `, ${name}` : ""}</h1>
      </header>

      {senha === "alterada" && <p className="login-ok" role="status" style={{ marginBottom: 12 }}>Senha alterada.</p>}

      <section className="panel month-card" aria-labelledby="mes">
        <p className="muted">Seu mês em resumo</p>
        <h2 id="mes">{monthLabel(localMonthISO(now, profile.timezone))}</h2>
        <div className="vial" aria-hidden="true"><span className="bubble" /></div>
        <p className="muted">
          Receitas, despesas e saldo aparecem aqui quando os lançamentos estiverem disponíveis, na etapa 2.
        </p>
      </section>

      <StageNotice stage={2}>
        É aqui embaixo que você vai contar seus gastos e receitas, escrevendo ou falando, como
        &quot;almoço 35 e Uber 18&quot;. A conversa ainda não está ligada, então nada é enviado ou salvo por enquanto.
      </StageNotice>
    </>
  );
}
