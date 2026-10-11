import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, buildRows, confirmationReasons, itemsSchema, splitInstallments, type Item } from "./plan";

const base: Item = {
  kind: "expense", cents: 3500, description: "Almoço", categoryId: null,
  occurredOn: "2026-10-11", installments: 1, cardId: null, newCardName: null,
};

test("parcelas somam o total exato", () => {
  const p = splitInstallments(100000, 3);
  assert.deepEqual(p, [33334, 33333, 33333]);
  assert.equal(p.reduce((a, b) => a + b, 0), 100000);
  assert.throws(() => splitInstallments(2, 3));
});

test("meses com dia inexistente usam o último dia", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-15", 2), "2027-01-15");
});

test("buildRows gera uma linha por parcela, mesmo grupo e request", () => {
  let n = 0;
  const rows = buildRows([{ ...base, cents: 240000, installments: 10 }, { ...base, kind: "income", installments: 5 }], "r1", "chat", () => `g${++n}`);
  assert.equal(rows.length, 11);
  assert.equal(rows.filter((r) => r.item_index === 0).reduce((s, r) => s + r.amount_cents, 0), 240000);
  assert.equal(rows[9].occurred_on, "2027-07-11");
  assert.equal(rows[9].installment_number, 10);
  assert.ok(rows.slice(0, 10).every((r) => r.installment_group === "g1"));
  assert.equal(rows[10].installment_total, 1);
  assert.equal(rows[10].installment_group, null);
});

test("confirmação: valor fora do padrão, aproximado, cartão novo, data futura", () => {
  const ctx = { today: "2026-10-11", maxRecentExpenseCents: 10000 };
  assert.deepEqual(confirmationReasons([base], ctx), []);
  assert.equal(confirmationReasons([{ ...base, cents: 100001 }], ctx).length, 1);
  assert.equal(confirmationReasons([{ ...base, cents: 1_000_001 }], { ...ctx, maxRecentExpenseCents: null }).length, 1);
  assert.equal(confirmationReasons([{ ...base, cents: 999_999 }], { ...ctx, maxRecentExpenseCents: null }).length, 0);
  assert.equal(confirmationReasons([base], ctx, [{ approximate: true }]).length, 1);
  assert.equal(confirmationReasons([{ ...base, newCardName: "Itaú" }], ctx).length, 1);
  assert.equal(confirmationReasons([{ ...base, occurredOn: "2026-10-12" }], ctx).length, 1);
});

test("schema rejeita dados forjados pelo cliente", () => {
  assert.equal(itemsSchema.safeParse([base]).success, true);
  assert.equal(itemsSchema.safeParse([{ ...base, cents: 0 }]).success, false);
  assert.equal(itemsSchema.safeParse([{ ...base, cents: 1.5 }]).success, false);
  assert.equal(itemsSchema.safeParse([{ ...base, occurredOn: "2026-02-31" }]).success, false);
  assert.equal(itemsSchema.safeParse([{ ...base, installments: 49 }]).success, false);
  assert.equal(itemsSchema.safeParse([{ ...base, categoryId: "x' or 1=1" }]).success, false);
  assert.equal(itemsSchema.safeParse([]).success, false);
});
