import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./redirect";

test("aceita caminhos internos", () => {
  assert.equal(safeNextPath("/"), "/");
  assert.equal(safeNextPath("/mais"), "/mais");
  assert.equal(safeNextPath("/lancamentos?mes=2026-10"), "/lancamentos?mes=2026-10");
});

test("bloqueia redirecionamento externo", () => {
  assert.equal(safeNextPath("https://site-malicioso.com"), "/");
  assert.equal(safeNextPath("//site-malicioso.com"), "/");
  assert.equal(safeNextPath("/\\site-malicioso.com"), "/");
  assert.equal(safeNextPath("/ok\r\nSet-Cookie: x=1"), "/");
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath(""), "/");
});
