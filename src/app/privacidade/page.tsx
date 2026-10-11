import Link from "next/link";
import { site } from "@/lib/site";

export const metadata = { title: "Política de privacidade · Nivo" };

export default function PrivacidadePage() {
  return (
    <main className="doc">
      <Link href="/" className="doc-back">Voltar ao Nivo</Link>
      <h1>Política de privacidade</h1>
      <p className="muted">Atualizada em {site.politicaAtualizadaEm}.</p>

      <h2>Quem é o responsável</h2>
      <p>
        O Nivo é mantido por {site.responsavel}.
        {site.contato && <> Para qualquer assunto sobre seus dados, escreva para <a href={`mailto:${site.contato}`}>{site.contato}</a>.</>}
      </p>

      <h2>Quais dados o Nivo guarda</h2>
      <ul>
        <li>Seu nome e e-mail, informados no cadastro ou vindos da sua conta Google. Sua senha é guardada apenas de forma criptografada pelo Supabase; nem o Nivo consegue lê-la.</li>
        <li>Suas configurações: fuso horário e moeda.</li>
        <li>O que você registra: lançamentos, categorias, cartões e orçamentos.</li>
      </ul>
      <p>O Nivo não guarda número de cartão, senha de banco nem dados de pagamento.</p>

      <h2>Mensagens, áudios e fotos</h2>
      <p>
        Quando você escreve, grava um áudio ou envia uma foto, o conteúdo é enviado a um serviço de
        inteligência artificial (Google Gemini ou Groq) apenas para entender o valor, a data e a
        categoria. O Nivo guarda o lançamento resultante, não o histórico completo da conversa.
        Áudios e fotos são apagados logo após o processamento.
      </p>

      <h2>Onde os dados ficam</h2>
      <p>
        Os dados ficam no Supabase (banco de dados e login) e o app é hospedado na Vercel. A conexão
        é sempre criptografada (HTTPS), e cada pessoa só tem acesso aos próprios dados.
      </p>

      <h2>O que o Nivo não faz</h2>
      <ul>
        <li>Não vende nem compartilha seus dados para publicidade.</li>
        <li>Não se conecta à sua conta bancária. O saldo mostrado é calculado só a partir do que você registra.</li>
      </ul>

      <h2 id="exclusao">Como excluir sua conta e seus dados</h2>
      <p>
        No app, abra Mais e toque em Excluir conta. A exclusão apaga sua conta e todos os seus
        lançamentos, categorias e configurações de forma definitiva. Veja também a
        página <Link href="/excluir-conta">Excluir conta</Link>.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir acesso, correção ou exclusão dos
        seus dados a qualquer momento, pelos caminhos acima ou pelo contato do responsável.
      </p>
    </main>
  );
}
