export const CELL_X = 1.4
export const CELL_Y = 1.3
export const CELL_Z = 3.2
const MARGEM = 2.5
const VAO = 5

function ordenar(valores) {
  return [...new Set(valores.map(String))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
}

// "CF01-A" pertence ao galpão "CF01"; corredor sem hífen cai no galpão do tipo de zona.
function zonaDe(loc) {
  const corredor = String(loc.corredor ?? '')
  return corredor.includes('-') ? corredor.replace(/-[^-]*$/, '') : loc.tipo_zona || 'seco'
}

// Um galpão por zona: corredor vira fileira (z), posição vira coluna (x), nível vira altura (y).
export function montarLayout(localizacoes) {
  const porZona = new Map()
  for (const loc of localizacoes) {
    const nome = zonaDe(loc)
    if (!porZona.has(nome)) porZona.set(nome, [])
    porZona.get(nome).push(loc)
  }
  const zonas = ordenar([...porZona.keys()]).map(nome => {
    const locs = porZona.get(nome)
    return {
      nome,
      locs,
      corredores: ordenar(locs.map(loc => loc.corredor)),
      niveis: ordenar(locs.map(loc => loc.nivel)),
      colunas: ordenar(locs.map(loc => loc.posicao)),
    }
  })

  const porLinha = Math.ceil(Math.sqrt(zonas.length))
  const linhas = porLinha ? Math.ceil(zonas.length / porLinha) : 0
  const celulaX = Math.max(0, ...zonas.map(zona => zona.colunas.length)) * CELL_X + MARGEM * 2
  const celulaZ = Math.max(0, ...zonas.map(zona => zona.corredores.length)) * CELL_Z + MARGEM * 2
  const posicoes = new Map()

  const galpoes = zonas.map((zona, i) => {
    const largura = zona.colunas.length * CELL_X + MARGEM * 2
    const profundidade = zona.corredores.length * CELL_Z + MARGEM * 2
    const x = (i % porLinha) * (celulaX + VAO) + celulaX / 2
    const z = Math.floor(i / porLinha) * (celulaZ + VAO) + celulaZ / 2
    const x0 = x - largura / 2 + MARGEM
    const z0 = z - profundidade / 2 + MARGEM
    const galpao = {
      nome: zona.nome,
      x,
      z,
      largura,
      profundidade,
      altura: zona.niveis.length * CELL_Y + 2,
      alturaEstante: zona.niveis.length * CELL_Y,
      colunasX: Array.from({ length: zona.colunas.length + 1 }, (_, coluna) => x0 + coluna * CELL_X),
      corredoresZ: zona.corredores.map((_, corredor) => z0 + (corredor + 0.5) * CELL_Z),
      doca: { x, y: 0.5, z: z + profundidade / 2 + 1.5 },
    }
    for (const loc of zona.locs) {
      posicoes.set(String(loc.id), {
        x: x0 + (zona.colunas.indexOf(String(loc.posicao)) + 0.5) * CELL_X,
        y: zona.niveis.indexOf(String(loc.nivel)) * CELL_Y + 0.5,
        z: galpao.corredoresZ[zona.corredores.indexOf(String(loc.corredor))],
        galpao,
      })
    }
    return galpao
  })

  return {
    galpoes,
    posicoes,
    largura: porLinha ? porLinha * celulaX + (porLinha - 1) * VAO : 0,
    profundidade: linhas ? linhas * celulaZ + (linhas - 1) * VAO : 0,
  }
}
