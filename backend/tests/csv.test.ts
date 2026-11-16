import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { celulaCsv, montarCsv } from "../src/csv.ts";

describe("CSV sem biblioteca", () => {
  it("texto simples passa direto e vazio continua vazio", () => {
    assert.equal(celulaCsv("Lote 123"), "Lote 123");
    assert.equal(celulaCsv(""), "");
    assert.equal(celulaCsv("2026-12-01"), "2026-12-01");
    assert.equal(celulaCsv("10.5"), "10.5");
  });

  it("separador, aspas e quebra de linha exigem aspas, e aspas internas são duplicadas", () => {
    assert.equal(celulaCsv("a;b"), '"a;b"');
    assert.equal(celulaCsv('diz "oi"'), '"diz ""oi"""');
    assert.equal(celulaCsv("linha1\nlinha2"), '"linha1\nlinha2"');
    assert.equal(celulaCsv("linha1\r\nlinha2"), '"linha1\r\nlinha2"');
  });

  it("proteção contra fórmulas: =, +, -, @, tabulação e CR ganham apóstrofo", () => {
    assert.equal(celulaCsv("=1+1"), "'=1+1");
    assert.equal(celulaCsv("+55"), "'+55");
    assert.equal(celulaCsv("-2"), "'-2");
    assert.equal(celulaCsv("@SOMA(A1)"), "'@SOMA(A1)");
    assert.equal(celulaCsv("\tdados"), "'\tdados");
    assert.equal(celulaCsv("\rdados"), "\"'\rdados\"");
    assert.equal(celulaCsv("=a;b"), "\"'=a;b\"");
    assert.equal(celulaCsv("a=b"), "a=b");
    assert.equal(celulaCsv("'=x"), "'=x");
  });

  it("documento: BOM, cabeçalho, separador ponto e vírgula e CRLF em todas as linhas", () => {
    const csv = montarCsv(["A", "B"], [["1", "=2"], ["x;y", 'z"w']]);
    assert.equal(csv, "﻿A;B\r\n1;'=2\r\n\"x;y\";\"z\"\"w\"\r\n");
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal(csv.replaceAll("\r\n", "").includes("\n"), false);
  });

  it("sem linhas: só o cabeçalho", () => {
    assert.equal(montarCsv(["A", "B"], []), "﻿A;B\r\n");
  });
});
