import { body, type ValidationChain } from "express-validator";
import { semNul, soEscalar, validarId } from "./comuns.ts";

export const TIPOS_ETIQUETA = ["qr_code", "rfid"];

export function tipoEtiqueta(cadeia: ValidationChain): ValidationChain {
  return soEscalar(cadeia, "Tipo de etiqueta").isIn(TIPOS_ETIQUETA).withMessage("Tipo de etiqueta deve ser qr_code ou rfid");
}

export function codigoEtiqueta(cadeia: ValidationChain): ValidationChain {
  return cadeia
    .isString()
    .withMessage("Código da etiqueta deve ser texto")
    .bail()
    .custom(semNul)
    .withMessage("Código da etiqueta contém caractere inválido")
    .bail()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage("Código da etiqueta é obrigatório e deve ter até 128 caracteres");
}

export const validarAssociarEtiqueta = [validarId, tipoEtiqueta(body("tipo")), codigoEtiqueta(body("codigo"))];
