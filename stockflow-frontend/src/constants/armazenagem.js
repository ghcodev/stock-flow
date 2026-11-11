export const TIPOS_ARMAZENAGEM = [
  { value: 'seco', label: 'Seco' },
  { value: 'refrigerado', label: 'Refrigerado' },
  { value: 'quimico', label: 'Químico' },
]

export function rotuloArmazenagem(valor) {
  return TIPOS_ARMAZENAGEM.find(tipo => tipo.value === valor)?.label || '—'
}

export function codigoLocalizacao(loc) {
  return loc.codigo || `${loc.corredor}-N${loc.nivel}-P${loc.posicao}`
}
