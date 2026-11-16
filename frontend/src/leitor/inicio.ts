import { lerSessaoSalva, type Armazenamento } from "../sessao/sessao.ts";
import { rotaUsaLeitor } from "../sessao/rotas.ts";

export function deveHabilitarNoInicio(armazenamento: Armazenamento, caminho: string, agoraMs: number): boolean {
  return lerSessaoSalva(armazenamento, agoraMs).sessao !== null && rotaUsaLeitor(caminho);
}
