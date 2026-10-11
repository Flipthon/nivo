import { test } from "node:test";
import assert from "node:assert/strict";
import { newPasswordSchema, signInSchema, signUpSchema } from "./schema";

test("cadastro válido normaliza o e-mail", () => {
  const r = signUpSchema.safeParse({ name: "Bruno", email: "  Bruno@Exemplo.COM ", password: "senha1234", confirm: "senha1234" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.email, "bruno@exemplo.com");
});

test("cadastro rejeita senha fraca, curta ou diferente", () => {
  assert.equal(signUpSchema.safeParse({ name: "B", email: "b@x.com", password: "12345678", confirm: "12345678" }).success, false);
  assert.equal(signUpSchema.safeParse({ name: "B", email: "b@x.com", password: "abc1", confirm: "abc1" }).success, false);
  assert.equal(signUpSchema.safeParse({ name: "B", email: "b@x.com", password: "senha1234", confirm: "senha12345" }).success, false);
});

test("cadastro rejeita e-mail inválido e nome vazio", () => {
  assert.equal(signUpSchema.safeParse({ name: "", email: "b@x.com", password: "senha1234", confirm: "senha1234" }).success, false);
  assert.equal(signUpSchema.safeParse({ name: "B", email: "não-é-email", password: "senha1234", confirm: "senha1234" }).success, false);
});

test("login exige e-mail e senha", () => {
  assert.equal(signInSchema.safeParse({ email: "b@x.com", password: "" }).success, false);
  assert.equal(signInSchema.safeParse({ email: "b@x.com", password: "qualquer" }).success, true);
});

test("nova senha precisa coincidir", () => {
  assert.equal(newPasswordSchema.safeParse({ password: "nova12345", confirm: "nova12345" }).success, true);
  assert.equal(newPasswordSchema.safeParse({ password: "nova12345", confirm: "outra1234" }).success, false);
});
