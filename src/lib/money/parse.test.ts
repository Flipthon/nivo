import { test } from "node:test";
import assert from "node:assert/strict";
import { findAmounts, looksLikeQuantity, MAX_CENTS } from "./parse";

const cents = (t: string) => findAmounts(t).map((m) => m.cents);

test("valores com algarismos", () => {
  assert.deepEqual(cents("R$ 1.234,56"), [123456]);
  assert.deepEqual(cents("1.234,56"), [123456]);
  assert.deepEqual(cents("1234.56"), [123456]);
  assert.deepEqual(cents("1234,5"), [123450]);
  assert.deepEqual(cents("almoço 35"), [3500]);
  assert.deepEqual(cents("gastei 35."), [3500]);
  assert.deepEqual(cents("gastei 35,90!"), [3590]);
  assert.deepEqual(cents("R$0"), [0]);
});

test("escalas", () => {
  assert.deepEqual(cents("5 milhões"), [500_000_000]);
  assert.deepEqual(cents("1 milhão"), [100_000_000]);
  assert.deepEqual(cents("2 mil"), [200_000]);
  assert.deepEqual(cents("2,5 mil"), [250_000]);
  assert.deepEqual(cents("3k"), [300_000]);
  assert.deepEqual(cents("2 mil e 500 de aluguel"), [250_000]);
});

test("por extenso", () => {
  assert.deepEqual(cents("mil e quinhentos"), [150_000]);
  assert.deepEqual(cents("dois mil e trezentos"), [230_000]);
  assert.deepEqual(cents("mil e quinhentos de aluguel"), [150_000]);
  assert.deepEqual(cents("cinquenta reais de pizza"), [5000]);
  assert.deepEqual(cents("cento e vinte e cinco"), [12500]);
});

test("gírias e aproximações", () => {
  const [a] = findAmounts("50 conto no bar");
  assert.equal(a.cents, 5000);
  assert.equal(a.marked, true);
  const [b] = findAmounts("uns 30 reais de gasolina");
  assert.equal(b.cents, 3000);
  assert.equal(b.approximate, true);
  assert.deepEqual(cents("35 reais e 50 centavos"), [3550]);
});

test("vários valores", () => {
  assert.deepEqual(cents("Almoço 35, Uber 18 e farmácia 42"), [3500, 1800, 4200]);
});

test("não confunde datas, horas, parcelas e quantidades", () => {
  assert.deepEqual(cents("dia 10"), []);
  assert.deepEqual(cents("10/10"), []);
  assert.deepEqual(cents("às 15"), []);
  assert.deepEqual(cents("15h"), []);
  assert.deepEqual(cents("15:30"), []);
  assert.deepEqual(cents("10x"), []);
  assert.deepEqual(cents("TV de 2400 em 10x no cartão"), [240000]);
  assert.deepEqual(cents("2 kg de carne 60"), [6000]);
  assert.deepEqual(cents("uma Coca-Cola 8"), [800]);
  assert.deepEqual(cents("duas pizzas"), []);
  assert.deepEqual(cents("5 de outubro de 2026 mercado 200"), [20000]);
  assert.deepEqual(cents("30%"), []);
});

test("negativos", () => {
  const [a] = findAmounts("-50");
  assert.equal(a.negative, true);
  const [b] = findAmounts("menos 20");
  assert.equal(b.negative, true);
});

test("fora do limite fica de fora", () => {
  assert.deepEqual(cents("99999999999999"), []);
  assert.deepEqual(cents("2 bilhões"), []);
  assert.ok(MAX_CENTS > 0);
});

test("quantidade x motivo", () => {
  const [q] = findAmounts("2 pizzas");
  assert.equal(looksLikeQuantity(q), true);
  const [r] = findAmounts("35 de almoço");
  assert.equal(looksLikeQuantity(r), false);
  const [s] = findAmounts("20 reais pizzas");
  assert.equal(looksLikeQuantity(s), false);
});
