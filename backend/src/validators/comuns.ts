import type { Request } from "express";
import { body, matchedData, param, query, type ValidationChain } from "express-validator";

const MAX_ID = 2_147_483_647;
const ESCALAR = (valor: unknown): boolean =>
  typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean";

export function soEscalar(cadeia: ValidationChain, rotulo: string): ValidationChain {
  return cadeia.custom(ESCALAR).withMessage(`${rotulo} inválido`).bail();
}

const PADRAO_NUMERIC_12_3 = /^\d{1,9}(\.\d{1,3})?$/;

export const validarId = soEscalar(param("id"), "Identificador")
  .isInt({ min: 1, max: MAX_ID })
  .withMessage("Identificador inválido")
  .toInt();

export const validarPaginacao: ValidationChain[] = [
  soEscalar(query("pagina").optional(), "Página").isInt({ min: 1, max: 1_000_000 }).withMessage("Página inválida").toInt(),
  soEscalar(query("limite").optional(), "Limite").isInt({ min: 1, max: 100 }).withMessage("Limite deve estar entre 1 e 100").toInt(),
];

export type Paginacao = { pagina?: number; limite?: number };

export type Pagina<T> = { dados: T[]; pagina: number; limite: number; total: number };

export function intervaloDe(entrada: Paginacao): { pagina: number; limite: number; skip: number; take: number } {
  const pagina = entrada.pagina ?? 1;
  const limite = entrada.limite ?? 20;
  return { pagina, limite, skip: (pagina - 1) * limite, take: limite };
}

export function texto(campo: string, rotulo: string, max: number, obrigatorio: boolean): ValidationChain {
  const base = body(campo);
  const cadeia = obrigatorio ? base : base.optional({ values: "null" });
  return cadeia
    .isString()
    .withMessage(`${rotulo} deve ser texto`)
    .bail()
    .trim()
    .isLength({ min: obrigatorio ? 1 : 0, max })
    .withMessage(
      obrigatorio ? `${rotulo} é obrigatório e deve ter até ${max} caracteres` : `${rotulo} deve ter até ${max} caracteres`,
    );
}

export function decimal(campo: string, rotulo: string, obrigatorio: boolean): ValidationChain {
  const base = body(campo);
  const cadeia = obrigatorio ? base : base.optional();
  return cadeia
    .custom((valor: unknown) => {
      if (typeof valor !== "string" && typeof valor !== "number") return false;
      return PADRAO_NUMERIC_12_3.test(String(valor));
    })
    .withMessage(`${rotulo} deve ser um número não negativo com até 9 inteiros e 3 decimais`)
    .customSanitizer((valor: string | number) => String(valor));
}

export function dataIso(campo: string, rotulo: string): ValidationChain {
  return soEscalar(body(campo).optional({ values: "null" }), rotulo)
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage(`${rotulo} deve ser uma data no formato AAAA-MM-DD`)
    .bail()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage(`${rotulo} deve ser uma data no formato AAAA-MM-DD`);
}

export function algumCampo(campos: string[]): ValidationChain {
  return body().custom((_valor: unknown, { req }) =>
    campos.some((c) => (req.body as Record<string, unknown> | undefined)?.[c] !== undefined),
  ).withMessage("Informe ao menos um campo para alterar");
}

export function dadosValidados<T>(req: Request, locations: ("body" | "params" | "query")[]): T {
  const dados = matchedData<Record<string, unknown>>(req, { locations, includeOptionals: true });
  return Object.fromEntries(Object.entries(dados).filter(([chave, valor]) => chave !== "" && valor !== undefined)) as T;
}

export function campoBusca(nome: string, rotulo: string, max: number): ValidationChain {
  return soEscalar(query(nome).optional(), rotulo)
    .isString()
    .withMessage(`${rotulo} inválido`)
    .bail()
    .trim()
    .isLength({ max })
    .withMessage(`${rotulo} deve ter até ${max} caracteres`);
}
