// Palavras-chave → categorias padrão do Nivo. O texto já chega normalizado (sem acento).
// Categorias criadas pelo usuário têm prioridade: se o nome dela aparecer na frase, ela vence.

import { fold } from "@/lib/money/parse";

const EXPENSE_KEYWORDS: Array<[string, string[]]> = [
  ["Assinaturas Digitais", ["netflix", "spotify", "disney", "prime video", "amazon prime", "hbo", "youtube premium", "icloud", "google one", "chatgpt", "deezer", "globoplay", "assinatura", "streaming", "paramount", "apple tv"]],
  ["Energia elétrica", ["conta de luz", "luz", "energia", "enel", "cemig", "copel", "coelba", "celpe", "eletropaulo", "light"]],
  ["Água", ["conta de agua", "sabesp", "saneamento", "copasa", "cedae", "embasa", "agua"]],
  ["Internet", ["internet", "wifi", "wi-fi", "fibra", "banda larga"]],
  ["Telefone", ["celular", "telefone", "recarga", "plano de celular", "plano do celular", "tim", "claro", "vivo"]],
  ["Material de Limpeza", ["limpeza", "detergente", "sabao", "desinfetante", "amaciante", "vassoura", "agua sanitaria", "esponja"]],
  ["Veículo", ["uber", "99", "taxi", "gasolina", "combustivel", "etanol", "diesel", "posto", "estacionamento", "pedagio", "oficina", "mecanico", "ipva", "licenciamento", "seguro do carro", "lava jato", "lavagem", "onibus", "metro", "pneu", "oleo", "moto", "carro"]],
  ["Educação", ["escola", "faculdade", "curso", "livro", "livros", "mensalidade", "material escolar", "apostila", "aula"]],
  ["Animais de Estimação", ["pet", "petshop", "pet shop", "racao", "veterinario", "banho e tosa", "gato", "cachorro", "areia do gato"]],
  ["Viagens", ["viagem", "hotel", "passagem", "airbnb", "voo", "hospedagem", "pousada", "aeroporto"]],
  ["Alimentação", ["almoco", "almocei", "janta", "jantar", "jantei", "cafe", "lanche", "mercado", "supermercado", "padaria", "ifood", "restaurante", "pizza", "hamburguer", "comida", "acougue", "feira", "sorvete", "bar", "cerveja", "acai", "marmita", "delivery", "rappi", "sushi", "churrasco", "hortifruti", "pao", "refrigerante", "coca", "salgado", "doce", "bolo"]],
];

const INCOME_KEYWORDS: Array<[string, string[]]> = [
  ["Salário", ["salario", "holerite", "pagamento do trabalho", "contracheque"]],
];

export const DEFAULT_EXPENSE_CATEGORY = "Despesas Diversas";
export const DEFAULT_INCOME_CATEGORY = "Outras receitas";

function hasWord(norm: string, word: string): boolean {
  const re = new RegExp(`(?<![a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`);
  return re.test(norm);
}

export type CategoryRef = { id: string; name: string; kind: "expense" | "income" };

/**
 * Escolhe a categoria pelo texto. Retorna o NOME; quem chama troca pelo id da categoria do usuário.
 * `userCategories`, quando informado, permite casar categorias que o próprio usuário criou.
 */
export function guessCategory(
  text: string,
  kind: "expense" | "income",
  userCategories: CategoryRef[] = [],
): { name: string; matched: boolean } {
  const norm = fold(text);
  for (const c of userCategories) {
    if (c.kind !== kind) continue;
    const n = fold(c.name).trim();
    if (n.length >= 3 && hasWord(norm, n)) return { name: c.name, matched: true };
  }
  const table = kind === "expense" ? EXPENSE_KEYWORDS : INCOME_KEYWORDS;
  for (const [name, words] of table) {
    if (words.some((w) => hasWord(norm, w))) return { name, matched: true };
  }
  return { name: kind === "expense" ? DEFAULT_EXPENSE_CATEGORY : DEFAULT_INCOME_CATEGORY, matched: false };
}

/** Acha a categoria do usuário com esse nome (ignorando acento e maiúsculas). */
export function resolveCategory(name: string, kind: "expense" | "income", cats: CategoryRef[]): CategoryRef | null {
  const n = fold(name).trim();
  return cats.find((c) => c.kind === kind && fold(c.name).trim() === n) ?? null;
}
