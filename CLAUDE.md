# Nivo — notas para o Claude

- App de finanças pessoais por conversa. Escopo: só finanças (agenda foi removida).
- Stack: Next.js 15 (App Router) + TypeScript, Supabase (projeto `nivo`, ref `ksazlveybmumososvsyr`, São Paulo), Vercel (projeto `nivo`, time `teeko-team`).
- Produção: https://meunivo.vercel.app — publica sozinho a cada push na `main`.
- Banco: mudanças via migrações em `supabase/migrations/` aplicadas pelo conector do Supabase.
- Fluxo de trabalho: juntar as alterações, testar localmente (`npm test`), fazer um único push por lote.
- Sem acesso ao npm neste ambiente: testes rodam com `tsx` e o `zod` de `/opt/npm-tools/node_modules`.
