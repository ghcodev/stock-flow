import { useEffect, useRef, useState, type FormEvent } from "react";
import { consultarUsuarioAtual } from "../api/autenticacao.ts";
import { trocarMinhaSenha } from "../api/usuarios.ts";
import { useAutenticacao } from "../autenticacao/ContextoDeAutenticacao.tsx";
import { useAvisos } from "../componentes/Avisos.tsx";
import { Badge } from "../componentes/Badge.tsx";
import { CabecalhoDePagina } from "../componentes/CabecalhoDePagina.tsx";
import { AvisoDoFormulario, focarPrimeiroInvalido } from "../componentes/Campo.tsx";
import { CampoDeSenha } from "../componentes/CampoDeSenha.tsx";
import { EstadoDeErro } from "../componentes/Estados.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { useCarregar } from "../hooks/useCarregar.ts";
import { criarEnvioUnico } from "../util/envio.ts";
import { temErrosDeCampos, type ErrosDeCampos } from "../util/formularios.ts";
import { interpretarFalhaDeTrocaDeSenha, textoDoPerfil, validarTrocaDeSenha } from "../util/usuarios.ts";
import "../estilos/administracao.css";

export function Perfil() {
  const { cliente } = useAutenticacao();
  const { mostrar } = useAvisos();
  const eu = useCarregar((sinal) => consultarUsuarioAtual(cliente, sinal), [cliente]);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erros, setErros] = useState<ErrosDeCampos>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const envio = useRef(criarEnvioUnico());

  useEffect(() => {
    if (espera <= 0) return;
    const temporizador = window.setTimeout(() => setEspera((segundos) => segundos - 1), 1000);
    return () => window.clearTimeout(temporizador);
  }, [espera]);

  const limpar = () => {
    setAtual("");
    setNova("");
    setConfirmacao("");
  };

  const alterar = (campo: string, aplicar: (valor: string) => void) => (valor: string) => {
    aplicar(valor);
    setErros(({ [campo]: _removido, ...resto }) => resto);
  };

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (envio.current.ocupado() || espera > 0) return;
    const invalidos = validarTrocaDeSenha(atual, nova, confirmacao);
    setErros(invalidos);
    setGeral(null);
    if (temErrosDeCampos(invalidos)) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    const execucao = envio.current.executar(() => trocarMinhaSenha(cliente, atual, nova));
    if (execucao === null) return;
    setEnviando(true);
    execucao.then(
      () => {
        limpar();
        setEnviando(false);
        mostrar("sucesso", "Senha alterada", "Use a nova senha no próximo acesso.");
      },
      (falha: unknown) => {
        const resultado = interpretarFalhaDeTrocaDeSenha(falha);
        limpar();
        setErros(resultado.campos);
        setGeral(resultado.geral);
        if (resultado.segundosParaRepetir !== null) setEspera(Math.min(Math.max(Math.ceil(resultado.segundosParaRepetir), 1), 900));
        setEnviando(false);
        focarPrimeiroInvalido(formulario);
      },
    );
  };

  const bloqueado = enviando || espera > 0;

  return (
    <>
      <CabecalhoDePagina titulo="Meu Perfil" resumo={[{ texto: "Dados da conta e senha" }]} />

      <div className="perfil-grade">
        <section className="cartao" aria-label="Dados da conta">
          <div className="cartao-cabecalho">
            <h2>Dados da conta</h2>
          </div>
          <div className="cartao-corpo">
            {eu.erro && eu.dados === null ? (
              <EstadoDeErro mensagem={eu.erro} aoTentarNovamente={eu.recarregar} />
            ) : eu.dados === null ? (
              <span className="esqueleto" />
            ) : (
              <div className="detalhes-grupo">
                <div>
                  <div className="detalhe-rotulo">Nome</div>
                  <div className="detalhe-valor">{eu.dados.nome}</div>
                </div>
                <div>
                  <div className="detalhe-rotulo">E-mail</div>
                  <div className="detalhe-valor">{eu.dados.email}</div>
                </div>
                <div>
                  <div className="detalhe-rotulo">Perfil</div>
                  <div className="detalhe-valor">
                    <Badge tom={eu.dados.perfil === "administrador" ? "admin" : "neutro"} ponto>
                      {textoDoPerfil(eu.dados.perfil)}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            <p className="campo-ajuda">Nome, e-mail e perfil são alterados por um administrador na tela de Usuários.</p>
          </div>
        </section>

        <section className="cartao" aria-label="Trocar senha">
          <div className="cartao-cabecalho">
            <h2>Trocar senha</h2>
          </div>
          <div className="cartao-corpo">
            <AvisoDoFormulario mensagem={geral} />
            {espera > 0 ? (
              <p className="campo-ajuda" role="status">
                Nova tentativa liberada em {espera} s.
              </p>
            ) : null}
            <form className="formulario" onSubmit={enviar} noValidate aria-busy={enviando} autoComplete="off">
              <CampoDeSenha obrigatorio rotulo="Senha atual" valor={atual} aoMudar={alterar("senha_atual", setAtual)} erro={erros["senha_atual"]} autoComplete="current-password" desabilitado={bloqueado} />
              <CampoDeSenha
                obrigatorio
                rotulo="Nova senha"
                valor={nova}
                aoMudar={alterar("nova_senha", setNova)}
                erro={erros["nova_senha"]}
                ajuda="Mínimo de 8 caracteres e até 72 bytes."
                desabilitado={bloqueado}
              />
              <CampoDeSenha obrigatorio rotulo="Confirmar nova senha" valor={confirmacao} aoMudar={alterar("confirmacao", setConfirmacao)} erro={erros["confirmacao"]} desabilitado={bloqueado} />
              <div className="formulario-acoes">
                <button type="submit" className="btn btn-primary" disabled={bloqueado} aria-busy={enviando}>
                  {enviando ? <span className="spinner" aria-hidden="true" /> : <Icone nome="key" />}
                  {enviando ? "Alterando…" : "Alterar senha"}
                </button>
              </div>
            </form>
            <p className="campo-ajuda">Ao trocar a senha, as sessões já abertas continuam válidas até expirarem (até 8 horas depois do login).</p>
          </div>
        </section>
      </div>
    </>
  );
}
