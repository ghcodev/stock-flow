import { useEffect, useMemo, useState } from "react";
import { listarUsuarios, type UsuarioGerenciado } from "../api/usuarios.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { CampoDeBusca } from "../componentes/CampoDeBusca.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { FaixaDeIndicadores } from "../componentes/FaixaDeIndicadores.tsx";
import { FiltrosRapidos, type OpcaoDeFiltro } from "../componentes/FiltrosRapidos.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { MenuDeAcoes, type ItemDeMenu } from "../componentes/MenuDeAcoes.tsx";
import { Paginacao } from "../componentes/Paginacao.tsx";
import { Tabela, type Coluna } from "../componentes/Tabela.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { formatarInteiro } from "../util/decimal.ts";
import { formatarDia } from "../util/datas.ts";
import { compararTexto } from "../util/ordenacao.ts";
import { paginaCorrigida } from "../util/paginacao.ts";
import { textoDoPerfil } from "../util/usuarios.ts";
import "../estilos/administracao.css";
import { ConfirmarInativacaoDeUsuario } from "./usuarios/ConfirmarInativacaoDeUsuario.tsx";
import { FormularioDeUsuario } from "./usuarios/FormularioDeUsuario.tsx";

type Situacao = "todos" | "ativos" | "inativos";
type FiltroDePerfil = "todos" | "administrador" | "operador";
type Painel = { usuario: UsuarioGerenciado | null } | null;

const LIMITE = 20;

function filtroDeAtivo(situacao: Situacao): boolean | undefined {
  if (situacao === "ativos") return true;
  return situacao === "inativos" ? false : undefined;
}

export function Usuarios() {
  const { cliente, sessao, atualizarUsuario } = useAutenticacao();
  const { mostrar } = useAvisos();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("ativos");
  const [perfil, setPerfil] = useState<FiltroDePerfil>("todos");
  const [pagina, setPagina] = useState(1);
  const [painel, setPainel] = useState<Painel>(null);
  const [paraInativar, setParaInativar] = useState<UsuarioGerenciado | null>(null);
  const meuId = sessao?.usuario.id_usuario ?? null;

  const lista = useCarregar(
    (sinal) =>
      listarUsuarios(
        cliente,
        { busca: busca === "" ? undefined : busca, ativo: filtroDeAtivo(situacao), perfil: perfil === "todos" ? undefined : perfil, pagina, limite: LIMITE },
        sinal,
      ),
    [cliente, busca, situacao, perfil, pagina],
  );

  const contagens = useCarregar(
    async (sinal) => {
      const [ativos, inativos, administradores] = await Promise.all([
        listarUsuarios(cliente, { ativo: true, limite: 1 }, sinal),
        listarUsuarios(cliente, { ativo: false, limite: 1 }, sinal),
        listarUsuarios(cliente, { ativo: true, perfil: "administrador", limite: 1 }, sinal),
      ]);
      return { ativos: ativos.total, inativos: inativos.total, administradores: administradores.total };
    },
    [cliente],
  );

  const totalDaLista = lista.dados?.total;
  const vaziaNaPagina = lista.dados !== null && lista.dados.dados.length === 0;

  useEffect(() => {
    if (totalDaLista === undefined || !vaziaNaPagina || pagina <= 1) return;
    const valida = paginaCorrigida(pagina, totalDaLista, LIMITE);
    if (valida !== pagina) setPagina(valida);
  }, [totalDaLista, vaziaNaPagina, pagina]);

  const recarregarTudo = () => {
    lista.recarregar();
    contagens.recarregar();
  };

  const colunas = useMemo<Coluna<UsuarioGerenciado>[]>(
    () => [
      {
        id: "nome",
        titulo: "Usuário",
        comparar: (a, b) => compararTexto(a.nome, b.nome),
        render: (usuario) => (
          <>
            <button type="button" className="celula-principal" onClick={() => setPainel({ usuario })}>
              {usuario.nome}
              {usuario.id_usuario === meuId ? <span className="celula-secundaria"> (você)</span> : null}
            </button>
            <div className="celula-secundaria celula-truncada">{usuario.email}</div>
          </>
        ),
      },
      {
        id: "perfil",
        titulo: "Perfil",
        comparar: (a, b) => compararTexto(a.perfil, b.perfil),
        render: (usuario) => (
          <Badge tom={usuario.perfil === "administrador" ? "admin" : "neutro"} ponto>
            {textoDoPerfil(usuario.perfil)}
          </Badge>
        ),
      },
      {
        id: "situacao",
        titulo: "Situação",
        alinhar: "centro",
        comparar: (a, b) => Number(b.ativo) - Number(a.ativo),
        render: (usuario) => (
          <Badge tom={usuario.ativo ? "sucesso" : "neutro"} ponto>
            {usuario.ativo ? "Ativo" : "Inativo"}
          </Badge>
        ),
      },
      {
        id: "cadastro",
        titulo: "Cadastro",
        comparar: (a, b) => compararTexto(a.created_at, b.created_at),
        render: (usuario) => formatarDia(usuario.created_at.slice(0, 10)),
      },
    ],
    [meuId],
  );

  const opcoesDeSituacao: OpcaoDeFiltro<Situacao>[] = [
    { valor: "ativos", rotulo: "Ativos", contagem: contagens.dados?.ativos ?? null },
    { valor: "inativos", rotulo: "Inativos", contagem: contagens.dados?.inativos ?? null },
    { valor: "todos", rotulo: "Todos", contagem: contagens.dados ? contagens.dados.ativos + contagens.dados.inativos : null },
  ];
  const opcoesDePerfil: OpcaoDeFiltro<FiltroDePerfil>[] = [
    { valor: "todos", rotulo: "Todos os perfis" },
    { valor: "administrador", rotulo: "Administradores" },
    { valor: "operador", rotulo: "Operadores" },
  ];

  const total = contagens.dados ? contagens.dados.ativos + contagens.dados.inativos : null;
  const linhas = lista.dados?.dados ?? [];

  const itensDoMenu = (usuario: UsuarioGerenciado): ItemDeMenu[] => {
    const itens: ItemDeMenu[] = [{ rotulo: "Editar", icone: "edit", aoSelecionar: () => setPainel({ usuario }) }];
    if (usuario.id_usuario !== meuId) {
      itens.push({ rotulo: "Inativar", icone: "pause", perigo: true, desabilitado: !usuario.ativo, aoSelecionar: () => setParaInativar(usuario) });
    }
    return itens;
  };

  return (
    <>
      <CabecalhoDePagina
        titulo="Usuários"
        resumo={[
          { texto: total === null ? "Carregando usuários…" : <><strong>{formatarInteiro(total)}</strong> cadastros</> },
          { texto: contagens.dados ? <><strong>{formatarInteiro(contagens.dados.administradores)}</strong> administradores ativos</> : "…" },
        ]}
        acoes={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={recarregarTudo} disabled={lista.carregando}>
              <Icone nome="refresh" />
              Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPainel({ usuario: null })}>
              <Icone nome="plus" />
              Novo usuário
            </button>
          </>
        }
      />

      <FaixaDeIndicadores
        rotulo="Resumo dos usuários"
        itens={[
          { rotulo: "Ativos", valor: contagens.dados?.ativos ?? null, detalhe: "conseguem entrar", icone: "circle-check", tom: "sucesso" },
          { rotulo: "Administradores", valor: contagens.dados?.administradores ?? null, detalhe: "ativos com acesso total", icone: "shield" },
          { rotulo: "Inativos", valor: contagens.dados?.inativos ?? null, detalhe: "sem acesso ao sistema", icone: "pause" },
        ]}
      />

      <section className="cartao" aria-label="Lista de usuários">
        <div className="barra-de-filtros">
          <CampoDeBusca
            rotulo="Buscar usuários"
            placeholder="Buscar por nome ou e-mail…"
            valor={busca}
            aoBuscar={(texto) => {
              setBusca(texto);
              setPagina(1);
            }}
          />
          <FiltrosRapidos
            rotulo="Situação"
            opcoes={opcoesDeSituacao}
            valor={situacao}
            aoMudar={(valor) => {
              setSituacao(valor);
              setPagina(1);
            }}
          />
          <FiltrosRapidos
            rotulo="Perfil"
            opcoes={opcoesDePerfil}
            valor={perfil}
            aoMudar={(valor) => {
              setPerfil(valor);
              setPagina(1);
            }}
          />
        </div>
        <Tabela
          rotulo="Usuários"
          colunas={colunas}
          linhas={linhas}
          chave={(usuario) => usuario.id_usuario}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          vazio={{
            titulo: busca === "" ? "Nenhum usuário encontrado" : "Nenhum usuário corresponde à busca",
            descricao: "Revise o termo ou os filtros de situação e perfil.",
          }}
          selecionada={(usuario) => painel?.usuario?.id_usuario === usuario.id_usuario}
          colunaDeAcoes={(usuario) => <MenuDeAcoes rotulo={`Ações de ${usuario.nome}`} itens={itensDoMenu(usuario)} />}
        />
        {lista.dados ? <Paginacao pagina={lista.dados.pagina} limite={lista.dados.limite} total={lista.dados.total} carregando={lista.carregando} aoMudar={setPagina} /> : null}
      </section>

      {painel ? (
        <FormularioDeUsuario
          key={painel.usuario?.id_usuario ?? "novo"}
          usuario={painel.usuario}
          aoFechar={() => setPainel(null)}
          aoResultadoIncerto={recarregarTudo}
          aoSalvar={(salvo, criado) => {
            setPainel(null);
            mostrar("sucesso", criado ? "Usuário criado" : "Usuário atualizado", salvo.nome);
            recarregarTudo();
            if (salvo.id_usuario === meuId) {
              atualizarUsuario().catch(() => undefined);
            }
          }}
        />
      ) : null}

      {paraInativar ? (
        <ConfirmarInativacaoDeUsuario
          usuario={paraInativar}
          aoCancelar={() => setParaInativar(null)}
          aoResultadoIncerto={recarregarTudo}
          aoConfirmar={(usuario) => {
            setParaInativar(null);
            setPainel(null);
            mostrar("sucesso", "Usuário inativado", usuario.nome);
            recarregarTudo();
          }}
        />
      ) : null}
    </>
  );
}
