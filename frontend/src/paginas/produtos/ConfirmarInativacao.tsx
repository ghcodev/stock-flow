import { useState } from "react";
import { inativarProduto } from "../../api/produtos.ts";
import type { Produto } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario } from "../../componentes/Campo.tsx";
import { Modal } from "../../componentes/Modal.tsx";
import { interpretarFalhaDeFormulario } from "../../util/formularios.ts";

type Propriedades = {
  produto: Produto;
  aoCancelar: () => void;
  aoResultadoIncerto?: () => void;
  aoConfirmar: (produto: Produto) => void;
};

export function ConfirmarInativacao({ aoResultadoIncerto, produto, aoCancelar, aoConfirmar }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      aoConfirmar(await inativarProduto(cliente, produto.id_produto));
    } catch (falha) {
      const resultado = interpretarFalhaDeFormulario(falha);
      if (resultado.incerta) aoResultadoIncerto?.();
      setErro(resultado.geral);
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto
      titulo="Inativar produto"
      bloqueado={enviando}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoCancelar} disabled={enviando} data-foco-inicial="">
            Cancelar
          </button>
          <button type="button" className="btn btn-perigo" onClick={confirmar} disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : null}
            {enviando ? "Inativando…" : "Inativar produto"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={erro} />
      <p>
        Deseja inativar <strong>{produto.nome}</strong>? Um produto inativo deixa de aceitar novos lotes e não volta a ficar ativo por esta tela. Os lotes e
        movimentações já registrados são mantidos.
      </p>
    </Modal>
  );
}
