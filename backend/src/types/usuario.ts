import type { perfil_usuario } from "../generated/prisma/enums.ts";

export type UsuarioAutenticado = {
  id: number;
  nome: string;
  email: string;
  perfil: perfil_usuario;
};
