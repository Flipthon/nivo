# Nivo

Controle seus gastos do mês conversando.

No ar: https://meunivo.vercel.app (Vercel, projeto `nivo`) · Banco: Supabase, projeto `nivo` (São Paulo).

Stack: Next.js 15 (App Router) + TypeScript, Supabase (Postgres, login e Row Level Security), hospedagem na Vercel.

## Situação atual: Etapa 1

| Item | Situação |
|---|---|
| Estrutura do projeto e separação de módulos | Feito |
| Login com Google (Supabase Auth) | Feito, **não testado** de ponta a ponta |
| Login com Apple | Código pronto, desativado até haver conta Apple Developer |
| Perfil (nome, e-mail, fuso, moeda) | Feito |
| Categorias padrão criadas no cadastro | Feito |
| Isolamento entre usuários (RLS + sessão no servidor) | Feito |
| Navegação móvel (Início, Lançamentos, Mais) | Feito |
| Instalável (manifest, ícones, service worker, página offline) | Feito |
| Política de privacidade pública (`/privacidade`) | Feito |
| Exclusão de conta no app e página pública (`/excluir-conta`) | Feito |
| Vínculo com o app Android (`/.well-known/assetlinks.json`) | Feito, preenchido só ao gerar o app |
| Conversa e lançamentos | Telas avisam a etapa em que chegam; nada finge funcionar |

## Testes

| Teste | Comando | Resultado |
|---|---|---|
| Datas e fuso (23h50 de Brasília, virada de mês e ano, fuso inválido) | `npm test` | 7/7 passaram |
| Proteção contra redirecionamento externo no login | `npm test` | 2/2 passaram |
| Isolamento entre usuários e exclusão de conta (19 verificações pgTAP) | `npm run test:db` | Rodado no banco real em 10/10/2026: 17 de 17 verificações equivalentes passaram |
| Compilação completa (`npm run build`, `npm run typecheck`) | | **NÃO TESTADO**: o ambiente de criação não tinha internet para instalar pacotes |
| Login real com Google, layout em 375px no celular | | **NÃO TESTADO**: exige projeto publicado |

## Configuração passo a passo

Siga na ordem. Leva cerca de 1 hora na primeira vez.

### 1. Supabase (banco e login)
1. Crie uma conta em https://supabase.com e clique em **New project**.
2. Nome: `nivo`. Crie uma senha forte para o banco e guarde. Região: **South America (São Paulo)**. Plano: Free.
3. Quando o projeto terminar de criar, abra **SQL Editor > New query**.
4. Cole todo o conteúdo de `supabase/migrations/20261010000001_etapa1_perfis_categorias.sql` e clique em **Run**. Deve aparecer "Success".
5. Repita, na ordem, com `20261010000002_excluir_conta.sql` e `20261010000003_excluir_conta_exige_login_recente.sql`.
6. Em **Project Settings > API Keys**, anote a **Project URL** e a chave **anon** (aba "Legacy API keys") ou a **Publishable key**.
7. Em **Authentication > Sign In / Providers > Google**, copie a **Callback URL** mostrada (algo como `https://xxxx.supabase.co/auth/v1/callback`). Não feche essa tela.

### 2. Google (botão "Entrar com Google")
1. Abra https://console.cloud.google.com e crie um projeto chamado `Nivo`.
2. Vá em **Google Auth Platform** (ou "APIs e serviços > Tela de consentimento OAuth") e clique em **Começar**.
   - Nome do app: `Nivo`. E-mail de suporte: o seu. Público: **Externo**.
3. Em **Clientes > Criar cliente**: tipo **Aplicativo da Web**, nome `Nivo Web`.
   - Em **URIs de redirecionamento autorizados**, cole a Callback URL do Supabase.
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.
5. Volte ao Supabase (passo 1.7), ative o Google, cole os dois valores e salve.
6. Em **Público**, enquanto o app está em teste, adicione seu e-mail como usuário de teste. Antes de liberar para outras pessoas, clique em **Publicar app**.

### 3. GitHub (onde o código fica guardado)
1. Crie uma conta em https://github.com e instale o **GitHub Desktop** (https://desktop.github.com).
2. Descompacte o zip do Nivo numa pasta do computador.
3. No GitHub Desktop: **File > Add local repository**, escolha a pasta `nivo` e aceite criar o repositório.
4. Clique em **Publish repository**, deixe marcado **Keep this code private** e publique.

### 4. Vercel (site no ar)
1. Entre em https://vercel.com com a conta do GitHub.
2. **Add New > Project**, escolha o repositório `nivo` e clique em **Import**.
3. Abra **Environment Variables** e adicione:
   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon ou publishable |
   | `NEXT_PUBLIC_RESPONSAVEL` | seu nome completo |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | seu e-mail de contato |
   | `NEXT_PUBLIC_AUTH_APPLE_ENABLED` | `false` |
4. Clique em **Deploy** e espere terminar. Anote o endereço gerado, por exemplo `https://nivo-abc.vercel.app`.

### 5. Ligar o site ao login
1. No Supabase, **Authentication > URL Configuration**:
   - **Site URL**: o endereço da Vercel.
   - **Redirect URLs**: adicione `https://SEU-ENDERECO.vercel.app/auth/callback`.
2. Salve.

### 6. Testar
1. Abra o endereço da Vercel no celular e entre com Google.
2. Confira: seu nome na tela Início, o mês atual no resumo, a troca de abas e a edição do perfil em Mais.
3. Abra `/privacidade` e `/excluir-conta` sem estar logado: as duas devem abrir.
4. Se algo falhar, anote a mensagem. Na Vercel, **Deployments > (último) > Logs** mostra os erros do servidor.

Toda vez que você publicar uma alteração pelo GitHub Desktop (**Commit** e **Push**), a Vercel atualiza o site sozinha.

### Rodar no computador (opcional)
```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev                  # http://localhost:3000
npm test
```

### Login com Apple (opcional)
Exige o Apple Developer Program (cerca de US$ 99/ano). Depois de configurar o provedor Apple no Supabase, mude `NEXT_PUBLIC_AUTH_APPLE_ENABLED` para `true`.

## Google Play

O Nivo vai para a Play Store como **Trusted Web Activity**: um app Android que abre o site em tela cheia, sem barra de endereço. O que já está pronto no código:
- manifest, ícones (inclusive o adaptável) e service worker;
- página offline sem guardar dados privados;
- política de privacidade pública;
- exclusão de conta dentro do app e página pública de exclusão;
- rota `/.well-known/assetlinks.json`, que liga o app ao site.

Quando o app estiver completo:
1. Crie a conta em https://play.google.com/console (taxa única de US$ 25 e verificação de identidade).
2. Gere o pacote Android em https://www.pwabuilder.com com o endereço do site. Guarde a chave de assinatura que ele fornece.
3. Coloque o nome do pacote e a impressão digital SHA-256 em `ANDROID_PACKAGE_NAME` e `ANDROID_CERT_SHA256` na Vercel. Depois de enviar à Play, inclua também a impressão digital da **Assinatura de apps do Google Play** (Play Console > Integridade do app).
4. Contas pessoais criadas depois de novembro de 2023 precisam de um **teste fechado com 12 testadores por 14 dias seguidos** antes de liberar para todos.
5. Preencha na Play Console: ficha da loja, Segurança dos dados, URL da política (`/privacidade`), URL de exclusão (`/excluir-conta`), classificação de conteúdo, público-alvo e declaração de recursos financeiros.

## Arquitetura

```
src/
  app/                 telas e rotas (Next.js)
    (app)/             área logada: Início (resumo + conversa), Lançamentos, Mais
    login/             tela de entrada
    auth/callback/     retorno do login OAuth
  components/          interface reutilizável
  lib/
    auth/              sessão, saída e redirecionamento seguro
    supabase/          clientes do banco (servidor, navegador, middleware)
    profile/           validação e gravação do perfil
    dates.ts           datas no fuso do usuário
supabase/
  migrations/          esquema versionado
  tests/database/      testes de isolamento (pgTAP)
```

Regras de segurança aplicadas desde já:
- O servidor obtém o usuário pela sessão validada (`requireUser`), nunca por um `user_id` vindo do navegador.
- O banco aplica Row Level Security: mesmo chamando a API diretamente, um usuário não lê nem altera dados de outro.
- O dono de cada registro é preenchido pelo banco (`auth.uid()`), e a permissão de escrita é limitada por coluna.
- Visitantes sem login não têm acesso a nenhuma tabela.
- Categorias não são apagadas, só arquivadas, para não deixar lançamentos órfãos.

## Próximas etapas
2. Lançamentos, categorias, cartões e parcelamento, leitor de valores em português, conversa por texto na tela Início, confirmação, desfazer e correções.
3. Tela de lançamentos com filtros e gráfico, orçamento mensal e aprendizado de categorias.
4. Áudio (Whisper na Groq) e fotos de cupons e comprovantes.
5. PWA, página "Seus dados" (exportar e apagar conta) e testes finais.
