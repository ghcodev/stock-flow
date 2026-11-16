import { useRef, useState } from "react";
import { inativarUsuario, type UsuarioGerenciado } from "../../api/usuarios.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario } from "../../componentes/Campo.tsx";
import { Modal } from "../../componentes/Modal.tsx";
import { criarEnvioUnico } from "../../util/envio.ts";
import { interpretarFalhaDeUsuario } from "../../util/usuarios.ts";

type Propriedades = {
  usuario: UsuarioGerenciado;
  aoCancelar: () => void;
  aoResultadoIncerto: () => void;
  aoConfirmar: (usuario: UsuarioGerenciado) => void;
};

export function ConfirmarInativacaoDeUsuario({ usuario, aoCancelar, aoResultadoIncerto, aoConfirmar }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const envio = useRef(criarEnvioUnico());

  const confirmar = () => {
    const execucao = envio.current.executar(() => inativarUsuario(cliente, usuario.id_usuario));
    if (execucao === null) return;
    setEnviando(true);
    setErro(null);
    execucao.then(aoConfirmar, (falha: unknown) => {
      const resultado = interpretarFalhaDeUsuario(falha);
      if (resultado.incerta) aoResultadoIncerto();
      setErro(resultado.geral);
      setEnviando(false);
    });
  };

  return (
    <Modal
      aberto
      titulo="Inativar usuário"
      bloqueado={enviando}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoCancelar} disabled={enviando} data-foco-inicial="">
            Cancelar
          </button>
          <button type="button" className="btn btn-perigo" onClick={confirmar} disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : null}
            {enviando ? "Inativando…" : "Inativar usuário"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={erro} />
      <p>
        Deseja inativar <strong>{usuario.nome}</strong> ({usuario.email})? O usuário deixa de conseguir entrar no sistema. O histórico e a auditoria das operações
        dele são mantidos. Esta tela não reativa usuários.
      </p>
    </Modal>
  );
}
