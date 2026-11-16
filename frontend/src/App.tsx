import type { ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { ProvedorDeAutenticacao } from "./autenticacao/ContextoDeAutenticacao.tsx";
import { ExigeSessao, Protegida } from "./autenticacao/RotaProtegida.tsx";
import { ProvedorDeAvisos } from "./componentes/Avisos.tsx";
import { Layout } from "./componentes/Layout.tsx";
import { ITENS_DE_MENU } from "./sessao/navegacao.ts";
import type { Recurso } from "./sessao/permissoes.ts";
import { Inventario } from "./paginas/Inventario.tsx";
import { Usuarios } from "./paginas/Usuarios.tsx";
import { Auditoria } from "./paginas/Auditoria.tsx";
import { Historico } from "./paginas/Historico.tsx";
import { Rastreabilidade } from "./paginas/Rastreabilidade.tsx";
import { Dashboard } from "./paginas/Dashboard.tsx";
import { Entrada } from "./paginas/Entrada.tsx";
import { Lotes } from "./paginas/Lotes.tsx";
import { Saida } from "./paginas/Saida.tsx";
import { Vencimentos } from "./paginas/Vencimentos.tsx";
import { Transferencia } from "./paginas/Transferencia.tsx";
import { Produtos } from "./paginas/Produtos.tsx";
import { EmBreve } from "./paginas/EmBreve.tsx";
import { Entrar } from "./paginas/Entrar.tsx";
import { NaoEncontrada } from "./paginas/NaoEncontrada.tsx";

const PAGINAS: Partial<Record<Recurso, ComponentType>> = { inventario: Inventario, usuarios: Usuarios, auditoria: Auditoria, historico: Historico, rastreabilidade: Rastreabilidade, dashboard: Dashboard, vencimentos: Vencimentos, produtos: Produtos, lotes: Lotes, entrada: Entrada, saida: Saida, transferencia: Transferencia };

export function App() {
  return (
    <BrowserRouter>
      <ProvedorDeAutenticacao>
        <ProvedorDeAvisos>
        <Routes>
          <Route path="/entrar" element={<Entrar />} caseSensitive />
          <Route element={<ExigeSessao />}>
            <Route element={<Layout />}>
              {ITENS_DE_MENU.map((item) => {
                const Pagina = PAGINAS[item.recurso] ?? EmBreve;
                return (
                  <Route
                    key={item.recurso}
                    path={item.caminho}
                    caseSensitive
                    element={
                      <Protegida recurso={item.recurso}>
                        <Pagina />
                      </Protegida>
                    }
                  />
                );
              })}
              <Route path="*" element={<NaoEncontrada />} />
            </Route>
          </Route>
        </Routes>
        </ProvedorDeAvisos>
      </ProvedorDeAutenticacao>
    </BrowserRouter>
  );
}
