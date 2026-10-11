import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Digite um e-mail válido.").max(254, "E-mail muito longo.");
const password = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "Use até 72 caracteres.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letras e números na senha.");

export const signInSchema = z.object({ email, password: z.string().min(1, "Digite sua senha.").max(72) });

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(60, "Use até 60 caracteres."),
    email,
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não são iguais.", path: ["confirm"] });

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "As senhas não são iguais.", path: ["confirm"] });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
