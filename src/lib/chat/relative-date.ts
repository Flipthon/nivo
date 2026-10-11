// Datas relativas em português ("hoje", "ontem", "sexta passada", "dia 5", "05/10").
// Sempre calculadas a partir do "hoje" no fuso do usuário (AAAA-MM-DD), nunca do servidor.

export type DateMatch = { date: string; start: number; end: number };

const WEEKDAYS: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}
function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // 31/02 etc.
  return toISO(dt);
}

/** Procura a primeira referência de data no texto já normalizado (minúsculo e sem acento). */
export function findDate(norm: string, today: string): DateMatch | null {
  const [ty, tm] = today.split("-").map(Number);
  const rules: Array<[RegExp, (m: RegExpExecArray) => string | null]> = [
    [/(?<![a-z])anteontem(?![a-z])/, () => addDays(today, -2)],
    [/(?<![a-z])ontem(?![a-z])/, () => addDays(today, -1)],
    [/(?<![a-z])hoje(?![a-z])/, () => today],
    [/(?<![a-z])amanha(?![a-z])/, () => addDays(today, 1)],
    // 05/10/2026 · 5/10/26 · 5/10
    [/(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?![\d/])/, (m) => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : ty;
      let iso = validDate(y, Number(m[2]), Number(m[1]));
      // Sem ano e no futuro: entende como o ano passado ("28/12" digitado em janeiro).
      if (iso && !m[3] && iso > today) iso = validDate(y - 1, Number(m[2]), Number(m[1]));
      return iso;
    }],
    // 5 de outubro (de 2026)
    [new RegExp(`(?<![\\d])(\\d{1,2})\\s+de\\s+(${MONTHS.join("|")})(?:\\s+de\\s+(\\d{4}))?(?![a-z])`), (m) => {
      const month = MONTHS.indexOf(m[2]) + 1;
      let iso = validDate(m[3] ? Number(m[3]) : ty, month, Number(m[1]));
      if (iso && !m[3] && iso > today) iso = validDate(ty - 1, month, Number(m[1]));
      return iso;
    }],
    // dia 5 → este mês; se ainda não chegou, o mês passado
    [/(?<![a-z])dia\s+(\d{1,2})(?![\d/:])/, (m) => {
      const day = Number(m[1]);
      let iso = validDate(ty, tm, day);
      if (!iso || iso > today) iso = tm === 1 ? validDate(ty - 1, 12, day) : validDate(ty, tm - 1, day);
      return iso;
    }],
    // sexta passada · na segunda · sábado
    [/(?<![a-z])(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?(\s+passad[oa])?(?![a-z])/, (m) => {
      const target = WEEKDAYS[m[1]];
      const current = toUTC(today).getUTCDay();
      let back = (current - target + 7) % 7;
      if (m[2] && back === 0) back = 7;
      return addDays(today, -back);
    }],
  ];
  for (const [re, fn] of rules) {
    const m = re.exec(norm);
    if (!m) continue;
    const date = fn(m);
    if (date) return { date, start: m.index, end: m.index + m[0].length };
  }
  return null;
}
