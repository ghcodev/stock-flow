import { campoEmail, campoSenha, MIN_CARACTERES_SENHA } from "./comuns.ts";

export const validarLogin = [campoEmail(false), campoSenha("senha", "Senha", 1)];

export const validarTrocaDeSenha = [
  campoSenha("senha_atual", "Senha atual", 1),
  campoSenha("nova_senha", "Nova senha", MIN_CARACTERES_SENHA),
];
