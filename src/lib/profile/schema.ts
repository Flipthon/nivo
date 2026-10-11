import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";

export const profileUpdateSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Informe seu nome.")
    .max(60, "Use até 60 caracteres."),
  timezone: z.string().refine(isValidTimeZone, "Escolha um fuso horário válido."),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
