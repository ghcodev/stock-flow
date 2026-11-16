import { ErroDaApi, ErroDeRede, mensagemDoErro } from "../api/erros.ts";

export const NOME_PADRAO_DO_CSV = "alertas-vencimento.csv";

export function mensagemDaExportacao(erro: unknown): string | null {
  if (erro instanceof ErroDeRede && erro.motivo === "CANCELADO") return null;
  if (erro instanceof ErroDaApi) {
    if (erro.status === 403) return "Somente administradores podem exportar este relatório.";
    if (erro.status === 422 && erro.codigo === "EXPORTACAO_MUITO_GRANDE") return erro.message;
    if (erro.status === 401) return null;
  }
  if (erro instanceof ErroDeRede && erro.motivo === "TEMPO_ESGOTADO") return "A exportação demorou demais. Tente novamente.";
  return mensagemDoErro(erro);
}
