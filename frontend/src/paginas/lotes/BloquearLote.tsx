import { useState, type FormEvent } from "react";
import { bloquearLote } from "../../api/lotes.ts";
import type { Lote } from "../../api/tipos.ts";
import { useAutenticacao } from "../../autenticacao/ContextoDeAutenticacao.tsx";
import { AvisoDoFormulario, CampoDeAreaDeTexto, focarPrimeiroInvalido } from "../../componentes/Campo.tsx";
import { Modal } from "../../componentes/Modal.tsx";
import { interpretarFalhaDeFormulario, validarMotivo } from "../../util/formularios.ts";

type Propriedades = {
  lote: Lote;
  aoCancelar: () => void;
  aoBloquear: (lote: Lote) => void;
};

const ID_DO_FORMULARIO = "formulario-de-bloqueio";

export function BloquearLote({ lote, aoCancelar, aoBloquear }: Propriedades) {
  const { cliente } = useAutenticacao();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | undefined>(undefined);
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (enviando) return;
    const invalido = validarMotivo(motivo);
    setErro(invalido ?? undefined);
    setGeral(null);
    if (invalido !== null) {
      focarPrimeiroInvalido(formulario);
      return;
    }
    setEnviando(true);
    try {
      aoBloquear(await bloquearLote(cliente, lote.id_lote, motivo));
    } catch (falha) {
      const resultado = interpretarFalhaDeFormulario(falha);
      setErro(resultado.campos["motivo"]);
      setGeral(resultado.geral);
      setEnviando(false);
      focarPrimeiroInvalido(formulario);
    }
  };

  return (
    <Modal
      aberto
      titulo="Bloquear lote"
      aoFechar={enviando ? () => undefined : aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-outline" onClick={aoCancelar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form={ID_DO_FORMULARIO} className="btn btn-perigo" disabled={enviando} aria-busy={enviando}>
            {enviando ? <span className="spinner" aria-hidden="true" /> : null}
            {enviando ? "Bloqueando…" : "Bloquear lote"}
          </button>
        </>
      }
    >
      <AvisoDoFormulario mensagem={geral} />
      <p>
        O lote <strong>{lote.numero_lote}</strong> deixa de aceitar saídas e transferências até ser desbloqueado. O saldo não muda.
      </p>
      <form id={ID_DO_FORMULARIO} className="formulario" onSubmit={enviar} noValidate>
        <CampoDeAreaDeTexto
          obrigatorio
          rotulo="Motivo do bloqueio"
          valor={motivo}
          aoMudar={(valor) => {
            setMotivo(valor);
            setErro(undefined);
          }}
          erro={erro}
          tamanhoMaximo={500}
          desabilitado={enviando}
        />
      </form>
    </Modal>
  );
}
