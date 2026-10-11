// Dados públicos do responsável pelo app (aparecem na política de privacidade).
export const site = {
  responsavel: process.env.NEXT_PUBLIC_RESPONSAVEL || "Responsável pelo Nivo",
  contato: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  politicaAtualizadaEm: "10 de outubro de 2026",
};
