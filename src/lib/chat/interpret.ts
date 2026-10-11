// Intérprete de mensagens do Nivo. 100% determinístico: nada do que o usuário escreve vira
// instrução para o sistema. O texto só é usado para extrair valor, data, descrição e categoria.

import { findAmounts, fold, looksLikeQuantity, type AmountMatch } from "@/lib/money/parse";
import { findDate } from "./relative-date";
import { guessCategory, type CategoryRef } from "./categories";

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_ITEMS_PER_MESSAGE = 10;
export const MAX_INSTALLMENTS = 48;

export type CardRef = { id: string; name: string; kind: "credit" | "meal" | "transport" };

export type Draft = {
  kind: "expense" | "income";
  cents: number;
  description: string;
  categoryName: string;
  categoryMatched: boolean;
  occurredOn: string; // AAAA-MM-DD
  installments: number; // 1 = à vista
  cardId: string | null;
  cardMention: string | null; // "cartão" citado mas não encontrado → perguntar
  approximate: boolean;
};

export type Period = { from: string; to: string; label: string };

export type Intent =
  | { type: "entries"; drafts: Draft[]; notes: string[] }
  | { type: "query"; metric: "expense" | "income" | "balance"; period: Period; categoryName: string | null }
  | { type: "undo_last" }
  | { type: "correct_last"; cents: number | null; description: string | null; occurredOn: string | null }
  | { type: "card_payment"; cents: number; cardId: string | null; cardMention: string | null }
  | { type: "clarify"; message: string; suggestion?: Draft[] }
  | { type: "greeting" }
  | { type: "help"; message: string };

export type Context = {
  today: string; // AAAA-MM-DD no fuso do usuário
  categories?: CategoryRef[];
  cards?: CardRef[];
};

const HELP =
  "Me conte um gasto ou uma receita, por exemplo: “Almoço 35”, “Recebi 3500 de salário” ou “TV de 2400 em 10x no cartão Nubank”. Também posso responder “Quanto gastei este mês?”.";

const INCOME_VERBS = /(?<![a-z])(recebi|recebemos|ganhei|entrou|entraram|caiu|cairam|receita|vendi|faturei|salario|freela|rendimento|rendeu|pix recebido|me pagaram|me pagou)(?![a-z])/;
const EXPENSE_VERBS = /(?<![a-z])(gastei|gastamos|paguei|pagamos|comprei|compramos|gasto|despesa|custou|deu|foi|saiu|torrei)(?![a-z])/;
const FILLER = new Set([
  "gastei", "gastamos", "paguei", "pagamos", "comprei", "compramos", "gasto", "despesa", "custou", "deu", "foi", "saiu", "torrei",
  "recebi", "recebemos", "ganhei", "entrou", "entraram", "caiu", "cairam", "receita", "vendi", "faturei", "rendeu",
  "hoje", "ontem", "anteontem", "amanha", "agora", "reais", "real", "r", "conto", "contos", "pila", "pilas",
  "e", "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "com", "pro", "pra", "para", "por", "pelo", "pela",
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "meu", "minha", "eu", "mais", "so", "tambem", "ai", "la", "aqui",
  "cerca", "quase", "aproximadamente", "tipo", "valor", "total", "mais ou menos", "ja", "que", "com o", "isso",
]);
const LEADING_PREPS = /^(de|do|da|dos|das|no|na|nos|nas|em|com|pro|pra|para|pelo|pela)\s/;

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() : s;
}

/** Remove palavras de ligação nas pontas e devolve a descrição com a grafia original. */
function cleanDescription(original: string): string {
  const parts = original
    .replace(/[\n\r\t]+/g, " ")
    .replace(/[()"“”[\]{}<>]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const isFiller = (w: string) => FILLER.has(fold(w).replace(/[^a-z0-9$]/g, "")) || /^[,.;:!?\-–—$]+$/.test(w);
  while (parts.length && isFiller(parts[0])) parts.shift();
  while (parts.length && isFiller(parts[parts.length - 1])) parts.pop();
  const s = parts.join(" ").replace(/^[,.;:!?\-–—\s]+|[,.;:!?\-–—\s]+$/g, "");
  return clip(s, 80);
}

function capitalize(s: string) {
  return s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : s;
}

type Span = [number, number];
function blank(text: string, spans: Span[]): string {
  let out = text;
  for (const [s, e] of spans) out = out.slice(0, s) + " ".repeat(e - s) + out.slice(e);
  return out;
}

function monthBounds(today: string, offset: number): Period {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const label = offset === 0 ? "este mês" : offset === -1 ? "o mês passado" : "o mês";
  return { from: iso(d), to: iso(end), label };
}

function findCard(norm: string, cards: CardRef[]): { cardId: string | null; mention: string | null; span: Span | null } {
  // Cartão cadastrado citado pelo nome ("no Nubank", "cartão Inter", "VR")
  for (const c of [...cards].sort((a, b) => b.name.length - a.name.length)) {
    const n = fold(c.name).trim();
    if (!n) continue;
    const re = new RegExp(`(?:(?:no|pelo|com o|do)\\s+)?(?:cartao\\s+(?:de credito\\s+)?(?:do\\s+)?)?(?<![a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`);
    const m = re.exec(norm);
    if (m) return { cardId: c.id, mention: c.name, span: [m.index, m.index + m[0].length] };
  }
  const m = /(?:(?:no|pelo|com o|do)\s+)?cartao(?:\s+de\s+credito)?(?:\s+(?:do\s+)?([a-z0-9][a-z0-9-]{1,20}))?/.exec(norm);
  if (m) {
    const word = m[1] && !FILLER.has(m[1]) && !/^\d+x?$/.test(m[1]) && !["em", "parcelado", "a", "vista"].includes(m[1]) ? m[1] : null;
    const end = word ? m.index + m[0].length : m.index + m[0].length - (m[1] ? m[1].length + 1 : 0);
    return { cardId: null, mention: word ?? "cartão", span: [m.index, end] };
  }
  const credito = /(?:no\s+)?credito(?![a-z])/.exec(norm);
  if (credito) return { cardId: null, mention: "cartão", span: [credito.index, credito.index + credito[0].length] };
  return { cardId: null, mention: null, span: null };
}

function findInstallments(norm: string): { n: number; span: Span } | null {
  const re = /(?:(?:em|de|parcelad[oa]\s+em)\s+)?(\d{1,3})\s*(?:x|vezes|parcelas)(?![a-z])(?:\s+(?:sem|com)\s+juros)?/;
  const m = re.exec(norm);
  if (m) return { n: Number(m[1]), span: [m.index, m.index + m[0].length] };
  const avista = /(?<![a-z])(a vista|em uma vez)(?![a-z])/.exec(norm);
  if (avista) return { n: 1, span: [avista.index, avista.index + avista[0].length] };
  return null;
}

function queryIntent(norm: string, ctx: Context): Intent | null {
  const isQuestion =
    /(?<![a-z])(quanto|quantos|qual|quais|resumo|extrato|saldo|balanco|como (estou|esta|to|ta))(?![a-z])/.test(norm) ||
    norm.trim().endsWith("?");
  if (!isQuestion) return null;
  if (findAmounts(norm).some((a) => a.marked || a.cents >= 100)) {
    // "gastei 35 no almoço?" ainda é lançamento; perguntas raramente têm valor
    if (!/(?<![a-z])(quanto|qual|resumo|saldo)(?![a-z])/.test(norm)) return null;
  }
  let metric: "expense" | "income" | "balance" = "expense";
  if (/(?<![a-z])(recebi|ganhei|entrou|receitas?|renda)(?![a-z])/.test(norm)) metric = "income";
  if (/(?<![a-z])(saldo|sobrou|sobra|balanco|resumo|como (estou|esta|to|ta)|tenho)(?![a-z])/.test(norm)) metric = "balance";
  if (/(?<![a-z])(gastei|gastos?|despesas?|paguei)(?![a-z])/.test(norm)) metric = "expense";

  let period = monthBounds(ctx.today, 0);
  if (/mes passado|ultimo mes/.test(norm)) period = monthBounds(ctx.today, -1);
  else if (/(?<![a-z])hoje(?![a-z])/.test(norm)) period = { from: ctx.today, to: ctx.today, label: "hoje" };
  else if (/(?<![a-z])ontem(?![a-z])/.test(norm)) {
    const d = findDate("ontem", ctx.today)!.date;
    period = { from: d, to: d, label: "ontem" };
  } else {
    const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const mm = new RegExp(`(?:em|de)\\s+(${months.join("|")})(?![a-z])`).exec(norm);
    if (mm) {
      const target = months.indexOf(mm[1]) + 1;
      const [, cm] = ctx.today.split("-").map(Number);
      let offset = target - cm;
      if (offset > 0) offset -= 12; // "em dezembro" falado em outubro = dezembro passado
      period = { ...monthBounds(ctx.today, offset), label: mm[1] === "marco" ? "março" : mm[1] };
    }
  }

  let categoryName: string | null = null;
  if (metric === "expense") {
    const m = /(?:com|de|em|no|na)\s+([a-z][a-z ]{2,40})\??$/.exec(norm.replace(/\s*(este|esse|neste|nesse|no) mes\??$|\s*(mes passado|hoje|ontem)\??$/, ""));
    if (m) {
      const g = guessCategory(m[1], "expense", ctx.categories ?? []);
      if (g.matched) categoryName = g.name;
    }
  }
  return { type: "query", metric, period, categoryName };
}

export function interpret(input: string, ctx: Context): Intent {
  const text = clip(String(input ?? "").replace(/\s+/g, " ").trim(), MAX_MESSAGE_LENGTH);
  const norm = fold(text);
  if (!norm) return { type: "help", message: HELP };

  // Desfazer
  if (/(?<![a-z])(apaga|apague|apagar|desfaz|desfazer|desfaca|cancela|cancelar|cancele|remove|remover|exclui|excluir|deleta|deletar|tira|tirar)(?![a-z]).{0,30}(ultimo|ultima|isso|esse|essa|lancamento|anterior)?/.test(norm)
    && norm.split(" ").length <= 8 && !findAmounts(norm).length) {
    return { type: "undo_last" };
  }

  // Correção do último lançamento
  const correction = /^(na verdade|na real|corrigindo|corrige|corrija|ops|opa|errei|nao,|nao foi|era)(?![a-z])/.exec(norm);
  if (correction) {
    const rest = norm.slice(correction[0].length);
    const amounts = findAmounts(rest).filter((a) => !looksLikeQuantity(a));
    const date = findDate(rest, ctx.today);
    const descSource = blank(text.slice(correction[0].length), [
      ...amounts.map((a) => [a.start, a.end] as Span),
      ...(date ? [[date.start, date.end] as Span] : []),
    ]);
    const desc = cleanDescription(descSource.replace(/(?<![a-z])(foi|era|valor|o valor)(?![a-z])/gi, " "));
    if (amounts.length <= 1 && (amounts.length || date || desc)) {
      return {
        type: "correct_last",
        cents: amounts[0]?.cents ?? null,
        description: desc ? capitalize(desc) : null,
        occurredOn: date?.date ?? null,
      };
    }
  }

  // Saudação simples
  if (/^(oi+|ola|opa|bom dia|boa tarde|boa noite|e ai|hey|eae)[!.\s]*$/.test(norm)) return { type: "greeting" };
  if (/^(ajuda|help|como funciona|o que voce faz|menu)\??$/.test(norm)) return { type: "help", message: HELP };

  // Pagamento de fatura (não é gasto novo: as compras já foram lançadas)
  if (/(?<![a-z])(pag(uei|ar|amos|ando)|quitei)\s+(a\s+)?fatura|pagamento\s+da\s+fatura/.test(norm)) {
    const amt = findAmounts(norm).find((a) => !looksLikeQuantity(a));
    const card = findCard(norm, ctx.cards ?? []);
    if (!amt) return { type: "clarify", message: "Qual foi o valor da fatura que você pagou?" };
    return { type: "card_payment", cents: amt.cents, cardId: card.cardId, cardMention: card.mention };
  }

  // Perguntas sobre o mês
  const q = queryIntent(norm, ctx);
  if (q) return q;

  // Fora do escopo (o Nivo cuida só das finanças)
  if (/(?<![a-z])(me lembr[ae]|lembrete|agenda|agendar|compromisso|reuniao|alarme|despert)/.test(norm) && !findAmounts(norm).length) {
    return { type: "help", message: "O Nivo cuida só das suas finanças, então não guardo lembretes ou compromissos. " + HELP };
  }

  let amounts: AmountMatch[] = findAmounts(text);
  const installments = findInstallments(norm);
  const card = findCard(norm, ctx.cards ?? []);
  const date = findDate(norm, ctx.today);

  // Tira valores que estão dentro de trechos de parcela/cartão/data
  const reserved: Span[] = [installments?.span, card.span, date ? ([date.start, date.end] as Span) : null].filter(Boolean) as Span[];
  amounts = amounts.filter((a) => !reserved.some(([s, e]) => a.start < e && a.end > s));

  // "2 pizzas 60": a quantidade sai quando há outro valor
  const money = amounts.filter((a) => !looksLikeQuantity(a));
  if (!money.length) {
    if (amounts.length) {
      return { type: "clarify", message: "Não encontrei o valor. Quanto foi? Ex.: “2 pizzas por 60”." };
    }
    if (/(?<![a-z])(gastei|paguei|comprei|recebi|ganhei)(?![a-z])/.test(norm)) {
      return { type: "clarify", message: "Quanto foi? Me diga o valor, ex.: “gastei 35 no almoço”." };
    }
    return { type: "help", message: HELP };
  }
  if (money.length > MAX_ITEMS_PER_MESSAGE) {
    return { type: "clarify", message: `Consigo lançar até ${MAX_ITEMS_PER_MESSAGE} itens por mensagem. Pode dividir em partes?` };
  }

  // Transferência entre contas e estorno: perguntar antes de virar gasto ou receita
  if (/(?<![a-z])(transferi|transferencia|guardei|poupanca|investi|aplicacao|apliquei|resgatei|saquei|saque)(?![a-z])/.test(norm)) {
    return {
      type: "clarify",
      message: "Parece uma movimentação entre contas suas (transferência, poupança ou investimento). Isso não é gasto nem receita no Nivo. Se foi um pagamento para outra pessoa, me conte como gasto, ex.: “Paguei 200 ao pedreiro”.",
    };
  }
  const isRefund = /(?<![a-z])(estorno|estornaram|estornou|reembolso|reembolsaram|devolveram|devolucao|cashback)(?![a-z])/.test(norm);

  const notes: string[] = [];
  const skipSpans: Span[] = [...reserved, ...amounts.map((a) => [a.start, a.end] as Span)];
  const cleaned = blank(text, skipSpans);
  let currentKind: "expense" | "income" = isRefund ? "income" : "expense";
  const drafts: Draft[] = [];

  for (let i = 0; i < money.length; i++) {
    const a = money[i];
    const prevEnd = i === 0 ? 0 : money[i - 1].end;
    const nextStart = i + 1 < money.length ? money[i + 1].start : text.length;
    const beforeRaw = cleaned.slice(prevEnd, a.start);
    let afterRaw = cleaned.slice(a.end, nextStart);
    // Na parte de depois, para no conector " e " / vírgula que inicia o próximo item
    const cut = /\s(e)\s|[,;]/i.exec(afterRaw);
    const afterHead = cut && i + 1 < money.length ? afterRaw.slice(0, cut.index) : afterRaw;

    const beforeNorm = fold(beforeRaw);
    if (INCOME_VERBS.test(beforeNorm)) currentKind = "income";
    else if (EXPENSE_VERBS.test(beforeNorm)) currentKind = isRefund ? "income" : "expense";
    if (i === 0 && INCOME_VERBS.test(fold(afterHead))) currentKind = "income";

    const before = cleanDescription(beforeRaw);
    const after = cleanDescription(afterHead);
    const afterIsReason = LEADING_PREPS.test(fold(afterHead.trim() + " ")) && after.length > 0;
    let description = afterIsReason ? after : before || after;
    // O "depois" do item anterior pode ter virado descrição dele; não reaproveitar
    if (!afterIsReason && i > 0 && drafts[i - 1] && fold(drafts[i - 1].description) === fold(before)) description = after;
    if (i === 0 && !afterIsReason && !before && after) description = after;

    const kind = currentKind;
    const cat = guessCategory(description || text, kind, ctx.categories ?? []);
    if (!description) description = isRefund ? "Estorno" : kind === "income" ? cat.name : "";

    const isCardPurchase = kind === "expense" && (card.mention !== null || (installments?.n ?? 1) > 1);
    drafts.push({
      kind,
      cents: a.cents,
      description: capitalize(description),
      categoryName: cat.name,
      categoryMatched: cat.matched,
      occurredOn: date?.date ?? ctx.today,
      installments: kind === "expense" ? Math.min(Math.max(installments?.n ?? 1, 1), MAX_INSTALLMENTS + 1) : 1,
      cardId: isCardPurchase ? card.cardId : null,
      cardMention: isCardPurchase && !card.cardId ? card.mention ?? "cartão" : null,
      approximate: a.approximate,
    });
  }

  if (drafts.some((d) => d.cents === 0)) {
    return { type: "clarify", message: "O valor ficou zerado. Quanto foi?" };
  }
  if (drafts.some((d) => d.installments > MAX_INSTALLMENTS)) {
    return { type: "clarify", message: `O Nivo aceita até ${MAX_INSTALLMENTS} parcelas. Em quantas vezes foi?` };
  }
  if (money.some((a) => a.negative)) {
    notes.push("Entendi o valor sem o sinal de menos. Se era um estorno, me diga “recebi estorno de …”.");
  }
  if (isRefund) notes.push("Estornos entram como receita.");
  return { type: "entries", drafts, notes };
}
