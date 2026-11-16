import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarDetector, type Leitura } from "../src/leitor/detector.ts";
import { criarCaptura, ehCampoEditavel, normalizarCodigoLido, type EventoDeTecla } from "../src/leitor/captura.ts";
import { conectarSerial, criarMontadorDeCodigos, serialDisponivel, type PortaSerial } from "../src/leitor/serial.ts";

function gerador(semente: number): () => number {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

function digitar(detector: ReturnType<typeof criarDetector>, codigo: string, inicio: number, minimo: number, maximo: number, aleatorio: () => number): Leitura | null {
  let instante = inicio;
  for (const caractere of codigo) {
    detector.tecla(caractere, instante);
    instante += minimo + aleatorio() * (maximo - minimo);
  }
  return detector.tecla("Enter", instante);
}

describe("detector de leitor em modo teclado (Código 4, E10)", () => {
  const aleatorio = gerador(42);
  const codigos = Array.from({ length: 30 }, (_, i) => `QR-LOTE-${String(i + 1000)}-ABC`);

  it("30 leituras de leitor (5 a 20 ms entre teclas) são classificadas como leitor e chegam íntegras", () => {
    const detector = criarDetector();
    for (const codigo of codigos) {
      const leitura = digitar(detector, codigo, 1000, 5, 20, aleatorio);
      assert.equal(leitura?.codigo, codigo);
      assert.equal(leitura?.origem, "leitor");
      assert.ok((leitura?.intervaloMedioMs ?? 99) <= 20);
    }
  });

  it("30 digitações rápidas (40 a 70 ms) e 30 comuns (80 a 250 ms) chegam íntegras e são classificadas como digitação", () => {
    const detector = criarDetector();
    for (const [minimo, maximo] of [[40, 70], [80, 250]] as const) {
      for (const codigo of codigos) {
        const leitura = digitar(detector, codigo, 1000, minimo, maximo, aleatorio);
        assert.equal(leitura?.codigo, codigo);
        assert.equal(leitura?.origem, "digitacao");
      }
    }
  });

  it("o limite é a média: 30 ms ainda é leitor, 31 ms é digitação", () => {
    const detector = criarDetector();
    const exato = digitar(detector, "ABCDEF", 0, 30, 30, aleatorio);
    assert.equal(exato?.origem, "leitor");
    const acima = digitar(detector, "ABCDEF", 0, 31, 31, aleatorio);
    assert.equal(acima?.origem, "digitacao");
  });

  it("códigos com menos de 4 caracteres são ignorados e o buffer é limpo", () => {
    const detector = criarDetector();
    for (const curto of ["", "A", "AB", "ABC"]) {
      assert.equal(digitar(detector, curto, 0, 5, 5, aleatorio), null, curto);
    }
    assert.equal(detector.pendentes(), 0);
    assert.equal(digitar(detector, "ABCD", 0, 5, 5, aleatorio)?.codigo, "ABCD");
  });

  it("teclas que não são um caractere único (Shift, Tab, setas) são ignoradas e Enter reinicia", () => {
    const detector = criarDetector();
    for (const tecla of ["Shift", "Tab", "ArrowLeft", "Control", "Backspace"]) assert.equal(detector.tecla(tecla, 0), null);
    assert.equal(detector.pendentes(), 0);
    detector.tecla("A", 0);
    detector.tecla("B", 5);
    assert.equal(detector.tecla("Enter", 10), null);
    assert.equal(detector.pendentes(), 0);
  });

  it("pausa maior que a espera máxima descarta o que veio antes, sem misturar digitação solta com a leitura", () => {
    const detector = criarDetector();
    detector.tecla("x", 0);
    detector.tecla("y", 100);
    const leitura = digitar(detector, "ETIQUETA-1", 5000, 5, 10, aleatorio);
    assert.equal(leitura?.codigo, "ETIQUETA-1");
  });

  it("buffer limitado: sequência enorme não cresce sem fim", () => {
    const detector = criarDetector();
    for (let i = 0; i < 1000; i++) detector.tecla("a", i * 5);
    assert.ok(detector.pendentes() <= 256);
  });
});

function evento(chave: string, instante: number, extras: Partial<EventoDeTecla> = {}): EventoDeTecla & { evitados: number } {
  const estado = { evitados: 0 };
  const base: EventoDeTecla = {
    key: chave,
    timeStamp: instante,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: { tagName: "BODY" },
    preventDefault: () => {
      estado.evitados += 1;
    },
    ...extras,
  };
  Object.defineProperty(base, "evitados", { get: () => estado.evitados });
  return base as EventoDeTecla & { evitados: number };
}

function leitorFisico(captura: ReturnType<typeof criarCaptura>, codigo: string, inicio: number, alvo: EventoDeTecla["target"] = { tagName: "BODY" }): ReturnType<typeof evento> {
  let instante = inicio;
  for (const caractere of codigo) {
    captura.processar(evento(caractere, instante, { target: alvo }));
    instante += 8;
  }
  const fim = evento("Enter", instante, { target: alvo });
  captura.processar(fim);
  return fim;
}

describe("captura global antes do React, sem perder o primeiro caractere e sem duplicar em campos", () => {
  it("leitura feita antes de existir ouvinte é entregue completa a quem assina depois, uma única vez", () => {
    let agora = 0;
    const captura = criarCaptura({ agora: () => agora });
    leitorFisico(captura, "LOTE-0001", 100);
    agora = 1500;
    const recebidas: string[] = [];
    captura.assinar((leitura) => recebidas.push(leitura.codigo));
    assert.deepEqual(recebidas, ["LOTE-0001"]);
    const outra: string[] = [];
    captura.assinar((leitura) => outra.push(leitura.codigo));
    assert.deepEqual(outra, []);
  });

  it("leitura pendente velha demais é descartada", () => {
    let agora = 0;
    const captura = criarCaptura({ agora: () => agora, validadeDaPendenteMs: 3000 });
    leitorFisico(captura, "LOTE-0002", 100);
    agora = 3001;
    const recebidas: string[] = [];
    captura.assinar((leitura) => recebidas.push(leitura.codigo));
    assert.deepEqual(recebidas, []);
  });

  it("com o foco num campo editável a captura global não lê nem duplica", () => {
    const captura = criarCaptura();
    const recebidas: string[] = [];
    captura.assinar((leitura) => recebidas.push(leitura.codigo));
    for (const alvo of [{ tagName: "INPUT" }, { tagName: "textarea" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }]) {
      const fim = leitorFisico(captura, "CODIGO-NO-CAMPO", 0, alvo);
      assert.equal(fim.evitados, 0);
    }
    assert.deepEqual(recebidas, []);
  });

  it("caracteres digitados num campo não se misturam com a leitura seguinte fora dele", () => {
    const captura = criarCaptura();
    const recebidas: string[] = [];
    captura.assinar((leitura) => recebidas.push(leitura.codigo));
    for (const [i, c] of ["a", "b", "c"].entries()) captura.processar(evento(c, i * 5, { target: { tagName: "INPUT" } }));
    leitorFisico(captura, "XYZW-1", 100);
    assert.deepEqual(recebidas, ["XYZW-1"]);
  });

  it("só leitura de leitor chama preventDefault no Enter; digitação humana segue o comportamento normal", () => {
    const captura = criarCaptura();
    const recebidas: Leitura[] = [];
    captura.assinar((leitura) => recebidas.push(leitura));
    const fimDoLeitor = leitorFisico(captura, "LEITOR-OK", 0);
    assert.equal(fimDoLeitor.evitados, 1);
    let instante = 10_000;
    for (const c of "HUMANO-OK") {
      captura.processar(evento(c, instante));
      instante += 120;
    }
    const fimHumano = evento("Enter", instante);
    captura.processar(fimHumano);
    assert.equal(fimHumano.evitados, 0);
    assert.deepEqual(recebidas.map((r) => r.codigo), ["LEITOR-OK"]);
  });

  it("atalhos com Ctrl, Meta ou Alt, teclas repetidas e composição são ignorados", () => {
    const captura = criarCaptura();
    const recebidas: string[] = [];
    captura.assinar((leitura) => recebidas.push(leitura.codigo));
    let instante = 0;
    for (const extras of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }, { isComposing: true }]) {
      for (const c of "ABCDE") {
        captura.processar(evento(c, instante, extras));
        instante += 5;
      }
      captura.processar(evento("Enter", instante, extras));
    }
    assert.deepEqual(recebidas, []);
  });

  it("ouvinte que cancela a assinatura deixa de receber", () => {
    const captura = criarCaptura();
    const recebidas: string[] = [];
    const cancelar = captura.assinar((leitura) => recebidas.push(leitura.codigo));
    leitorFisico(captura, "ABCD-1", 0);
    cancelar();
    leitorFisico(captura, "ABCD-2", 1000);
    assert.deepEqual(recebidas, ["ABCD-1"]);
  });

  it("reconhece campos editáveis e normaliza o código lido", () => {
    assert.equal(ehCampoEditavel(null), false);
    assert.equal(ehCampoEditavel({ tagName: "BUTTON" }), false);
    assert.equal(ehCampoEditavel({ tagName: "input" }), true);
    assert.equal(normalizarCodigoLido("  QR-1  "), "QR-1");
    for (const ruim of ["", "   ", "x".repeat(129), "a\u0000b", "a\tb"]) assert.equal(normalizarCodigoLido(ruim), null, JSON.stringify(ruim));
  });
});

describe("Web Serial: disponibilidade e montagem de códigos em pedaços", () => {
  it("só com contexto seguro e navigator.serial", () => {
    const api = { requestPort: () => Promise.reject(new Error("x")) };
    assert.equal(serialDisponivel({ isSecureContext: true, navigator: { serial: api } }), true);
    assert.equal(serialDisponivel({ isSecureContext: false, navigator: { serial: api } }), false);
    assert.equal(serialDisponivel({ isSecureContext: true, navigator: {} }), false);
    assert.equal(serialDisponivel({ isSecureContext: true, navigator: { serial: null } }), false);
    assert.equal(serialDisponivel({ isSecureContext: true, navigator: { serial: "x" } }), false);
  });

  it("junta códigos que chegam em partes, com CR, LF ou CRLF", () => {
    const montador = criarMontadorDeCodigos();
    assert.deepEqual(montador.alimentar("LOTE-"), []);
    assert.deepEqual(montador.alimentar("0001\r"), ["LOTE-0001"]);
    assert.deepEqual(montador.alimentar("\nABC"), []);
    assert.deepEqual(montador.alimentar("D-2\r\nXY"), ["ABCD-2"]);
    assert.deepEqual(montador.alimentar("ZW-3\n"), ["XYZW-3"]);
  });

  it("vários códigos no mesmo pedaço, linhas vazias ignoradas e espaços aparados", () => {
    const montador = criarMontadorDeCodigos();
    assert.deepEqual(montador.alimentar("AAAA-1\r\n\r\n  BBBB-2  \nCCCC-3\n"), ["AAAA-1", "BBBB-2", "CCCC-3"]);
  });

  it("recusa código com caractere de controle e descarta linha gigante sem crescer", () => {
    const montador = criarMontadorDeCodigos(16);
    assert.deepEqual(montador.alimentar("AB\u0001CD\n"), []);
    assert.deepEqual(montador.alimentar("x".repeat(500)), []);
    assert.deepEqual(montador.alimentar("y".repeat(500) + "\n"), []);
    assert.deepEqual(montador.alimentar("OK-123\n"), ["OK-123"]);
    montador.alimentar("PARCIAL");
    montador.descartar();
    assert.deepEqual(montador.alimentar("NOVO-1\n"), ["NOVO-1"]);
  });

  it("conecta, lê pedaços da porta, emite leituras de origem serial e encerra", async () => {
    const suporte: { controle: ReadableStreamDefaultController<Uint8Array> | null } = { controle: null };
    let fechada = false;
    const fluxo = new ReadableStream<Uint8Array>({
      start(controle) {
        suporte.controle = controle;
      },
    });
    const porta: PortaSerial = {
      open: () => Promise.resolve(),
      close: () => {
        fechada = true;
        return Promise.resolve();
      },
      readable: fluxo,
    };
    const lidas: Leitura[] = [];
    const conexao = await conectarSerial(
      { isSecureContext: true, navigator: { serial: { requestPort: () => Promise.resolve(porta) } } },
      { aoLer: (leitura) => lidas.push(leitura), aoEncerrar: () => undefined },
    );
    const texto = new TextEncoder();
    suporte.controle?.enqueue(texto.encode("LOT"));
    suporte.controle?.enqueue(texto.encode("E-77\r\nOUT"));
    suporte.controle?.enqueue(texto.encode("RO-8\r\n"));
    await new Promise((resolver) => setTimeout(resolver, 30));
    assert.deepEqual(lidas.map((l) => [l.codigo, l.origem]), [["LOTE-77", "serial"], ["OUTRO-8", "serial"]]);
    await conexao.encerrar();
    assert.equal(fechada, true);
  });

  it("recusa conectar sem Web Serial ou sem contexto seguro", async () => {
    await assert.rejects(conectarSerial({ isSecureContext: false, navigator: {} }, { aoLer: () => undefined, aoEncerrar: () => undefined }), /indisponível/);
  });
});
