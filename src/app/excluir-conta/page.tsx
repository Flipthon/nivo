import Link from "next/link";
import { site } from "@/lib/site";

export const metadata = { title: "Excluir conta · Nivo" };

export default async function ExcluirContaPublicPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;

  if (ok === "1") {
    return (
      <main className="doc">
        <h1>Conta excluída</h1>
        <p>Sua conta e todos os seus dados foram apagados do Nivo de forma definitiva.</p>
        <Link href="/login" className="btn btn-secondary" style={{ marginTop: 24 }}>Voltar ao início</Link>
      </main>
    );
  }

  return (
    <main className="doc">
      <Link href="/" className="doc-back">Voltar ao Nivo</Link>
      <h1>Excluir sua conta do Nivo</h1>
      <p>
        Ao excluir a conta, apagamos de forma definitiva seu perfil, seus lançamentos, categorias,
        cartões e orçamentos. Não é possível recuperar esses dados depois.
      </p>

      <h2>Pelo app ou pelo navegador</h2>
      <ol>
        <li>Entre no Nivo com a mesma conta que você usa no app (Google ou e-mail).</li>
        <li>Abra a aba Mais.</li>
        <li>Toque em Excluir conta e confirme.</li>
      </ol>
      <Link href="/login?next=/mais/excluir-conta" className="btn btn-primary" style={{ marginTop: 16 }}>
        Entrar para excluir minha conta
      </Link>

      {site.contato && (
        <>
          <h2>Sem acesso à conta?</h2>
          <p>
            Escreva para <a href={`mailto:${site.contato}`}>{site.contato}</a> a partir do e-mail
            cadastrado. Respondemos e concluímos a exclusão em até 15 dias.
          </p>
        </>
      )}
    </main>
  );
}
