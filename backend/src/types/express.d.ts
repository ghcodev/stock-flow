import type { UsuarioAutenticado } from "./usuario.ts";

declare module "express-serve-static-core" {
  interface Request {
    usuario?: UsuarioAutenticado;
  }
}
