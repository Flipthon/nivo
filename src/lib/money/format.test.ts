import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCents } from "./format";

test("formata centavos em reais", () => {
  assert.equal(formatCents(0), "R$ 0,00");
  assert.equal(formatCents(123456), "R$ 1.234,56");
  assert.equal(formatCents(500000000), "R$ 5.000.000,00");
  assert.equal(formatCents(-3500), "-R$ 35,00");
});

test("rejeita valores que não são centavos inteiros", () => {
  assert.throws(() => formatCents(1.5));
  assert.throws(() => formatCents(Number.MAX_SAFE_INTEGER + 2));
});
