import { NivoLogo } from "@/components/NivoMark";
import { LoginPanel } from "./LoginPanel";
import { LegalLinks } from "@/components/LegalLinks";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata = { title: "Entrar · Nivo" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string; motivo?: string }>;
}) {
  const { erro, next, motivo } = await searchParams;
  return (
    <main className="login">
      <NivoLogo size={40} />
      <h1>Seu dinheiro organizado em uma conversa.</h1>
      <p className="lead">Conte um gasto como contaria a um amigo. O Nivo anota, organiza e mostra como está o seu mês.</p>

      {erro === "auth" && (
        <p className="login-alert" role="alert">
          O login não foi concluído. Tente entrar de novo.
        </p>
      )}

      {erro === "link" && (
        <p className="login-alert" role="alert">
          Não conseguimos concluir o acesso por esse link. Se você acabou de confirmar seu e-mail, ele já está confirmado: entre com seu e-mail e senha. Se o link era para trocar a senha, peça um novo neste mesmo aparelho.
        </p>
      )}

      {motivo === "confirmar" && (
        <p className="muted" role="status">Entre de novo para confirmar a exclusão da sua conta.</p>
      )}

      <LoginPanel next={safeNextPath(next)} />

      <div className="bottom">
        <p className="fineprint">Seus lançamentos ficam visíveis só para você.</p>
        <LegalLinks />
      </div>
    </main>
  );
}
