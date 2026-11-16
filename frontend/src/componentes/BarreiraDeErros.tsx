import { Component, type ReactNode } from "react";
import { Icone } from "./Icone.tsx";

type Propriedades = {
  children: ReactNode;
  falhouNaCarga: () => boolean;
  aoTentarDeNovo: () => void;
};

type Estado = { falhou: boolean };

export class BarreiraDeErros extends Component<Propriedades, Estado> {
  override state: Estado = { falhou: false };

  static getDerivedStateFromError(): Estado {
    return { falhou: true };
  }

  private tentarDeNovo = () => {
    this.props.aoTentarDeNovo();
    this.setState({ falhou: false });
  };

  private recarregar = () => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.falhou) return this.props.children;
    const deCarga = this.props.falhouNaCarga();
    return (
      <div className="estado estado--erro" role="alert">
        <Icone nome="alert-triangle" />
        <strong>{deCarga ? "Não foi possível carregar esta tela" : "Não foi possível exibir esta tela"}</strong>
        <span>
          {deCarga
            ? "A conexão caiu ou a aplicação foi atualizada. Recarregue a aplicação: o que foi digitado nesta tela pode ser perdido."
            : "Tente de novo. Se continuar, recarregue a aplicação: o que foi digitado nesta tela pode ser perdido."}
        </span>
        <div className="estado-acoes">
          {deCarga ? null : (
            <button type="button" className="btn btn-outline btn-sm" onClick={this.tentarDeNovo}>
              <Icone nome="refresh" />
              Tentar de novo
            </button>
          )}
          <button type="button" className={deCarga ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"} onClick={this.recarregar}>
            Recarregar a aplicação
          </button>
        </div>
      </div>
    );
  }
}
