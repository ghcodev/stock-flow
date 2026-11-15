import { idNoCorpo, quantidadePositiva, texto } from "./comuns.ts";

const camposDeSaldo = [
  idNoCorpo("id_lote", "Lote"),
  quantidadePositiva("quantidade", "Quantidade"),
  texto("motivo", "Motivo", 255, false),
  texto("observacao", "Observação", 5000, false),
];

export const validarEntrada = camposDeSaldo;

export const validarSaida = camposDeSaldo;
