import type { CSSProperties, RefObject } from "react";

type Variante = "marca" | "ambar" | "verde" | "ceu";

type Caixa = {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  variante: Variante;
  flutua?: number;
  fino?: boolean;
};

const VARIANTES: readonly Variante[] = ["marca", "marca", "ceu", "ambar", "marca", "verde", "ceu"];

function gerador(semente: number): () => number {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

function montarCaixas(): Caixa[] {
  const sorteio = gerador(7);
  const caixas: Caixa[] = [];
  for (let fileira = 0; fileira < 3; fileira += 1) {
    const y = 20 + fileira * 150;
    for (const z of [0, 62, 124]) caixas.push({ x: 10, y, z, w: 400, d: 62, h: 5, variante: "ceu", fino: true });
    for (const x of [10, 404]) caixas.push({ x, y, z: 0, w: 6, d: 62, h: 140, variante: "ceu", fino: true });
    for (const nivel of [0, 1, 2]) {
      for (let vaga = 0; vaga < 5; vaga += 1) {
        if (sorteio() < 0.22) continue;
        const altura = 30 + Math.floor(sorteio() * 22);
        caixas.push({
          x: 26 + vaga * 76 + Math.floor(sorteio() * 8),
          y: y + 8 + Math.floor(sorteio() * 6),
          z: nivel * 62 + 5,
          w: 56 + Math.floor(sorteio() * 8),
          d: 40 + Math.floor(sorteio() * 8),
          h: altura,
          variante: VARIANTES[Math.floor(sorteio() * VARIANTES.length)] ?? "marca",
        });
      }
    }
  }
  caixas.push({ x: 150, y: 470, z: 0, w: 150, d: 110, h: 12, variante: "ambar", fino: true });
  for (const [x, y, z] of [[160, 480, 12], [222, 480, 12], [160, 536, 12], [222, 536, 12], [190, 508, 58]] as const) {
    caixas.push({ x, y, z, w: 56, d: 46, h: 46, variante: "marca" });
  }
  const flutuantes: Caixa[] = [
    { x: 40, y: -130, z: 190, w: 64, d: 64, h: 64, variante: "marca", flutua: 0 },
    { x: 250, y: -170, z: 230, w: 52, d: 52, h: 52, variante: "ambar", flutua: 1.3 },
    { x: 440, y: 60, z: 210, w: 58, d: 58, h: 58, variante: "ceu", flutua: 2.1 },
    { x: 470, y: 280, z: 170, w: 48, d: 48, h: 48, variante: "verde", flutua: 0.7 },
    { x: -80, y: 250, z: 230, w: 60, d: 60, h: 60, variante: "marca", flutua: 1.8 },
    { x: 330, y: 560, z: 160, w: 50, d: 50, h: 50, variante: "ceu", flutua: 2.6 },
  ];
  return [...caixas, ...flutuantes];
}

const CAIXAS = montarCaixas();

const PARTICULAS = Array.from({ length: 18 }, (_, indice) => ({
  esquerda: (indice * 37 + 11) % 100,
  atraso: (indice * 0.9) % 9,
  duracao: 9 + (indice % 5) * 2.2,
  tamanho: 2 + (indice % 3),
}));

function estiloDaCaixa(caixa: Caixa): CSSProperties {
  const estilo: Record<string, string> = {
    "--x": `${caixa.x}px`,
    "--y": `${caixa.y}px`,
    "--z": `${caixa.z}px`,
    "--w": `${caixa.w}px`,
    "--d": `${caixa.d}px`,
    "--h": `${caixa.h}px`,
  };
  if (caixa.flutua !== undefined) estilo["--atraso"] = `${caixa.flutua}s`;
  return estilo as CSSProperties;
}

export function CenaDeArmazem({ palco }: { palco: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="cena" aria-hidden="true">
      <div className="cena-luz" />
      <div className="cena-grade" />
      {PARTICULAS.map((particula, indice) => (
        <span
          key={indice}
          className="cena-particula"
          style={{ left: `${particula.esquerda}%`, width: particula.tamanho, height: particula.tamanho, animationDelay: `-${particula.atraso}s`, animationDuration: `${particula.duracao}s` }}
        />
      ))}
      <div className="cena-camera">
        <div className="cena-oscila">
          <div className="cena-palco" ref={palco}>
            <div className="cena-piso" />
            {CAIXAS.map((caixa, indice) => (
              <div key={indice} className={`caixa caixa--${caixa.variante}${caixa.flutua !== undefined ? " caixa--flutua" : ""}${caixa.fino ? " caixa--fina" : ""}`} style={estiloDaCaixa(caixa)}>
                <i className="face face-topo" />
                <i className="face face-frente" />
                <i className="face face-tras" />
                <i className="face face-esq" />
                <i className="face face-dir" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
