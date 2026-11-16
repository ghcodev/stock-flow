import { lerSessaoSalva, type Armazenamento } from "../sessao/sessao.ts";
import { capturaPermitida } from "../sessao/rotas.ts";

export function deveHabilitarNoInicio(armazenamento: Armazenamento, caminho: string, agoraMs: number): boolean {
  return capturaPermitida(lerSessaoSalva(armazenamento, agoraMs).sessao?.usuario.perfil ?? null, caminho);
}
