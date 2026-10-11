// Leitor de valores em português brasileiro.
// Determinístico e sem IA: encontra valores em dinheiro numa frase e devolve centavos inteiros.
// Ignora datas ("dia 10", "10/10"), horários ("15h", "às 15"), parcelas ("10x") e quantidades ("2 kg").

export type AmountMatch = {
  cents: number;
  start: number; // posição no texto original
  end: number;
  marked: boolean; // tem "R$", "reais", "conto"… junto
  negative: boolean;
  approximate: boolean; // "uns", "cerca de"…
  fromWords: boolean; // escrito por extenso
  nextWord: string | null; // palavra seguinte (ajuda a separar valor de quantidade)
};

export const MAX_CENTS = 99_999_999_999; // R$ 999.999.999,99

/** Troca letras acentuadas pela versão sem acento, mantendo o mesmo tamanho do texto. */
export function fold(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) {
    const base = ch.normalize("NFD")[0] ?? ch;
    out += base.length === ch.length ? base : ch;
  }
  return out.replace(/−/g, "-");
}

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600,
  seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};
const SCALES: Record<string, number> = {
  mil: 1_000, milhao: 1_000_000, milhoes: 1_000_000, bilhao: 1_000_000_000, bilhoes: 1_000_000_000,
};
const CURRENCY_AFTER = /^\s*(reais|real|conto|contos|pila|pilas|pau|paus|mangos?|dilmas?|r\$)(?![a-z])/;
const CURRENCY_BEFORE = /r\$\s*$/;
const APPROX_BEFORE = /(?:^|[^a-z])(uns|umas|cerca de|mais ou menos|aproximadamente|quase|por volta de|uns r\$|tipo)\s*(?:r\$\s*)?$/;
// Depois do número: parcelas, horas, medidas, porcentagem, partes de data.
const NOT_MONEY_AFTER =
  /^\s*(x(?![a-z])|vezes|parcelas?|h(?![a-z])|hs(?![a-z])|horas?|hrs?(?![a-z])|:|\/|%|º|°|ª|kg|g(?![a-z])|gramas?|km|quilos?|kilos?|l(?![a-z])|litros?|ml|min(?![a-z])|minutos?|dias?(?![a-z])|semanas?|meses|mes(?![a-z])|anos?(?![a-z])|pessoas?|unidades?|un(?![a-z])|metros?|m(?![a-z0-9$]))/;
const MONTHS = "janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
// Antes do número: "dia 10", "às 15", "de outubro de 2026", data com barra.
const NOT_MONEY_BEFORE = new RegExp(
  `(?:(?:^|[^a-z])(dia|dias|as|ate as|desde as|das|numero|n\\.?|nº|parcela|vencimento em|vence|vence dia|vence em)\\s*$)|(?:(${MONTHS})\\s+de\\s*$)|(?:[\\d]\\s*[\\/:]\\s*$)`,
);
// "5 de outubro", "10 do mês"
const DATE_AFTER = new RegExp(`^\\s*(de|do)\\s+(${MONTHS}|mes)(?![a-z])`);
const CONNECTORS = new Set([
  "e", "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "com", "pro", "pra", "para", "por", "pelo", "pela",
  "ao", "a", "o", "pras", "pros", "hoje", "domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "dia", "semana", "mes", "ontem", "anteontem", "amanha", "agora", "so", "mais", "menos", "cada", "reais", "real",
]);

function nextWordAt(norm: string, from: number): string | null {
  const m = /^\s*([a-z][a-z-]*)/.exec(norm.slice(from)); // vírgula ou ponto encerram o item
  return m ? m[1] : null;
}

function parseDigits(raw: string): number | null {
  // Retorna centavos. Aceita 1.234,56 · 1234,56 · 1234.56 · 1.234 · 50
  let s = raw;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(s)) s = s; // decimal com ponto
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, ""); // 1,234 (formato americano)
  else if (!/^\d+$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  if (int.length > 13) return null;
  const cents = Number(int) * 100 + Number((dec + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

function wordValue(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (const w of words) {
    if (w === "e") continue;
    if (w in UNITS) { current += UNITS[w]; seen = true; continue; }
    if (w in SCALES) {
      const scale = SCALES[w];
      total += (current || 1) * scale;
      current = 0;
      seen = true;
      continue;
    }
    return null;
  }
  return seen ? total + current : null;
}

type Candidate = AmountMatch;

export function findAmounts(text: string): AmountMatch[] {
  const norm = fold(text);
  const found: Candidate[] = [];
  const taken: Array<[number, number]> = [];
  const overlaps = (a: number, b: number) => taken.some(([s, e]) => a < e && b > s);

  // 1) Números com algarismos (opcionalmente com "mil", "milhões" ou "k" depois)
  const NUM = /(-\s*)?(r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+[.,]\d{1,2}(?!\d)|\d+)(?![\d.,]\d)/g;
  for (let m: RegExpExecArray | null; (m = NUM.exec(norm)); ) {
    const start = m.index;
    let end = start + m[0].length;
    const before = norm.slice(0, start);
    if (/[a-z0-9]$/.test(before)) continue; // parte de uma palavra (ex.: "mp3")
    if (overlaps(start, start + m[0].length)) continue;
    let cents = parseDigits(m[3]);
    if (cents === null) continue;

    let after = norm.slice(end);
    // "5 milhões", "2 mil", "2,5 mil", "3k"
    const scale = /^\s*(mil|milhao|milhoes|bilhao|bilhoes)(?![a-z])/.exec(after) ?? /^(k)(?![a-z])/.exec(after);
    if (scale) {
      const factor = scale[1] === "k" ? 1000 : SCALES[scale[1]];
      cents = cents * factor;
      end += scale[0].length;
      after = norm.slice(end);
      // "2 mil e 500"
      const rest = /^\s*e\s+(\d{1,3})(?![\d.,])/.exec(after);
      if (rest && factor === 1000) {
        cents += Number(rest[1]) * 100;
        end += rest[0].length;
        after = norm.slice(end);
      }
    } else {
      if (NOT_MONEY_AFTER.test(after) || DATE_AFTER.test(after)) continue;
      if (NOT_MONEY_BEFORE.test(before) && !m[2]) continue;
      // Data com barra ou hora com dois-pontos logo depois ("10/10", "15:30")
      if (/^[/:]\d/.test(after)) continue;
    }

    const markedBefore = Boolean(m[2]) || CURRENCY_BEFORE.test(before);
    const cur = CURRENCY_AFTER.exec(after);
    if (cur) end += cur[0].length;
    // "35 reais e 50 centavos"
    const centavos = /^\s*e\s+(\d{1,2})\s+centavos?/.exec(norm.slice(end));
    if (centavos && cur) {
      cents += Number(centavos[1]);
      end += centavos[0].length;
    }
    if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) continue;

    const negative = Boolean(m[1]) || /(?:^|\s)menos\s*$/.test(before);
    found.push({
      cents, start, end,
      marked: markedBefore || Boolean(cur),
      negative,
      approximate: APPROX_BEFORE.test(before),
      fromWords: false,
      nextWord: nextWordAt(norm, end),
    });
    taken.push([start, end]);
    NUM.lastIndex = Math.max(NUM.lastIndex, end);
  }

  // 2) Números por extenso ("mil e quinhentos", "cinquenta conto")
  const WORD = /[a-z]+/g;
  const tokens: Array<{ w: string; s: number; e: number }> = [];
  for (let m: RegExpExecArray | null; (m = WORD.exec(norm)); ) tokens.push({ w: m[0], s: m.index, e: m.index + m[0].length });

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!(t.w in UNITS) && !(t.w in SCALES)) continue;
    if (overlaps(t.s, t.e)) continue;
    // Junta a sequência: número (e número)*
    let j = i;
    const words = [t.w];
    while (j + 1 < tokens.length) {
      const nxt = tokens[j + 1];
      const gap = norm.slice(tokens[j].e, nxt.s);
      if (!/^\s+$/.test(gap)) break;
      if (nxt.w === "e" && j + 2 < tokens.length && (tokens[j + 2].w in UNITS || tokens[j + 2].w in SCALES)
        && /^\s+$/.test(norm.slice(nxt.e, tokens[j + 2].s))) {
        words.push("e", tokens[j + 2].w);
        j += 2;
        continue;
      }
      if (nxt.w in UNITS || nxt.w in SCALES) { words.push(nxt.w); j += 1; continue; }
      break;
    }
    const value = wordValue(words);
    if (value === null) { i = j; continue; }
    const start = t.s;
    let end = tokens[j].e;
    const before = norm.slice(0, start);
    let after = norm.slice(end);
    const hasScale = words.some((w) => w in SCALES);
    const cur = CURRENCY_AFTER.exec(after);
    const markedBefore = CURRENCY_BEFORE.test(before);
    const marked = Boolean(cur) || markedBefore;

    // "uma Coca-Cola", "duas pizzas": números pequenos sem moeda são quantidades
    if (!marked && !hasScale && value < 10) { i = j; continue; }
    if (NOT_MONEY_AFTER.test(after) || DATE_AFTER.test(after) || (NOT_MONEY_BEFORE.test(before) && !marked)) { i = j; continue; }

    if (cur) { end += cur[0].length; after = norm.slice(end); }
    const cents = value * 100;
    if (!Number.isSafeInteger(cents) || cents > MAX_CENTS || overlaps(start, end)) { i = j; continue; }
    found.push({
      cents, start, end, marked,
      negative: /(?:^|\s)menos\s*$/.test(before),
      approximate: APPROX_BEFORE.test(before),
      fromWords: true,
      nextWord: nextWordAt(norm, end),
    });
    taken.push([start, end]);
    i = j;
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * True quando o número parece contar objetos ("2 pizzas", "3 cervejas", "1 pizza"), e não ser o valor.
 * Só números pequenos e redondos, sem moeda, seguidos de uma palavra que não é ligação nem data.
 */
export function looksLikeQuantity(m: AmountMatch): boolean {
  if (m.marked || !m.nextWord || CONNECTORS.has(m.nextWord)) return false;
  if (m.cents % 100 !== 0 || m.cents > 2_000) return false;
  return m.cents === 100 || /s$/.test(m.nextWord);
}
