// Datas no fuso do usuário. Sem dependências, para rodar igual no servidor e nos testes.

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

export function localParts(instant: Date, tz: string): LocalParts {
  if (!isValidTimeZone(tz)) throw new RangeError(`Fuso horário inválido: ${tz}`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Data local no formato AAAA-MM-DD (ex.: data financeira de um lançamento). */
export function localDateISO(instant: Date, tz: string): string {
  const { year, month, day } = localParts(instant, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Mês local no formato AAAA-MM. */
export function localMonthISO(instant: Date, tz: string): string {
  return localDateISO(instant, tz).slice(0, 7);
}

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-10" → "outubro de 2026". Gerado a partir do dado, nunca fixo na interface. */
export function monthLabel(monthISO: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthISO);
  if (!m) throw new RangeError(`Mês inválido: ${monthISO}`);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new RangeError(`Mês inválido: ${monthISO}`);
  return `${MONTHS_PT[month - 1]} de ${m[1]}`;
}

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora local do usuário. */
export function greeting(instant: Date, tz: string): string {
  const { hour } = localParts(instant, tz);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Data por extenso para cabeçalhos, ex.: "sábado, 10 de outubro". */
export function longDateLabel(instant: Date, tz: string): string {
  if (!isValidTimeZone(tz)) throw new RangeError(`Fuso horário inválido: ${tz}`);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instant);
}
