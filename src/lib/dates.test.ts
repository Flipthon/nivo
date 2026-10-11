import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting, isValidTimeZone, localDateISO, localMonthISO, longDateLabel, monthLabel } from "./dates";

const SP = "America/Sao_Paulo";

test("23h50 em Brasília continua no mesmo dia local (UTC já virou o dia)", () => {
  // 30/10/2026 23:50 em São Paulo = 31/10/2026 02:50 UTC
  const instante = new Date("2026-10-31T02:50:00Z");
  assert.equal(localDateISO(instante, SP), "2026-10-30");
});

test("virada de mês: 31/10 23h50 em Brasília ainda é outubro", () => {
  const instante = new Date("2026-11-01T02:50:00Z");
  assert.equal(localDateISO(instante, SP), "2026-10-31");
  assert.equal(localMonthISO(instante, SP), "2026-10");
});

test("virada de ano no fuso local", () => {
  const instante = new Date("2027-01-01T02:59:00Z"); // 31/12/2026 23:59 em SP
  assert.equal(localMonthISO(instante, SP), "2026-12");
});

test("rótulo do mês vem do dado, não é fixo", () => {
  assert.equal(monthLabel("2026-10"), "outubro de 2026");
  assert.equal(monthLabel("2026-12"), "dezembro de 2026");
  assert.throws(() => monthLabel("2026-13"));
  assert.throws(() => monthLabel("dez"));
});

test("fusos válidos e inválidos", () => {
  assert.equal(isValidTimeZone(SP), true);
  assert.equal(isValidTimeZone("America/Manaus"), true);
  assert.equal(isValidTimeZone("Marte/Base_Alfa"), false);
  assert.equal(isValidTimeZone(""), false);
  assert.throws(() => localDateISO(new Date(), "Marte/Base_Alfa"));
});

test("saudação usa a hora local, não a do servidor", () => {
  // 11:30 UTC = 08:30 em São Paulo
  assert.equal(greeting(new Date("2026-10-10T11:30:00Z"), SP), "Bom dia");
  // 02:00 UTC = 23:00 do dia anterior em São Paulo
  assert.equal(greeting(new Date("2026-10-10T02:00:00Z"), SP), "Boa noite");
});

test("data por extenso em português", () => {
  assert.equal(longDateLabel(new Date("2026-10-10T15:00:00Z"), SP), "sábado, 10 de outubro");
});
