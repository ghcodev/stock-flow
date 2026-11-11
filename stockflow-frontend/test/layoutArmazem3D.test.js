import test from 'node:test'
import assert from 'node:assert/strict'
import { montarLayout, CELL_X, CELL_Y } from '../src/constants/layoutArmazem3D.js'

const locs = [
  { id: 1, corredor: 'ES01-A', nivel: 1, posicao: 1, tipo_zona: 'seco' },
  { id: 2, corredor: 'ES01-A', nivel: 2, posicao: 10, tipo_zona: 'seco' },
  { id: 3, corredor: 'ES01-B', nivel: 1, posicao: 2, tipo_zona: 'seco' },
  { id: 4, corredor: 'CF01-A', nivel: 1, posicao: 1, tipo_zona: 'seco' },
  { id: 5, corredor: 'Q', nivel: 1, posicao: 1, tipo_zona: 'quimico' },
]

test('cria um galpão por zona, sem sobreposição', () => {
  const { galpoes, largura, profundidade } = montarLayout(locs)
  assert.deepEqual(galpoes.map(g => g.nome), ['CF01', 'ES01', 'quimico'])
  galpoes.forEach((a, i) => galpoes.slice(i + 1).forEach(b => {
    const separadosX = Math.abs(a.x - b.x) >= (a.largura + b.largura) / 2
    const separadosZ = Math.abs(a.z - b.z) >= (a.profundidade + b.profundidade) / 2
    assert.ok(separadosX || separadosZ, `${a.nome} sobrepõe ${b.nome}`)
  }))
  galpoes.forEach(g => {
    assert.ok(g.x - g.largura / 2 >= 0 && g.x + g.largura / 2 <= largura)
    assert.ok(g.z - g.profundidade / 2 >= 0 && g.z + g.profundidade / 2 <= profundidade)
  })
})

test('posiciona por ordem numérica de posição, nível e corredor', () => {
  const { posicoes } = montarLayout(locs)
  const [p1, p2, p3] = ['1', '2', '3'].map(id => posicoes.get(id))
  assert.ok(Math.abs(p2.x - p1.x - 2 * CELL_X) < 1e-9)
  assert.ok(Math.abs(p2.y - p1.y - CELL_Y) < 1e-9)
  assert.ok(p3.z > p1.z)
  assert.equal(p1.galpao.nome, 'ES01')
})

test('lista vazia não quebra', () => {
  const vazio = montarLayout([])
  assert.equal(vazio.galpoes.length, 0)
  assert.equal(vazio.largura, 0)
  assert.equal(vazio.profundidade, 0)
})
