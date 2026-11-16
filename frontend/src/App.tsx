import { Suspense, lazy, type ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { ProvedorDeAutenticacao } from "./autenticacao/ContextoDeAutenticacao.tsx";
import { ExigeSessao, Protegida } from "./autenticacao/RotaProtegida.tsx";
import { ProvedorDeAvisos } from "./componentes/Avisos.tsx";
import { Layout } from "./componentes/Layout.tsx";
import { ITENS_DE_MENU } from "./sessao/navegacao.ts";
import type { Recurso } from "./sessao/permissoes.ts";
import { Dashboard } from "./paginas/Dashboard.tsx";
import { Entrar } from "./paginas/Entrar.tsx";
import { NaoEncontrada } from "./paginas/NaoEncontrada.tsx";

function sobDemanda<N extends string>(importar: () => Promise<Record<N, ComponentType>>, nome: N): ComponentType {
  return lazy<ComponentType>(() => importar().then((modulo) => ({ default: modulo[nome] })));
}

const PAGINAS: Record<Recurso, ComponentType> = {
  dashboard: Dashboard,
  produtos: sobDemanda(() => import("./paginas/Produtos.tsx"), "Produtos"),
  lotes: sobDemanda(() => import("./paginas/Lotes.tsx"), "Lotes"),
  mapa: sobDemanda(() => import("./paginas/Mapa.tsx"), "Mapa"),
  entrada: sobDemanda(() => import("./paginas/Entrada.tsx"), "Entrada"),
  saida: sobDemanda(() => import("./paginas/Saida.tsx"), "Saida"),
  transferencia: sobDemanda(() => import("./paginas/Transferencia.tsx"), "Transferencia"),
  inventario: sobDemanda(() => import("./paginas/Inventario.tsx"), "Inventario"),
  ajuste: sobDemanda(() => import("./paginas/Ajuste.tsx"), "Ajuste"),
  historico: sobDemanda(() => import("./paginas/Historico.tsx"), "Historico"),
  rastreabilidade: sobDemanda(() => import("./paginas/Rastreabilidade.tsx"), "Rastreabilidade"),
  vencimentos: sobDemanda(() => import("./paginas/Vencimentos.tsx"), "Vencimentos"),
  usuarios: sobDemanda(() => import("./paginas/Usuarios.tsx"), "Usuarios"),
  auditoria: sobDemanda(() => import("./paginas/Auditoria.tsx"), "Auditoria"),
  perfil: sobDemanda(() => import("./paginas/Perfil.tsx"), "Perfil"),
};

function CarregandoTela() {
  return (
    <div className="estado" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>Carregando a tela…</span>
    </div>
  );
}

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
                  const Pagina = PAGINAS[item.recurso];
                  return (
                    <Route
                      key={item.recurso}
                      path={item.caminho}
                      caseSensitive
                      element={
                        <Protegida recurso={item.recurso}>
                          <Suspense fallback={<CarregandoTela />}>
                            <Pagina />
                          </Suspense>
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
