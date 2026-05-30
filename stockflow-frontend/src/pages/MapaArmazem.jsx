import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import api from '../api/axios.js'
import { Download, Home, Maximize2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react'

const TILE_W = 72
const TILE_H = 36
const RACK_H = 28
const SHELF_H = 14
const TOP_H = TILE_H / 2

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const STATUS_ORDER = ['bloqueado', 'quarentena', 'vencendo', 'ativo', 'livre']
const STATUS_META = {
  ativo:      { top: getCSSVar('--color-brand-500'),   left: '#1d4ed8', right: '#1e3a8a', label: 'Ocupado ativo' },      // TODO: #1d4ed8, #1e3a8a sem token DS
  livre:      { top: '#86efac', left: getCSSVar('--color-success-600'), right: '#14532d', label: 'Posição livre' },       // TODO: #86efac, #14532d sem token DS
  vencendo:   { top: '#fcd34d', left: getCSSVar('--color-warning-600'), right: '#92400e', label: 'Vencimento próximo' },  // TODO: #fcd34d, #92400e sem token DS
  bloqueado:  { top: '#f87171', left: getCSSVar('--color-danger-600'),  right: '#7f1d1d', label: 'Bloqueado' },           // TODO: #f87171, #7f1d1d sem token DS
  quarentena: { top: '#c4b5fd', left: getCSSVar('--color-admin-600'),   right: '#4c1d95', label: 'Quarentena' },          // TODO: #c4b5fd, #4c1d95 sem token DS
  piso:       { top: '#e2e8f0', left: getCSSVar('--color-border-strong'), right: getCSSVar('--color-text-tertiary'), label: 'Piso' }, // TODO: #e2e8f0 sem token DS
}

const ZONES = [
  { id: 'CF-01', name: 'Câmara Fria 01', cols: [0, 5], rows: [0, 3], occupancy: 82 },
  { id: 'CF-02', name: 'Câmara Fria 02', cols: [0, 5], rows: [5, 8], occupancy: 65 },
  { id: 'CF-03', name: 'Câmara Fria 03', cols: [7, 12], rows: [0, 3], occupancy: 80 },
  { id: 'CF-04', name: 'Câmara Fria 04', cols: [7, 12], rows: [5, 8], occupancy: 75 },
  { id: 'ES-01', name: 'Estoque Seco 01', cols: [14, 19], rows: [0, 3], occupancy: 54 },
  { id: 'ES-02', name: 'Estoque Seco 02', cols: [14, 19], rows: [5, 8], occupancy: 60 },
]

const PRODUCT_POOL = [
  ['Pão Francês 1kg', 'AT-PAO'],
  ['Pão Integral 500g', 'AT-PIN'],
  ['Brioche Artesanal', 'AT-BRI'],
  ['Massa Folhada 2kg', 'AT-MFO'],
  ['Croissant Congelado', 'AT-CRO'],
  ['Quiche Lorraine', 'AT-QUI'],
  ['Salgado Assado', 'AT-SAL'],
  ['Baguete Rústica', 'AT-BAG'],
]

// Mock estruturalmente idêntico ao contrato de /api/v1/localizacoes e /api/v1/lotes
// Atualizar se o contrato da API mudar.
function buildMockApiPayload() {
  const localizacoes = []
  const lotes = []
  let locId = 1
  let sequence = 1

  allRackCells().forEach(({ zone, col, row }) => {
    ;[0, 1].forEach(level => {
      const aisle = String.fromCharCode(65 + (row - zone.rows[0]))
      const posicao = col - zone.cols[0] + 1
      const nivel = level === 0 ? 1 : 3
      const corredor = `${zone.id.replace('-', '')}-${aisle}`
      const localizacao = {
        id: locId,
        corredor,
        nivel,
        posicao,
        descricao: `${zone.name} · Corredor ${aisle} · Nível ${nivel} · Posição ${posicao}`,
      }
      localizacoes.push(localizacao)

      const rank = (col * 13 + row * 7 + level * 17 + zone.id.charCodeAt(4)) % 100
      let status = 'livre'
      if (rank < zone.occupancy) status = 'ativo'
      if (rank > 92) status = 'bloqueado'
      else if (rank > 86) status = 'quarentena'
      else if (rank > 78) status = 'vencendo'

      const lote = makeMockLote(localizacao, status, sequence)
      if (lote) lotes.push(lote)
      locId += 1
      sequence += 1
    })
  })

  return {
    localizacoes,
    lotes: { data: lotes, total: lotes.length, page: 1, limit: 500 },
  }
}

function isoProject(col, row, z = 0, offsetX = 0, offsetY = 0) {
  return {
    x: (col - row) * (TILE_W / 2) + offsetX,
    y: (col + row) * (TILE_H / 2) - z * SHELF_H + offsetY,
  }
}

function easeOut(t) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
}

function zoneCells(zone) {
  const cells = []
  for (let row = zone.rows[0]; row <= zone.rows[1]; row += 1) {
    for (let col = zone.cols[0]; col <= zone.cols[1]; col += 1) {
      cells.push({ col, row })
    }
  }
  return cells
}

function allRackCells() {
  return ZONES.flatMap(zone => zoneCells(zone).map(cell => ({ ...cell, zone })))
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

function diasParaVencer(dataISO) {
  if (!dataISO) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const validade = new Date(dataISO)
  if (Number.isNaN(validade.getTime())) return null
  validade.setHours(0, 0, 0, 0)
  return Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24))
}

function labelValidade(dataISO) {
  const dias = diasParaVencer(dataISO)
  if (dias === null) return null
  if (dias < 0) return { texto: `Vencido há ${Math.abs(dias)} dias`, cor: getCSSVar('--color-danger-500') }
  if (dias === 0) return { texto: 'Vence hoje', cor: getCSSVar('--color-danger-500') }
  if (dias <= 30) return { texto: `Vence em ${dias} dias`, cor: getCSSVar('--color-warning-500') }
  if (dias <= 60) return { texto: `Vence em ${dias} dias`, cor: getCSSVar('--color-warning-700') }
  return { texto: `Válido por ${dias} dias`, cor: '#639922' } // TODO: sem token verde DS
}

function normalizeStatus(lote) {
  const raw = String(lote?.status_lote || lote?.status || '').toLowerCase()
  const days = lote?.dias_para_vencer
  if (raw.includes('bloque')) return 'bloqueado'
  if (raw.includes('quar')) return 'quarentena'
  if (days != null && Number(days) >= 0 && Number(days) <= 30) return 'vencendo'
  if (raw === 'ativo' || lote?.id || lote?.numero_lote) return 'ativo'
  return 'livre'
}

function mostCritical(lotes) {
  if (!lotes?.length) return 'livre'
  return lotes
    .map(normalizeStatus)
    .sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))[0] || 'livre'
}

function normalizeZoneId(value) {
  const raw = String(value || '').toUpperCase()
  const match = raw.match(/(CF|ES)-?0?(\d{1,2})/)
  if (!match) return ''
  return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`
}

function getLocationId(lote) {
  return lote?.id_localizacao ?? lote?.localizacao_id ?? lote?.localizacao?.id ?? null
}

function normalizeLote(lote) {
  if (!lote) return null
  const quantidade = Number(lote.quantidade ?? lote.qtd_atual ?? 0)
  return {
    id: lote.id ?? lote.id_lote ?? null,
    numero_lote: lote.numero_lote || lote.codigo || '—',
    produto: lote.produto?.nome || lote.produto_nome || lote.nome_produto || '—',
    quantidade: Number.isFinite(quantidade) ? quantidade : 0,
    unidade: lote.unidade || lote.unidade_medida || lote.produto?.unidade || 'pacotes',
    data_fabricacao: lote.data_fabricacao || lote.fabricacao || null,
    data_validade: lote.data_validade || lote.validade || null,
    validade: lote.data_validade || lote.validade || null,
    rfid: lote.rfid || lote.codigo_identificacao || null,
    fornecedor: lote.fornecedor || null,
    nome_fornecedor: lote.nome_fornecedor || null,
    dias_para_vencer: lote.dias_para_vencer ?? null,
    status_lote: lote.status_lote || lote.status || null,
  }
}

function locationKeyFromLote(lote) {
  if (lote?.corredor != null && lote?.nivel != null && lote?.posicao != null) {
    return `${lote.corredor}-${lote.nivel}-${lote.posicao}`
  }
  if (lote?.id_localizacao != null) return `id:${lote.id_localizacao}`
  return lote?.localizacao_nome || lote?.localizacao || ''
}

function locationKeyFromApiLocation(loc) {
  if (loc?.corredor != null && loc?.nivel != null && loc?.posicao != null) {
    return `${loc.corredor}-${loc.nivel}-${loc.posicao}`
  }
  if (loc?.id != null) return `id:${loc.id}`
  return loc?.descricao || loc?.localizacao_nome || ''
}

function gridSlotFromLocation(loc) {
  if (!loc?.corredor) return null
  const zoneId = normalizeZoneId(loc.zona || loc.corredor || loc.area || loc.setor)
  const zone = ZONES.find(item => item.id === zoneId)
  if (!zone) return null

  const aisleMatch = String(loc.corredor || loc.codigo || loc.nome || '').match(/-([A-Z])$/i)
  const aisle = (aisleMatch?.[1] || 'A').toUpperCase().charCodeAt(0) - 65
  const pos = Math.max(0, Number(loc.posicao || 1) - 1)
  const nivel = Math.max(1, Number(loc.nivel || 1))
  return {
    zoneId,
    col: zone.cols[0] + Math.min(5, pos),
    row: zone.rows[0] + Math.min(3, aisle),
    level: nivel <= 2 ? 0 : 1,
  }
}

function makeMockLote(localizacao, status, sequence) {
  if (status === 'livre') return null
  const [produto, prefix] = PRODUCT_POOL[sequence % PRODUCT_POOL.length]
  const days = status === 'vencendo' ? (sequence % 2 ? 5 : 12) : 156 + sequence
  const validade = new Date()
  validade.setDate(validade.getDate() + days)
  const numero = `${prefix}-2026-${String(sequence).padStart(3, '0')}`
  const quantidade = 120 + ((localizacao.id * 17 + sequence * 11) % 180)
  return {
    id: sequence,
    numero_lote: numero,
    codigo: numero,
    produto_nome: produto,
    quantidade,
    id_produto: (sequence % PRODUCT_POOL.length) + 1,
    id_localizacao: localizacao.id,
    corredor: localizacao.corredor,
    nivel: localizacao.nivel,
    posicao: localizacao.posicao,
    data_validade: validade.toISOString(),
    dias_para_vencer: days,
    rfid: `AT-PLT-${prefix.replace('AT-', '')}-${String(sequence).padStart(4, '0')}`,
    codigo_identificacao: `AT-PLT-${prefix.replace('AT-', '')}-${String(sequence).padStart(4, '0')}`,
    status_lote: status,
    status,
  }
}

function buildBaseSlots() {
  return allRackCells().flatMap(({ zone, col, row }) => [0, 1].map(level => ({
      id: `${zone.id}-${col}-${row}-${level}`,
      label: `${zone.id}-${String.fromCharCode(65 + (col - zone.cols[0]))}-${row - zone.rows[0] + 1}`,
      zona: zone.id,
      codigo: `${zone.id}-${String.fromCharCode(65 + (col - zone.cols[0]))}-${row - zone.rows[0] + 1}`,
      zoneId: zone.id,
      zoneName: zone.name,
      col,
      row,
      level,
      status: 'livre',
      lote: null,
    })))
}

function buildFallbackSlots() {
  const mock = buildMockApiPayload()
  return buildSlots(mock.localizacoes, mock.lotes.data)
}

function buildSlots(localizacoes, lotes) {
  const baseSlots = buildBaseSlots()
  if (!Array.isArray(lotes) || lotes.length === 0) return baseSlots

  const locIndex = new Map((Array.isArray(localizacoes) ? localizacoes : []).map(loc => [String(loc.id), loc]))
  const lotsByKey = new Map()

  lotes.forEach(lote => {
    const locId = getLocationId(lote)
    const loc = locId != null ? locIndex.get(String(locId)) : null
    const grid = loc ? gridSlotFromLocation(loc) : gridSlotFromLocation(lote)
    const key = grid ? `${grid.zoneId}-${grid.col}-${grid.row}-${grid.level}` : (loc ? locationKeyFromApiLocation(loc) : locationKeyFromLote(lote))
    if (!key) return
    const list = lotsByKey.get(key) || []
    list.push(lote)
    lotsByKey.set(key, list)
  })

  return baseSlots.map(slot => {
    const found = lotsByKey.get(`${slot.zoneId}-${slot.col}-${slot.row}-${slot.level}`)
    if (!found) return slot
    const lote = found[0]
    return { ...slot, status: mostCritical(found), lote: normalizeLote(lote) }
  })
}

function calcOcupacaoPorZona(slots) {
  const zonas = {}
  slots.forEach(slot => {
    const nome = slot.zoneId
    if (!zonas[nome]) zonas[nome] = { total: 0, ocupados: 0 }
    zonas[nome].total += 1
    if (slot.status !== 'livre') zonas[nome].ocupados += 1
  })

  return ZONES.map(zone => {
    const z = zonas[zone.id] || { total: 0, ocupados: 0 }
    return {
      ...zone,
      nome: zone.id,
      total: z.total,
      used: z.ocupados,
      percent: z.total > 0 ? Math.round((z.ocupados / z.total) * 100) : 0,
    }
  })
}

function corBarra(pct) {
  if (pct >= 80) return 'var(--color-danger-500)'
  if (pct >= 50) return 'var(--color-warning-500)'
  return 'var(--color-success-500)'
}

function topFaceCenter(slot, progress = 1) {
  const h = (slot.level === 0 ? RACK_H : 20) * progress
  const base = isoProject(slot.col, slot.row, slot.level)
  return { x: base.x, y: base.y - h }
}

function isPointInIsoDiamond(point, center, halfW = TILE_W / 2, halfH = TILE_H / 2) {
  return Math.abs(point.x - center.x) / halfW + Math.abs(point.y - center.y) / halfH <= 1
}

function pathFace(ctx, points) {
  ctx.beginPath()
  points.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
}

function drawPolygon(ctx, points, fill, stroke = '#00000022', lineWidth = 1) {
  pathFace(ctx, points)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawLabel(ctx, text, x, y, status, scale = 1) {
  if (!text) return

  const safeScale = Math.max(scale, 0.01)
  const screenFontSize = Math.max(9, Math.round(10 * scale))
  const fontSize = screenFontSize / safeScale
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const measured = ctx.measureText(text)
  const tw = measured.width
  const th = fontSize
  const padX = 5 / safeScale
  const padY = 3 / safeScale
  const bw = tw + padX * 2
  const bh = th + padY * 2
  const rx = bh / 2

  const bgMap = {
    livre: 'rgba(255,255,255,0.82)',
    ativo: 'rgba(30, 80, 20, 0.72)',
    ocupado: 'rgba(30, 80, 20, 0.72)',
    vencendo: 'rgba(186,117,23, 0.82)',
    vencimento_proximo: 'rgba(186,117,23, 0.82)',
    bloqueado: 'rgba(163, 45, 45, 0.82)',
    quarentena: 'rgba(83, 74, 183, 0.82)',
  }
  const textMap = {
    livre: '#1a4010', // TODO: sem token verde DS
    ativo: getCSSVar('--color-text-inverse'),
    ocupado: getCSSVar('--color-text-inverse'),
    vencendo: getCSSVar('--color-text-inverse'),
    vencimento_proximo: getCSSVar('--color-text-inverse'),
    bloqueado: getCSSVar('--color-text-inverse'),
    quarentena: getCSSVar('--color-text-inverse'),
  }
  const bg = bgMap[status] || 'rgba(255,255,255,0.82)'
  const color = textMap[status] || '#1a1a1a' // TODO: #1a1a1a sem token DS

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 1

  ctx.fillStyle = bg
  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, rx)
  } else {
    const lx = x - bw / 2
    const ty = y - bh / 2
    ctx.moveTo(lx + rx, ty)
    ctx.lineTo(lx + bw - rx, ty)
    ctx.quadraticCurveTo(lx + bw, ty, lx + bw, ty + rx)
    ctx.lineTo(lx + bw, ty + bh - rx)
    ctx.quadraticCurveTo(lx + bw, ty + bh, lx + bw - rx, ty + bh)
    ctx.lineTo(lx + rx, ty + bh)
    ctx.quadraticCurveTo(lx, ty + bh, lx, ty + bh - rx)
    ctx.lineTo(lx, ty + rx)
    ctx.quadraticCurveTo(lx, ty, lx + rx, ty)
    ctx.closePath()
  }
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.fillStyle = color
  ctx.fillText(text, x, y)

  ctx.restore()
}

function topFace(slot, progress = 1) {
  const top = topFaceCenter(slot, progress)
  return [
    { x: top.x, y: top.y - TOP_H },
    { x: top.x + TILE_W / 2, y: top.y },
    { x: top.x, y: top.y + TOP_H },
    { x: top.x - TILE_W / 2, y: top.y },
  ]
}

function drawCube(ctx, slot, progress, hovered, selected, scale = 1) {
  const h = (slot.level === 0 ? RACK_H : 20) * progress
  const base = isoProject(slot.col, slot.row, slot.level)
  const top = { x: base.x, y: base.y - h }
  const topPoly = [
    { x: top.x, y: top.y - TOP_H },
    { x: top.x + TILE_W / 2, y: top.y },
    { x: top.x, y: top.y + TOP_H },
    { x: top.x - TILE_W / 2, y: top.y },
  ]
  const left = [topPoly[3], topPoly[2], { x: topPoly[2].x, y: topPoly[2].y + h }, { x: topPoly[3].x, y: topPoly[3].y + h }]
  const right = [topPoly[1], topPoly[2], { x: topPoly[2].x, y: topPoly[2].y + h }, { x: topPoly[1].x, y: topPoly[1].y + h }]
  const colors = STATUS_META[slot.status] || STATUS_META.livre

  if (selected) {
    ctx.save()
    ctx.shadowColor = 'rgba(255,255,255,0.75)'
    ctx.shadowBlur = 18
    drawPolygon(ctx, topPoly, colors.top, 'rgba(255,255,255,0.55)', 1)
    ctx.restore()
  }

  drawPolygon(ctx, right, colors.right)
  drawPolygon(ctx, left, colors.left)
  drawPolygon(ctx, topPoly, colors.top)

  ctx.beginPath()
  ctx.arc(top.x, top.y, 4, 0, Math.PI * 2)
  ctx.fillStyle = colors.top
  ctx.fill()
  ctx.strokeStyle = 'rgba(15,23,42,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()

  if (scale >= 0.55) {
    const labelText = scale < 0.8 ? String(slot.codigo || slot.label).split('-').pop() : (slot.codigo || slot.label)
    drawLabel(ctx, labelText, top.x, top.y, slot.status, scale)
  }

  if (hovered || selected) {
    pathFace(ctx, topPoly)
    ctx.strokeStyle = selected ? 'rgba(55, 138, 221, 0.9)' : '#facc15'
    ctx.lineWidth = (selected ? 2 : 2) / Math.max(scale, 0.01)
    ctx.stroke()
  }
}

function drawFloorTile(ctx, col, row, isDark) {
  const center = isoProject(col, row, 0)
  const poly = [
    { x: center.x, y: center.y - TOP_H },
    { x: center.x + TILE_W / 2, y: center.y },
    { x: center.x, y: center.y + TOP_H },
    { x: center.x - TILE_W / 2, y: center.y },
  ]
  drawPolygon(ctx, poly, isDark ? '#17233c' : STATUS_META.piso.top, isDark ? '#263653' : '#cbd5e1', 0.8)
}

function progressForSlot(slot, animationStart) {
  if (!animationStart) return 1
  const zoneIndex = ZONES.findIndex(zone => zone.id === slot.zoneId)
  const zone = ZONES[zoneIndex]
  const colOffset = slot.col - zone.cols[0]
  const rowOffset = slot.row - zone.rows[0]
  const slotDelay = zoneIndex * 150 + (rowOffset * 6 + colOffset) * 12 + slot.level * 35
  return easeOut((performance.now() - animationStart - slotDelay) / 200)
}

function progressForZone(zoneId, animationStart) {
  if (!animationStart) return 1
  const zoneIndex = ZONES.findIndex(zone => zone.id === zoneId)
  return easeOut((performance.now() - animationStart - zoneIndex * 150) / 200)
}

function PainelDetalheSlot({ slot, detalhe, loading, onFechar, onVerLote }) {
  const lote = detalhe || slot.lote
  const statusConfig = {
    ativo:              { label: 'Ocupado',             cor: '#639922',                          bg: '#EAF3DE' },                         // TODO: #639922, #EAF3DE sem token DS
    ocupado:            { label: 'Ocupado',             cor: '#639922',                          bg: '#EAF3DE' },                         // TODO: sem token DS
    vencendo:           { label: 'Vencimento próximo',  cor: '#BA7517',                          bg: '#FAEEDA' },                         // TODO: sem token DS
    vencimento_proximo: { label: 'Vencimento próximo',  cor: '#BA7517',                          bg: '#FAEEDA' },                         // TODO: sem token DS
    bloqueado:          { label: 'Bloqueado',           cor: getCSSVar('--color-danger-700'),    bg: getCSSVar('--color-danger-50') },
    quarentena:         { label: 'Quarentena',          cor: getCSSVar('--color-admin-700'),     bg: getCSSVar('--color-admin-100') },
  }
  const sc = statusConfig[slot.status] || statusConfig.ativo
  const validade = lote?.data_validade || lote?.validade
  const dias = diasParaVencer(validade)
  const numeroLote = lote?.numero_lote || lote?.codigo || '—'
  const produto = lote?.produto?.nome || lote?.nome_produto || lote?.produto || '—'
  const quantidade = lote?.quantidade != null
    ? `${Number(lote.quantidade).toLocaleString('pt-BR')} ${lote.unidade || lote.produto?.unidade || 'un'}`
    : '—'
  const campos = [
    { label: 'Número do lote', value: numeroLote, mono: true },
    { label: 'Produto', value: produto },
    { label: 'Quantidade', value: quantidade },
    { label: 'Fabricação', value: lote?.data_fabricacao ? formatDate(lote.data_fabricacao) : '—' },
    { label: 'Validade', value: validade ? formatDate(validade) : '—' },
    { label: 'RFID', value: lote?.rfid || '—', mono: true },
    { label: 'Fornecedor', value: lote?.fornecedor?.nome || lote?.nome_fornecedor || '—' },
  ]

  return (
    <section className="warehouse-panel slot-detail-panel">
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Detalhe da posição
          </span>
          <button
            onClick={onFechar}
            title="Fechar (ESC)"
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 18, padding: '2px 4px' }}
          >
            ×
          </button>
        </div>

        <div style={{ background: 'var(--color-background-secondary, var(--color-bg-subtle))', borderRadius: 'var(--border-radius-md, 8px)', padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Localização</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{slot.codigo}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Zona {slot.zona} · Nível {slot.level != null ? slot.level + 1 : '—'}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Carregando...
          </div>
        ) : lote ? (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sc.bg, color: sc.cor, fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 'var(--border-radius-md, 8px)', marginBottom: 14, alignSelf: 'flex-start' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.cor, flexShrink: 0 }} />
              {sc.label}
            </div>

            {campos.map(({ label, value, mono }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--color-border-tertiary, var(--color-border-default))' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', flexShrink: 0, paddingTop: 1 }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'right', wordBreak: 'break-word', fontFamily: mono ? 'var(--font-mono, var(--font-data))' : 'inherit' }}>
                  {String(value ?? '—')}
                </span>
              </div>
            ))}

            {dias !== null && dias <= 60 && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 'var(--border-radius-md, 8px)', background: dias < 0 ? 'var(--color-danger-50)' : dias <= 30 ? '#FAEEDA' : '#EAF3DE', color: dias < 0 ? 'var(--color-danger-700)' : dias <= 30 ? '#BA7517' : '#3B6D11', fontSize: 12, fontWeight: 500 }}>
                {dias < 0 ? `Vencido há ${Math.abs(dias)} dias` : dias === 0 ? 'Vence hoje' : `Vence em ${dias} dias`}
              </div>
            )}

            <button
              onClick={onVerLote}
              type="button"
              style={{ marginTop: 16, width: '100%', padding: '9px 0', cursor: 'pointer', background: 'var(--color-background-info, var(--color-bg-subtle))', color: 'var(--color-text-info, var(--color-text-link))', border: '0.5px solid var(--color-border-info, var(--color-border-default))', borderRadius: 'var(--border-radius-md, 8px)', fontSize: 13, fontWeight: 500 }}
            >
              Ver lote completo →
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', paddingTop: 8 }}>
            Dados do lote indisponíveis.
          </div>
        )}
      </div>
    </section>
  )
}

export default function MapaArmazem() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const rafRef = useRef(null)
  const dragRef = useRef(null)
  const animationStartRef = useRef(0)
  const hasSizedRef = useRef(false)
  const [slots, setSlots] = useState(() => buildFallbackSlots())
  const [loading, setLoading] = useState(false)
  const [lastSync, setLastSync] = useState(8)
  const [hovered, setHovered] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [detalheCompleto, setDetalheCompleto] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [camera, setCamera] = useState({ scale: 0.86, x: 450, y: 78 })
  const [dragging, setDragging] = useState(false)

  const occupied = slots.filter(slot => slot.status !== 'livre').length
  const capacity = slots.length
  const occupancy = capacity ? Math.round((occupied / capacity) * 100) : 0

  const zoneSummary = useMemo(() => calcOcupacaoPorZona(slots), [slots])

  const alerts = useMemo(() => slots
    .filter(slot => slot.status === 'bloqueado' || slot.status === 'vencendo')
    .slice(0, 3), [slots])

  const resizeCanvas = useCallback((preserveCamera = true) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    if (!preserveCamera) hasSizedRef.current = true
  }, [])

  const resetView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const left = isoProject(0, 8).x - TILE_W
    const right = isoProject(19, 0).x + TILE_W
    const top = isoProject(0, 0).y - 90
    const bottom = isoProject(19, 8).y + 70
    const scale = Math.min(1.25, Math.max(0.58, Math.min(rect.width / (right - left + 220), rect.height / (bottom - top + 160))))
    setCamera({
      scale,
      x: rect.width / 2 - ((left + right) / 2) * scale,
      y: rect.height / 2 - ((top + bottom) / 2) * scale,
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [locRes, loteRes] = await Promise.all([
        api.get('/localizacoes'),
        api.get('/lotes', { params: { limit: 500 } }),
      ])
      const localizacoes = locRes.data?.data || locRes.data || []
      const lotes = loteRes.data?.data || loteRes.data || []
      const byZone = lotes.reduce((acc, lote) => {
        const zoneId = normalizeZoneId(lote.zona || lote.corredor || lote.area || lote.setor)
        if (zoneId) acc[zoneId] = (acc[zoneId] || 0) + 1
        return acc
      }, {})
      setSlots(buildSlots(localizacoes, lotes))
      setLastSync(0)
    } catch (err) {
      console.warn('[Mapa] API falhou, usando mock:', err.message)
      setSlots(buildFallbackSlots())
      setLastSync(8)
    } finally {
      setLoading(false)
      animationStartRef.current = performance.now()
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setLastSync(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
      resizeCanvas(true)
      requestAnimationFrame(() => resizeCanvas(true))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [resizeCanvas])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && selectedSlot) {
        setSelectedSlot(null)
        setDetalheCompleto(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSlot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const resize = () => {
      const preserveCamera = hasSizedRef.current
      resizeCanvas(preserveCamera)
      if (!preserveCamera) resetView()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [resetView, resizeCanvas])

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const isDark = document.documentElement.dataset.theme === 'dark'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.fillStyle = isDark ? getCSSVar('--color-bg-canvas') : getCSSVar('--color-bg-elevated')
      ctx.fillRect(0, 0, rect.width, rect.height)

      ctx.save()
      ctx.translate(camera.x, camera.y)
      ctx.scale(camera.scale, camera.scale)

      for (let row = 0; row <= 8; row += 1) {
        for (let col = 0; col <= 19; col += 1) drawFloorTile(ctx, col, row, isDark)
      }

      ZONES.forEach(zone => {
        const zoneProgress = progressForZone(zone.id, animationStartRef.current)
        if (zoneProgress <= 0) return
        ctx.save()
        ctx.translate(0, (1 - zoneProgress) * 18)
        ctx.globalAlpha *= zoneProgress

        slots
          .filter(slot => slot.zoneId === zone.id)
          .sort((a, b) => (a.col + a.row + a.level * 0.5) - (b.col + b.row + b.level * 0.5))
          .forEach(slot => {
            const progress = progressForSlot(slot, animationStartRef.current)
            if (progress <= 0) return
            drawCube(ctx, slot, progress, hovered?.id === slot.id, selectedSlot?.id === slot.id, camera.scale)
          })

        const midCol = (zone.cols[0] + zone.cols[1]) / 2
        const topRow = zone.rows[0] - 0.45
        const point = isoProject(midCol, topRow, 2.4)
        ctx.save()
        ctx.font = '500 11px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(15,23,42,0.75)'
        ctx.shadowBlur = 6
        ctx.fillStyle = getCSSVar('--color-text-inverse')
        ctx.fillText(zone.id, point.x, point.y)
        ctx.restore()
        ctx.restore()
      })

      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [camera, hovered, selectedSlot, slots])

  const screenToWorld = useCallback((event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left - camera.x) / camera.scale,
      y: (event.clientY - rect.top - camera.y) / camera.scale,
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
    }
  }, [camera])

  const hitTest = useCallback((event) => {
    const point = screenToWorld(event)
    const ordered = slots
      .slice()
      .sort((a, b) => (b.col + b.row + b.level * 0.5) - (a.col + a.row + a.level * 0.5))
    return {
      point,
      slot: ordered.find(slot => {
        const progress = progressForSlot(slot, animationStartRef.current)
        if (progress <= 0) return false
        const zoneProgress = progressForZone(slot.zoneId, animationStartRef.current)
        const center = topFaceCenter(slot, progress)
        const screenCenter = {
          x: center.x * camera.scale + camera.x,
          y: (center.y + (1 - zoneProgress) * 18) * camera.scale + camera.y,
        }
        return isPointInIsoDiamond(
          { x: point.screenX, y: point.screenY },
          screenCenter,
          (TILE_W / 2) * camera.scale,
          (TILE_H / 2) * camera.scale
        )
      }) || null,
    }
  }, [camera, screenToWorld, slots])

  async function fetchDetalheSlot(slot) {
    if (!slot?.lote?.id && !slot?.lote?.numero_lote) {
      setDetalheCompleto(slot?.lote || null)
      return
    }

    setLoadingDetalhe(true)
    try {
      const id = slot.lote.id || slot.lote.numero_lote
      const res = await api.get(`/lotes/${id}`)
      setDetalheCompleto(res.data?.data || res.data)
    } catch (err) {
      console.warn('[Mapa] detalhe do lote não carregado, usando dados locais:', err.message)
      setDetalheCompleto(slot.lote)
    } finally {
      setLoadingDetalhe(false)
    }
  }

  function clearSelectedSlot() {
    setSelectedSlot(null)
    setDetalheCompleto(null)
  }

  function handleCanvasClick(event, wasDrag = false) {
    if (wasDrag) return
    const { slot } = hitTest(event)

    if (!slot || slot.status === 'livre') {
      clearSelectedSlot()
      return
    }

    setSelectedSlot(slot)
    setDetalheCompleto(null)
    fetchDetalheSlot(slot)
  }

  function handlePointerMove(event) {
    if (dragRef.current) {
      const dx = event.clientX - dragRef.current.x
      const dy = event.clientY - dragRef.current.y
      const moved = dragRef.current.moved || Math.abs(event.clientX - dragRef.current.startX) > 4 || Math.abs(event.clientY - dragRef.current.startY) > 4
      dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY, moved }
      setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
      return
    }
    const { slot, point } = hitTest(event)
    setHovered(slot)
    const rect = canvasRef.current?.getBoundingClientRect()
    setTooltip(slot ? { slot, x: point.screenX, y: point.screenY, canvasWidth: rect?.width || 0 } : null)
  }

  function handleWheel(event) {
    event.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    setCamera(prev => {
      const nextScale = Math.min(2.5, Math.max(0.5, prev.scale * (event.deltaY > 0 ? 0.9 : 1.1)))
      const worldX = (cursorX - prev.x) / prev.scale
      const worldY = (cursorY - prev.y) / prev.scale
      return {
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      }
    })
  }

  function setZoom(delta) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const cursorX = rect.width / 2
    const cursorY = rect.height / 2
    setCamera(prev => {
      const nextScale = Math.min(2.5, Math.max(0.5, prev.scale + delta))
      const worldX = (cursorX - prev.x) / prev.scale
      const worldY = (cursorY - prev.y) / prev.scale
      return { scale: nextScale, x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale }
    })
  }

  function toggleFullscreen() {
    if (!wrapRef.current) return
    if (document.fullscreenElement) document.exitFullscreen()
    else wrapRef.current.requestFullscreen()
  }

  return (
    <Layout breadcrumb={['Operação', 'Mapa do Armazém']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Mapa do Armazém</h1>
          <div className="subtitle">
            <span>Visualização 3D isométrica</span>
            <span className="sep" />
            <span className="live-dot" />
            <span>Sincronizado via RFID há {lastSync}s</span>
            <span className="sep" />
            <span><strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{occupied}</strong> / {capacity} posições</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      <div className="warehouse-layout">
        <div ref={wrapRef} className={`warehouse-canvas-shell ${isFullscreen ? 'is-fullscreen' : ''}`}>
          <canvas
            ref={canvasRef}
            className="warehouse-canvas"
            onPointerDown={(event) => {
              dragRef.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false }
              setDragging(true)
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerUp={(event) => {
              const wasDrag = dragRef.current?.moved
              handleCanvasClick(event, wasDrag)
              dragRef.current = null
              setDragging(false)
            }}
            onPointerCancel={() => {
              dragRef.current = null
              setDragging(false)
            }}
            onPointerLeave={() => {
              if (!dragRef.current) {
                setHovered(null)
                setTooltip(null)
              }
            }}
            onPointerMove={handlePointerMove}
            onWheel={handleWheel}
            style={{ cursor: dragging ? 'grabbing' : hovered && hovered.status !== 'livre' ? 'pointer' : 'grab' }}
          />

          <div className="canvas-toolbar" aria-label="Controles do mapa">
            <button className="icon-btn" type="button" onClick={() => setZoom(0.12)} title="Aproximar"><ZoomIn size={15} /></button>
            <button className="icon-btn" type="button" onClick={() => setZoom(-0.12)} title="Afastar"><ZoomOut size={15} /></button>
            <button className="icon-btn" type="button" onClick={resetView} title="Centralizar"><Home size={15} /></button>
            <button className="icon-btn" type="button" onClick={toggleFullscreen} title="Tela cheia"><Maximize2 size={15} /></button>
          </div>

          {tooltip && (
            <div
              className="warehouse-tooltip"
              style={{
                left: tooltip.x > tooltip.canvasWidth - 260 ? tooltip.x - 210 : tooltip.x + 14,
                top: Math.max(10, tooltip.y - 10),
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {tooltip.slot.zona}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {tooltip.slot.codigo}
                </span>
              </div>

              {tooltip.slot.lote ? (
                <>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono, var(--font-data))', color: 'var(--color-text-info, var(--color-text-link))', marginBottom: 6 }}>
                    {tooltip.slot.lote.numero_lote}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                    {tooltip.slot.lote.produto}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    {tooltip.slot.lote.quantidade.toLocaleString('pt-BR')} {tooltip.slot.lote.unidade}
                  </div>
                  {(() => {
                    const validade = labelValidade(tooltip.slot.lote.validade)
                    return validade ? (
                      <div style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: validade.cor,
                        background: `${validade.cor}18`,
                        borderRadius: 6,
                        padding: '3px 8px',
                        display: 'inline-block',
                      }}>
                        {validade.texto}
                      </div>
                    ) : null
                  })()}
                  {tooltip.slot.status === 'bloqueado' && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 500, color: 'var(--color-danger-500)', background: 'var(--color-bg-elevated-danger)', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>
                      Bloqueado
                    </div>
                  )}
                  {tooltip.slot.status === 'quarentena' && (
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 500, color: 'var(--color-admin-600)', background: '#7F77DD18', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>{/* TODO: #7F77DD18 bg sem token DS */}
                      Quarentena
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Posição livre
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="warehouse-side">
          {selectedSlot ? (
            <PainelDetalheSlot
              slot={selectedSlot}
              detalhe={detalheCompleto}
              loading={loadingDetalhe}
              onFechar={clearSelectedSlot}
              onVerLote={() => {
                const lote = detalheCompleto || selectedSlot.lote
                const query = lote?.numero_lote || lote?.id || ''
                navigate(query ? `/lotes?search=${encodeURIComponent(query)}` : '/lotes')
              }}
            />
          ) : (
            <>
              <section className="warehouse-panel">
                <h2>Resumo do Armazém</h2>
                <div className="occupancy-row">
                  <span>{occupied} / {capacity} posições</span>
                  <strong>{occupancy}%</strong>
                </div>
                <div className="progress-track"><span style={{ width: `${occupancy}%` }} /></div>
                <div className="zone-list">
                  {zoneSummary.map(zone => (
                    <div className="zone-row" key={zone.id}>
                      <span>{zone.id}</span>
                      <div className="mini-track"><span style={{ width: `${zone.percent}%`, background: corBarra(zone.percent) }} /></div>
                      <strong>{zone.percent}%</strong>
                      <em>[{zone.total} pos]</em>
                    </div>
                  ))}
                </div>
              </section>

              <section className="warehouse-panel">
                <h2>Alertas</h2>
                <div className="alert-list">
                  {alerts.map(slot => (
                    <div className="alert-row" key={slot.id}>
                      <span style={{ background: STATUS_META[slot.status].top }} />
                      <div>
                        <strong>{slot.lote?.numero_lote || slot.label}</strong>
                        <small>{slot.status === 'bloqueado' ? 'Bloqueado' : `Vence em ${slot.lote?.dias_para_vencer ?? 12} dias`}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="panel-link">Ver todos os alertas →</button>
              </section>

              <section className="warehouse-panel">
                <h2>Legenda</h2>
                <div className="legend-list">
                  {['ativo', 'livre', 'vencendo', 'bloqueado', 'quarentena'].map(status => (
                    <div key={status}><span style={{ background: STATUS_META[status].top }} />{STATUS_META[status].label}</div>
                  ))}
                </div>
              </section>
            </>
          )}
        </aside>
      </div>

      <style>{`
        .warehouse-layout {
          display: flex;
          gap: 16px;
          min-height: 640px;
          align-items: stretch;
        }

        .warehouse-canvas-shell {
          position: relative;
          flex: 1;
          min-width: 0;
          min-height: 640px;
          overflow: hidden;
          border: 1px solid var(--color-border-default);
          border-radius: 12px;
          background: var(--color-bg-elevated);
          box-shadow: var(--shadow-sm);
        }

        html[data-theme="dark"] .warehouse-canvas-shell { background: var(--color-bg-canvas); }

        .warehouse-canvas-shell.is-fullscreen {
          width: 100vw;
          height: 100vh;
          border-radius: 0;
        }

        .warehouse-canvas {
          width: 100%;
          height: 100%;
          display: block;
          touch-action: none;
        }

        .canvas-toolbar {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 6px;
          padding: 6px;
          border: 1px solid var(--color-border-default);
          border-radius: 8px;
          background: color-mix(in srgb, var(--color-bg-default) 88%, transparent);
          box-shadow: var(--shadow-md);
          backdrop-filter: blur(10px);
        }

        .warehouse-tooltip {
          position: absolute;
          z-index: 50;
          min-width: 190px;
          max-width: 240px;
          padding: 10px 14px;
          border: 0.5px solid var(--color-border-secondary, var(--color-border-default));
          border-radius: 10px;
          background: var(--color-background-primary, var(--color-bg-default));
          box-shadow: var(--shadow-md);
          color: var(--color-text-primary);
          pointer-events: none;
        }

        .tooltip-head {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .status-pill {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          box-shadow: var(--shadow-xs);
        }

        .tooltip-rule {
          height: 1px;
          margin: 9px 0;
          background: var(--color-border-default);
        }

        .warehouse-tooltip dl {
          display: grid;
          grid-template-columns: 74px 1fr;
          gap: 5px 8px;
          margin: 0;
          font-size: 11px;
        }

        .warehouse-tooltip dt {
          color: var(--color-text-tertiary);
        }

        .warehouse-tooltip dd {
          min-width: 0;
          margin: 0;
          overflow-wrap: anywhere;
          font-weight: 600;
        }

        .tooltip-link,
        .panel-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--color-text-link);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .warehouse-side {
          width: 280px;
          flex: 0 0 280px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .warehouse-panel {
          padding: 16px;
          border: 1px solid var(--color-border-default);
          border-radius: 8px;
          background: var(--color-bg-default);
          box-shadow: var(--shadow-sm);
        }

        .warehouse-panel h2 {
          margin: 0 0 14px;
          font-size: 13px;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .occupancy-row,
        .zone-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .occupancy-row strong,
        .zone-row strong {
          color: var(--color-text-primary);
          font-variant-numeric: tabular-nums;
        }

        .progress-track,
        .mini-track {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--color-bg-muted);
        }

        .progress-track {
          margin: 10px 0 16px;
        }

        .progress-track span,
        .mini-track span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--color-success-500) 0%, var(--color-warning-500) 62%, var(--color-danger-500) 100%);
        }

        .zone-list {
          display: grid;
          gap: 10px;
        }

        .zone-row {
          display: grid;
          grid-template-columns: 42px 1fr 34px 46px;
        }

        .zone-row span {
          font-family: var(--font-data);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .zone-row em {
          font-style: normal;
          color: var(--color-text-tertiary);
          font-size: 11px;
          text-align: right;
        }

        .alert-list {
          display: grid;
          gap: 10px;
          margin-bottom: 12px;
        }

        .alert-row {
          display: flex;
          gap: 9px;
          align-items: flex-start;
        }

        .alert-row > span {
          width: 10px;
          height: 10px;
          margin-top: 3px;
          border-radius: 2px;
        }

        .alert-row strong {
          display: block;
          font-family: var(--font-data);
          font-size: 11px;
          color: var(--color-text-primary);
        }

        .alert-row small {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .legend-list {
          display: grid;
          gap: 9px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .legend-list div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-list span {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          border: 1px solid var(--color-border-default);
        }

        @media (max-width: 1100px) {
          .warehouse-layout { flex-direction: column; }
          .warehouse-side {
            width: 100%;
            flex-basis: auto;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .warehouse-layout { min-height: auto; }
          .warehouse-canvas-shell { min-height: 520px; }
          .warehouse-side { grid-template-columns: 1fr; }
        }
      `}</style>
    </Layout>
  )
}
