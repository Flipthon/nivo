// Formatação de dinheiro. Valores sempre em centavos inteiros (nunca ponto flutuante no armazenamento).
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError("Valor em centavos inválido");
  return brl.format(cents / 100).replace(/ /g, " ");
}
