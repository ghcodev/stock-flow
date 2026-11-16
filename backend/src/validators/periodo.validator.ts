import { query } from "express-validator";
import { lerInstante, periodoValido } from "../periodo.ts";
import { soEscalar } from "./comuns.ts";

const instante = (nome: string, rotulo: string) =>
  soEscalar(query(nome).optional(), rotulo)
    .isString()
    .withMessage(`${rotulo} inválido`)
    .bail()
    .custom((valor: string) => lerInstante(valor) !== null)
    .withMessage(`${rotulo} deve ser AAAA-MM-DD ou data e hora completas com Z ou deslocamento (+hh:mm)`);

export const validarPeriodoDeConsulta = [
  instante("de", "Início do período"),
  instante("ate", "Fim do período"),
  query("ate")
    .optional()
    .custom((ate: string, { req }) => {
      const de = (req.query as { de?: unknown } | undefined)?.de;
      const inicio = typeof de === "string" ? lerInstante(de) : null;
      const fim = typeof ate === "string" ? lerInstante(ate) : null;
      return !inicio || !fim || periodoValido(inicio, fim);
    })
    .withMessage("O início do período deve ser anterior ao fim"),
];
