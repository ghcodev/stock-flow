import { useRef, useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import {
  Package, Layers, AlertTriangle, RefreshCw, Download, ArrowDownLeft,
  ArrowUpRight, ArrowRight, Activity, Clock, TrendingDown, Lock, ShieldCheck,
  Circle, TrendingUp, Users, BarChart2, CheckCircle,
} from 'lucide-react'

const MOV_COLORS = {
  entradas: 'var(--color-success-600)',
  saidas: 'var(--color-danger-600)',
  transferencias: 'var(--color-brand-600)',
  ajustes: 'var(--color-warning-600)',
}

const CORREDORES = {
  'CF-01': 'Camara Fria 01',
  'CF-02': 'Camara Fria 02',
  'CF-03': 'Camara Fria 03',
  'CF-04': 'Camara Fria 04',
  'ES-01': 'Estoque Seco 01',
  'ES-02': 'Estoque Seco 02',
}

function smoothPath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const prevPrev = points[i - 2] || prev
    const next = points[i + 1] || curr
    const cp1x = prev.x + (curr.x - prevPrev.x) / 6
    const cp1y = prev.y + (curr.y - prevPrev.y) / 6
    const cp2x = curr.x - (next.x - prev.x) / 6
    const cp2y = curr.y - (next.y - prev.y) / 6
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`
  }
  return d
}

function cssVar(name) {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function calcPoints(data, key, w, h, pad, maxValue) {
  const max = Math.max(maxValue || 0, ...data.map(d => Number(d[key] || 0)), 1)
  if (data.length === 1) {
    return [{ x: w / 2, y: h - pad - (Number(data[0][key] || 0) / max) * (h - pad * 2) }]
  }
  return data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - (Number(d[key] || 0) / max) * (h - pad * 2),
  }))
}

function SkeletonCard({ height = 110 }) {
  return (
    <div className="card" style={{ padding: '18px 20px', minHeight: height }}>
      <div style={{ height: 11, width: 120, background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 16, animation: 'shimmer 1.2s ease-in-out infinite' }} />
      <div style={{ height: 28, width: 80, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
    </div>
  )
}

function fmtTipo(tipo) {
  const m = { entrada: 'Entrada', saida: 'Saida', transferencia: 'Transferencia', ajuste: 'Ajuste', inventario: 'Inventario' }
  return m[tipo] || tipo || '-'
}

function fmtDateLong(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

function fmtTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function trendPercent(today, yesterday) {
  const t = Number(today || 0)
  const y = Number(yesterday || 0)
  if (y === 0) return t > 0 ? 100 : 0
  return Math.round(((t - y) / y) * 100)
}

function pctColor(pct) {
  if (pct > 90) return 'var(--color-danger-600)'
  if (pct >= 70) return 'var(--color-warning-600)'
  return 'var(--color-success-600)'
}

function toneColor(tone, step = 600) {
  const map = {
    success: `var(--color-success-${step})`,
    info: `var(--color-info-${step})`,
    warning: `var(--color-warning-${step})`,
    danger: `var(--color-danger-${step})`,
    brand: `var(--color-brand-${step})`,
  }
  return map[tone] || 'var(--color-text-secondary)'
}

function MiniBadge({ children, tone = 'neutral' }) {
  const colors = {
    danger: ['var(--color-danger-50)', 'var(--color-danger-700)', 'var(--color-danger-200)'],
    warning: ['var(--color-warning-50)', 'var(--color-warning-700)', 'var(--color-warning-200)'],
    success: ['var(--color-success-50)', 'var(--color-success-700)', 'var(--color-success-200)'],
    info: ['var(--color-info-50)', 'var(--color-info-700)', 'var(--color-info-100)'],
    brand: ['var(--color-brand-100)', 'var(--color-brand-700)', 'var(--color-brand-200)'],
    neutral: ['var(--color-bg-subtle)', 'var(--color-text-secondary)', 'var(--color-border-muted)'],
  }[tone]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors[2]}`, background: colors[0], color: colors[1], borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function KpiCard({ item }) {
  const Icon = item.icon
  return (
    <div className="card" style={{ padding: '14px 16px', position: 'relative', minHeight: 100, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 14, right: 14, color: 'var(--color-bg-muted)' }}>
        <Icon size={22} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
        {item.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: item.color || 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {item.value}
          </div>
          <div style={{ fontSize: 11, color: item.trendColor || 'var(--color-text-tertiary)', marginTop: 7, fontWeight: item.trendColor ? 700 : 500 }}>
            {item.trend}
          </div>
        </div>
      </div>
      {item.detail && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: item.detailColor || 'var(--color-text-tertiary)', fontWeight: item.detailColor ? 700 : 500 }}>
          {item.pulse && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-danger-500)', animation: 'pulseDot 1s ease-in-out infinite' }} />}
          {item.detail}
        </div>
      )}
      {item.secondary && <div style={{ marginTop: 4, fontSize: 11, color: item.secondaryColor || 'var(--color-text-tertiary)', fontWeight: 700 }}>{item.secondary}</div>}
    </div>
  )
}

function TrendBadge({ direction, pct }) {
  if (direction === 'stable') return <MiniBadge>estavel</MiniBadge>
  const up = direction === 'up'
  return <MiniBadge tone={up ? 'success' : 'danger'}>{up ? '↑' : '↓'} {up ? '+' : ''}{Number(pct || 0).toFixed(1)}%</MiniBadge>
}

function MiniMetric({ label, value, children }) {
  return (
    <div className="card" style={{ padding: '16px 18px', minHeight: 112, position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

function GaugeSVG({ score, cor }) {
  const r = 54
  const cx = 70
  const cy = 70
  const circum = Math.PI * r
  const filled = (Number(score || 0) / 100) * circum
  const colorMap = {
    success: 'var(--color-success-600)',
    info: 'var(--color-info-600)',
    warning: 'var(--color-warning-500)',
    danger: 'var(--color-danger-600)',
  }
  const stroke = colorMap[cor] || 'var(--color-text-tertiary)'

  return (
    <svg width="140" height="80" viewBox="0 0 140 80" aria-hidden="true">
      <path
        d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
        fill="none"
        stroke="var(--color-border-default)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circum}`}
      />
    </svg>
  )
}

function SaudeOperacional({ kpis }) {
  const saude = kpis?.saude_operacional || {}
  const tone = saude.cor || 'info'
  const scoreColor = toneColor(tone, 600)
  const fatores = saude.fatores || {}
  const rows = [
    [AlertTriangle, 'Rupturas', fatores.rupturas ?? kpis?.lotes_abaixo_minimo ?? 0],
    [Clock, 'Vencimentos', fatores.vencimentos ?? kpis?.vencem_semana ?? 0],
    [Lock, 'Bloqueios', fatores.bloqueios ?? kpis?.lotes_bloqueados ?? 0],
    [TrendingUp, 'Giro', fatores.giro ?? kpis?.movimentacoes_hoje ?? 0],
  ]

  return (
    <div className="card" style={{ padding: '18px 20px', minHeight: 252 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>SAUDE OPERACIONAL</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -4, marginBottom: 2 }}>
        <GaugeSVG score={saude.score} cor={tone} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: scoreColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{Number(saude.score || 0)}</div>
        <div style={{ fontSize: 18, color: 'var(--color-text-tertiary)', fontWeight: 700, paddingBottom: 6 }}>/100</div>
      </div>
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <MiniBadge tone={tone}>{saude.label || 'SEM DADOS'}</MiniBadge>
      </div>
      <div style={{ height: 1, background: 'var(--color-border-muted)', margin: '16px 0 10px' }} />
      <div style={{ display: 'grid', gap: 9 }}>
        {rows.map(([Icon, label, value]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Icon size={14} color="var(--color-text-tertiary)" />
            <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>{label}</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Number(value || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AreaMovementChart({ data, period, onPeriodChange, tooltip, setTooltip }) {
  const w = 600
  const h = 200
  const pad = 40
  const current = period === 30 ? data.slice(-30) : data.slice(-60)
  const previous = period === 30 ? data.slice(-60, -30) : []
  const max = Math.max(
    ...current.flatMap(d => [d.entradas, d.saidas]),
    ...previous.flatMap(d => [d.entradas, d.saidas]),
    1
  )
  const entradaPoints = calcPoints(current, 'entradas', w, h, pad, max)
  const saidaPoints = calcPoints(current, 'saidas', w, h, pad, max)
  const prevEntradaPoints = calcPoints(previous, 'entradas', w, h, pad, max)
  const prevSaidaPoints = calcPoints(previous, 'saidas', w, h, pad, max)
  const entradaPath = smoothPath(entradaPoints)
  const saidaPath = smoothPath(saidaPoints)
  const entradaArea = entradaPoints.length ? `${entradaPath} L ${entradaPoints.at(-1).x},${h - pad} L ${entradaPoints[0].x},${h - pad} Z` : ''
  const saidaArea = saidaPoints.length ? `${saidaPath} L ${saidaPoints.at(-1).x},${h - pad} L ${saidaPoints[0].x},${h - pad} Z` : ''
  const success500 = cssVar('--color-success-500')
  const danger500 = cssVar('--color-danger-500')

  function handleMouseMove(e) {
    if (!current.length) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const chartW = rect.width - pad * 2
    const idx = Math.max(0, Math.min(
      current.length - 1,
      Math.round(((mouseX - pad) / chartW) * (current.length - 1))
    ))
    setTooltip({
      idx,
      x: Math.max(pad, Math.min(rect.width - pad, mouseX)),
      item: current[idx],
    })
  }

  function handleMouseLeave() {
    setTooltip(null)
  }

  function tooltipViewBoxX() {
    if (!tooltip) return null
    return (tooltip.x / 600) * w
  }

  const yGuides = [0, 1, 2].map(i => {
    const y = pad + i * ((h - pad * 2) / 2)
    const value = Math.round(max - i * (max / 2))
    return { y, value }
  })

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div className="card-header">
        <span className="card-title">Movimentacoes por Dia</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[30, 60].map(days => (
            <button key={days} type="button" className={`btn btn-sm ${period === days ? 'btn-primary' : 'btn-outline'}`} style={{ height: 30 }} onClick={() => onPeriodChange(days)}>
              {days}d
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 20px 14px' }}>
        {current.length === 0 ? (
          <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sem movimentacoes no periodo</div>
        ) : (
          <>
            <div style={{ height: 240, position: 'relative' }}>
              <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <defs>
                  <linearGradient id="entradasGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={success500} stopOpacity="0.3" />
                    <stop offset="1" stopColor={success500} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="saidasGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={danger500} stopOpacity="0.3" />
                    <stop offset="1" stopColor={danger500} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {yGuides.map(guide => (
                  <line key={guide.y} x1={pad} x2={w - pad} y1={guide.y} y2={guide.y} stroke="var(--color-border-muted)" strokeWidth="1" />
                ))}
                {yGuides.map(guide => (
                  <text key={guide.value} x="4" y={guide.y + 4} fill="var(--color-text-tertiary)" fontSize="10">{guide.value}</text>
                ))}
                <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--color-border-default)" strokeWidth="1" />
                {current.map((point, index) => index % 5 === 0 ? (
                  <text key={point.dia} x={entradaPoints[index]?.x || pad} y={h - 8} fill="var(--color-text-tertiary)" fontSize="10" textAnchor="middle">{point.dia}</text>
                ) : null)}
                {tooltip && (
                  <line
                    x1={tooltipViewBoxX()}
                    y1={8}
                    x2={tooltipViewBoxX()}
                    y2={192}
                    stroke="var(--color-border-strong)"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />
                )}
                <path d={entradaArea} fill="url(#entradasGradient)" style={{ animation: 'fadeArea 0.8s var(--ease-default) 0.4s forwards', opacity: 0 }} />
                <path d={saidaArea} fill="url(#saidasGradient)" style={{ animation: 'fadeArea 0.8s var(--ease-default) 0.4s forwards', opacity: 0 }} />
                {prevEntradaPoints.length > 1 && <path d={smoothPath(prevEntradaPoints)} fill="none" stroke="var(--color-success-600)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />}
                {prevSaidaPoints.length > 1 && <path d={smoothPath(prevSaidaPoints)} fill="none" stroke="var(--color-danger-600)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />}
                <path d={entradaPath} fill="none" stroke="var(--color-success-600)" strokeWidth="2" style={{ animation: 'drawLine 1.2s var(--ease-default) forwards' }} />
                <path d={saidaPath} fill="none" stroke="var(--color-danger-600)" strokeWidth="2" style={{ animation: 'drawLine 1.2s var(--ease-default) forwards' }} />
                {tooltip && entradaPoints[tooltip.idx] && (
                  <circle
                    cx={entradaPoints[tooltip.idx].x}
                    cy={entradaPoints[tooltip.idx].y}
                    r="4"
                    fill="var(--color-success-600)"
                    stroke="var(--color-bg-default)"
                    strokeWidth="2"
                    pointerEvents="none"
                  />
                )}
                {tooltip && saidaPoints[tooltip.idx] && (
                  <circle
                    cx={saidaPoints[tooltip.idx].x}
                    cy={saidaPoints[tooltip.idx].y}
                    r="4"
                    fill="var(--color-danger-600)"
                    stroke="var(--color-bg-default)"
                    strokeWidth="2"
                    pointerEvents="none"
                  />
                )}
              </svg>
              {tooltip && (
                <div style={{ position: 'absolute', left: Math.min(tooltip.x + 12, 520), top: 40, background: 'var(--color-bg-default)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-md)', pointerEvents: 'none', zIndex: 10, minWidth: 140 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-text-primary)' }}>{tooltip.item?.dataLonga}</div>
                  <div style={{ color: 'var(--color-success-600)' }}>Entradas: {tooltip.item?.entradas}</div>
                  <div style={{ color: 'var(--color-danger-600)' }}>Saidas: {tooltip.item?.saidas}</div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Transferencias: {tooltip.item?.transferencias}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Circle size={8} fill="var(--color-success-600)" color="var(--color-success-600)" />Entradas</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Circle size={8} fill="var(--color-danger-600)" color="var(--color-danger-600)" />Saidas</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Circle size={8} fill="var(--color-text-tertiary)" color="var(--color-text-tertiary)" />Periodo anterior</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SmartAlerts({ alertas, rupturas }) {
  const rupturaItems = (rupturas || [])
    .filter(item => Number(item.dias_para_ruptura || 0) <= 7)
    .map(item => ({
      key: `ruptura-${item.nome_produto}`,
      icon: AlertTriangle,
      color: 'var(--color-danger-600)',
      text: `${item.nome_produto} ficara indisponivel em ${Math.ceil(Number(item.dias_para_ruptura || 0))} dias`,
    }))
  const alertaItems = (alertas || []).map((item, index) => {
    if (item.tipo_alerta === 'abaixo_minimo' || item.tipo === 'estoque') {
      return { key: `estoque-${index}`, icon: TrendingDown, color: 'var(--color-warning-600)', text: `${item.produto} esta abaixo do estoque minimo` }
    }
    if (item.tipo_alerta === 'vencendo' || ['urgente', 'atencao', 'vencimento'].includes(item.tipo)) {
      return { key: `vence-${index}`, icon: Clock, color: 'var(--color-warning-600)', text: `Lote ${item.numero_lote || item.lote || '-'} vence em ${Number(item.dias_para_vencer ?? item.dias ?? 0)} dias` }
    }
    return { key: `alerta-${index}`, icon: Lock, color: 'var(--color-text-tertiary)', text: `${item.produto || item.lote || 'Item'} requer atencao` }
  })
  const items = [...rupturaItems, ...alertaItems].slice(0, 8)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Alertas Inteligentes</span>
        <MiniBadge tone={items.length ? 'warning' : 'success'}>{items.length}</MiniBadge>
      </div>
      <div style={{ padding: '4px 20px 14px' }}>
        {items.length === 0 ? (
          <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhum alerta critico agora.</div>
        ) : (
          <>
            {items.map(item => {
              const Icon = item.icon
              return (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-border-muted)' }}>
                  <Icon size={15} color={item.color} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>{item.text}</span>
                </div>
              )
            })}
            <a href="/alertas" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 700 }}>Ver todos os alertas <ArrowRight size={12} /></a>
          </>
        )}
      </div>
    </div>
  )
}

function TopOperadoresCard({ operadores }) {
  const rows = operadores || []
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Users size={15} /> TOP OPERADORES HOJE</span>
      </div>
      <div style={{ padding: '12px 20px 18px' }}>
        {rows.length === 0 ? (
          <div style={{ height: 160, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, textAlign: 'center' }}>Nenhuma movimentacao hoje</div>
        ) : rows.slice(0, 3).map((op, index) => (
          <div key={`${op.nome}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: index < Math.min(rows.length, 3) - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: index === 0 ? 'var(--color-brand-100)' : 'var(--color-bg-subtle)', color: index === 0 ? 'var(--color-brand-700)' : 'var(--color-text-secondary)', fontWeight: 800, fontSize: 12 }}>{index + 1}</div>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.nome}</div>
            <MiniBadge tone={index === 0 ? 'brand' : 'neutral'}>{Number(op.total_movimentacoes || 0)}</MiniBadge>
          </div>
        ))}
      </div>
    </div>
  )
}

function RupturaCard({ rupturas }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={15} /> PREVISAO DE RUPTURA</span>
      </div>
      <div style={{ padding: '12px 20px 18px' }}>
        {(rupturas || []).length === 0 ? (
          <div style={{ height: 160, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CheckCircle size={16} color="var(--color-success-600)" /> Nenhum produto em risco</span>
          </div>
        ) : rupturas.map(item => {
          const dias = Number(item.dias_para_ruptura || 0)
          const color = dias <= 7 ? 'var(--color-danger-600)' : dias <= 15 ? 'var(--color-warning-600)' : 'var(--color-text-secondary)'
          return (
            <div key={item.nome_produto} style={{ marginBottom: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome_produto}</div>
                <div style={{ fontSize: 12, color, fontWeight: 800, flexShrink: 0 }}>Ruptura em {Math.ceil(dias)} dias</div>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg-muted)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(4, Math.min(100, ((30 - dias) / 30) * 100))}%`, height: '100%', borderRadius: 999, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CurvaAbcCard({ curvaAbc }) {
  const resumo = curvaAbc?.resumo
  const rows = resumo ? [
    ['CLASSE A', resumo.classe_a, 'brand'],
    ['CLASSE B', resumo.classe_b, 'warning'],
    ['CLASSE C', resumo.classe_c, 'neutral'],
  ] : []
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BarChart2 size={15} /> CURVA ABC - 90 dias</span>
      </div>
      <div style={{ padding: '14px 20px 18px' }}>
        {!resumo ? (
          <div style={{ height: 160, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sem dados ABC</div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              {rows.map(([label, item, tone]) => {
                const pct = Number(item?.pct_movimentacoes || 0)
                const fill = tone === 'brand' ? 'var(--color-brand-600)' : tone === 'warning' ? 'var(--color-warning-500)' : 'var(--color-text-tertiary)'
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                      <MiniBadge tone={tone}>{label}</MiniBadge>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{Number(item?.qtd_produtos || 0)} produtos</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: 'var(--color-bg-muted)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 999, background: fill, opacity: tone === 'neutral' ? 0.4 : 1 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{pct.toFixed(1)}% das movimentacoes</div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-text-secondary)' }}>Top produto: {curvaAbc?.top10?.[0]?.nome_produto || '-'}</div>
          </>
        )}
      </div>
    </div>
  )
}

function Gauge({ value }) {
  const clamped = Math.max(0, Math.min(180, Number(value || 0)))
  const dash = 188
  const offset = dash - (dash * Math.min(clamped, 120)) / 120
  const color = value < 30 ? 'var(--color-danger-600)' : value <= 90 ? 'var(--color-warning-600)' : 'var(--color-success-600)'
  return (
    <div style={{ position: 'relative', width: 210, height: 118, margin: '0 auto' }}>
      <svg viewBox="0 0 220 120" width="210" height="118">
        <path d="M30 100 A80 80 0 0 1 190 100" fill="none" stroke="var(--color-bg-muted)" strokeWidth="14" strokeLinecap="round" />
        <path d="M30 100 A80 80 0 0 1 190 100" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={offset} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{Math.round(Number(value || 0))} dias</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>validade media</div>
      </div>
    </div>
  )
}

function DonutChart({ data, total }) {
  const size = 190
  const radius = 62
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div style={{ position: 'relative', height: 218, display: 'grid', placeItems: 'center' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="190" height="190">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-bg-muted)" strokeWidth="22" />
        {data.map(item => {
          const length = total ? (item.value / total) * circumference : 0
          const dash = `${length} ${circumference - length}`
          const dashOffset = -offset
          offset += length
          return (
            <circle
              key={item.name}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="22"
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
        })}
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{total}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>movimentacoes</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [kpis, setKpis] = useState(null)
  const [movData, setMovData] = useState([])
  const [alertasBase, setAlertasBase] = useState({ total: 0, alertas: [] })
  const [alertasPendentes, setAlertasPendentes] = useState({ total: 0, itens: [] })
  const [ocupacao, setOcupacao] = useState({ total_posicoes: 0, ocupadas: 0, percentual: 0, corredores: [] })
  const [topProdutos, setTopProdutos] = useState([])
  const [operadores, setOperadores] = useState([])
  const [saudeEstoque, setSaudeEstoque] = useState(null)
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePie, setActivePie] = useState(null)
  const [alertTab, setAlertTab] = useState('todos')
  const [topPeriodo, setTopPeriodo] = useState('mes')
  const [rupturas, setRupturas] = useState([])
  const [curvaAbc, setCurvaAbc] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [chartPeriod, setChartPeriod] = useState(30)
  const scrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  async function safeGet(request, fallback) {
    try {
      const response = await request()
      return response.data ?? fallback
    } catch (err) {
      console.error(err)
      return fallback
    }
  }

  async function load() {
    setLoading(true)
    try {
      const [kpisData, movRows, alertasData, alertasPendData, ocupacaoData, topProdData, operadoresData, saudeData, recentesData, rupturasData, abcData] = await Promise.all([
        safeGet(() => api.get('/dashboard/kpis'), null),
        safeGet(() => api.get('/dashboard/movimentacoes'), []),
        safeGet(() => api.get('/dashboard/alertas'), { total: 0, alertas: [] }),
        safeGet(() => api.get('/dashboard/alertas-pendentes'), { total: 0, itens: [] }),
        safeGet(() => api.get('/dashboard/ocupacao-corredores'), { total_posicoes: 0, ocupadas: 0, percentual: 0, corredores: [] }),
        safeGet(() => api.get('/dashboard/top-produtos', { params: { periodo: topPeriodo === 'semana' ? 'semana' : 'mes' } }), []),
        safeGet(() => api.get('/dashboard/operadores-hoje'), []),
        safeGet(() => api.get('/dashboard/saude-estoque'), null),
        safeGet(() => api.get('/movimentacoes', { params: { limit: 8, order: 'desc' } }), { data: [] }),
        safeGet(() => api.get('/dashboard/rupturas'), []),
        safeGet(() => api.get('/dashboard/curva-abc'), null),
      ])
      setKpis(kpisData)
      setMovData((movRows || []).map(d => ({
        dataLonga: fmtDateLong(d.dia),
        dia: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        entradas: Number(d.entradas || 0),
        saidas: Number(d.saidas || 0),
        transferencias: Number(d.transferencias || 0),
        ajustes: Number(d.ajustes || 0),
      })))
      setAlertasBase(alertasData || { total: 0, alertas: [] })
      setAlertasPendentes(alertasPendData || { total: 0, itens: [] })
      setOcupacao(ocupacaoData || { total_posicoes: 0, ocupadas: 0, percentual: 0, corredores: [] })
      setTopProdutos(topProdData || [])
      setOperadores(operadoresData || [])
      setSaudeEstoque(saudeData || null)
      setRecentes(recentesData?.data || [])
      setRupturas(rupturasData || [])
      setCurvaAbc(abcData || null)
      if (!kpisData) toast.error('Erro ao carregar KPIs do dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [topPeriodo])

  function onDragStart(e) {
    if (!scrollRef.current) return
    setIsDragging(true)
    setStartX(e.clientX)
    setScrollLeft(scrollRef.current.scrollLeft)
  }

  function onDragMove(e) {
    if (!isDragging || !scrollRef.current) return
    scrollRef.current.scrollLeft = scrollLeft - (e.clientX - startX)
  }

  const movTrend = kpis ? trendPercent(kpis.movimentacoes_hoje, kpis.movimentacoes_ontem) : 0
  const kpiItems = kpis ? [
    {
      label: 'Movimentacoes Hoje',
      value: kpis.movimentacoes_hoje ?? '-',
      icon: Activity,
      trend: `${movTrend >= 0 ? '↑' : '↓'} ${Math.abs(movTrend)}% vs ontem`,
      trendColor: movTrend >= 0 ? 'var(--color-success-600)' : 'var(--color-danger-600)',
    },
    {
      label: 'Total Produtos',
      value: kpis.total_produtos ?? '-',
      icon: Package,
      trend: `${Number(kpis.lotes_abaixo_minimo || 0)} abaixo do minimo`,
      trendColor: Number(kpis.lotes_abaixo_minimo || 0) > 0 ? 'var(--color-danger-600)' : 'var(--color-text-tertiary)',
      detail: Number(kpis.lotes_abaixo_minimo || 0) > 0 ? 'Requer reposicao de estoque' : 'Estoque dentro dos limites',
      detailColor: Number(kpis.lotes_abaixo_minimo || 0) > 0 ? 'var(--color-danger-600)' : 'var(--color-success-600)',
      pulse: Number(kpis.lotes_abaixo_minimo || 0) > 0,
    },
    {
      label: 'Lotes Vencendo',
      value: kpis.lotes_vencendo ?? '-',
      icon: Layers,
      color: 'var(--color-warning-600)',
      trend: `${Number(kpis.vencem_semana || 0)} vencem esta semana`,
      trendColor: 'var(--color-danger-600)',
      secondary: `${Number(kpis.vencem_mes || 0)} vencem este mes`,
      secondaryColor: 'var(--color-warning-600)',
    },
    {
      label: 'Lotes Bloqueados',
      value: kpis.lotes_bloqueados ?? '-',
      icon: AlertTriangle,
      color: 'var(--color-danger-600)',
      trend: kpis.ultimo_bloqueio_dias != null ? `Ultimo bloqueio: ha ${Number(kpis.ultimo_bloqueio_dias)} dias` : 'Sem bloqueios recentes',
    },
  ] : []

  const pieData = [
    { name: 'Entradas', value: movData.reduce((acc, d) => acc + d.entradas, 0), color: MOV_COLORS.entradas },
    { name: 'Saidas', value: movData.reduce((acc, d) => acc + d.saidas, 0), color: MOV_COLORS.saidas },
    { name: 'Transferencias', value: movData.reduce((acc, d) => acc + d.transferencias, 0), color: MOV_COLORS.transferencias },
    { name: 'Ajustes', value: movData.reduce((acc, d) => acc + d.ajustes, 0), color: MOV_COLORS.ajustes },
  ].filter(d => d.value > 0)
  const pieTotal = pieData.reduce((acc, d) => acc + d.value, 0)

  const filteredAlertas = (alertasPendentes.itens || []).filter(item => {
    if (alertTab === 'todos') return true
    if (alertTab === 'vencimento') return ['urgente', 'atencao', 'vencimento'].includes(item.tipo)
    if (alertTab === 'estoque') return item.tipo === 'estoque'
    return item.tipo === 'bloqueado'
  })

  const corredores = Object.entries(CORREDORES).map(([zona, nome]) => {
    const found = (ocupacao.corredores || []).find(item => item.zona === zona)
    return {
      zona,
      nome,
      total_posicoes: Number(found?.total_posicoes || 0),
      ocupadas: Number(found?.ocupadas || 0),
      percentual: Number(found?.percentual || 0),
    }
  })
  const maxTop = Math.max(...topProdutos.map(p => Number(p.total_movimentado || 0)), 1)
  const allSmartAlerts = [...(alertasBase.alertas || []), ...(alertasPendentes.itens || [])]

  return (
    <Layout breadcrumb={['Dashboard']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span>StockFlow - Unidade Central</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      <div className="dashboard-health-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginBottom: 24 }}>
        {loading ? (
          <>
            <SkeletonCard height={252} />
            <SkeletonCard height={252} />
          </>
        ) : (
          <>
            <SaudeOperacional kpis={kpis} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
              <MiniMetric
                label="ENTRADAS HOJE"
                value={Number(kpis?.tendencias?.entradas_hoje || 0)}
              >
                <TrendBadge direction={kpis?.tendencias?.direcao_entradas} pct={kpis?.tendencias?.entradas_pct} />
              </MiniMetric>
              <MiniMetric
                label="SAIDAS HOJE"
                value={Number(kpis?.tendencias?.saidas_hoje || 0)}
              >
                <TrendBadge direction={kpis?.tendencias?.direcao_saidas} pct={kpis?.tendencias?.saidas_pct} />
              </MiniMetric>
              <MiniMetric
                label="CAPITAL EM ESTOQUE"
                value={money(kpis?.capital?.capital_imobilizado)}
              >
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Capital parado: {money(kpis?.capital?.capital_parado)}</div>
              </MiniMetric>
              <MiniMetric
                label="MOVIMENTACOES HOJE"
                value={Number(kpis?.movimentacoes_hoje || 0)}
              >
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Ontem: {Number(kpis?.movimentacoes_ontem || 0)}</div>
              </MiniMetric>
            </div>
          </>
        )}
      </div>

      <div style={{
        display: 'flex',
        gap: 24,
        padding: '10px 16px',
        background: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border-muted)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 16,
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        flexWrap: 'wrap',
      }}>
        <span>
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {kpis?.capital?.capital_imobilizado
              ? `R$ ${Number(kpis.capital.capital_imobilizado).toLocaleString('pt-BR')}`
              : '-'}
          </strong>
          {' '}em estoque
        </span>
        <span style={{ color: 'var(--color-border-strong)' }}>|</span>
        <span>
          Cobertura media:{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {rupturas.length > 0
              ? `${Math.round(rupturas.reduce((a, r) => a + r.dias_para_ruptura, 0) / rupturas.length)} dias`
              : '-'}
          </strong>
        </span>
        <span style={{ color: 'var(--color-border-strong)' }}>|</span>
        <span>
          Produtos em risco:{' '}
          <strong style={{ color: rupturas.length > 0 ? 'var(--color-danger-600)' : 'var(--color-success-600)' }}>
            {rupturas.length}
          </strong>
        </span>
        <span style={{ color: 'var(--color-border-strong)' }}>|</span>
        <span>
          Lotes ativos:{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {kpis?.total_lotes_ativos ?? '-'}
          </strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) : kpiItems.map(item => <KpiCard key={item.label} item={item} />)}
      </div>

      <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: 16, marginBottom: 24 }}>
        {loading ? <SkeletonCard height={330} /> : <AreaMovementChart data={movData} period={chartPeriod} onPeriodChange={setChartPeriod} tooltip={tooltip} setTooltip={setTooltip} />}
        {loading ? <SkeletonCard height={330} /> : <SmartAlerts alertas={allSmartAlerts} rupturas={rupturas} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} height={240} />)
        ) : (
          <>
            <TopOperadoresCard operadores={kpis?.top_operadores || []} />
            <RupturaCard rupturas={rupturas} />
            <CurvaAbcCard curvaAbc={curvaAbc} />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Distribuicao por Tipo</span>
          </div>
          <div style={{ padding: '8px 20px 18px' }}>
            {loading ? (
              <div style={{ height: 240, background: 'var(--color-bg-subtle)', borderRadius: 8, animation: 'shimmer 1.2s ease-in-out infinite' }} />
            ) : pieTotal === 0 ? (
              <div style={{ height: 240, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sem movimentacoes no periodo</div>
            ) : (
              <>
                <div onMouseLeave={() => setActivePie(null)}>
                  <DonutChart data={pieData} total={pieTotal} />
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 2 }}>
                  {pieData.map((item, index) => {
                    const pct = pieTotal ? Math.round((item.value / pieTotal) * 100) : 0
                    return (
                      <div key={item.name} onMouseEnter={() => setActivePie(index)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, opacity: activePie == null || activePie === index ? 1 : 0.45 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--color-text-secondary)' }}>
                          <Circle size={8} fill={item.color} color={item.color} />{item.name}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{pct}% <span style={{ fontWeight: 500, color: 'var(--color-text-tertiary)' }}>({item.value} un)</span></span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertas Pendentes</span>
            <MiniBadge tone="danger">{alertasPendentes.total || alertasBase.total || 0}</MiniBadge>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                ['todos', 'Todos'],
                ['vencimento', 'Vencimento'],
                ['estoque', 'Estoque'],
                ['bloqueados', 'Bloqueados'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setAlertTab(id)} className={`btn btn-sm ${alertTab === id ? 'btn-primary' : 'btn-outline'}`} style={{ height: 30 }}>
                  {label}
                </button>
              ))}
            </div>
            {loading ? (
              <SkeletonCard height={260} />
            ) : filteredAlertas.length === 0 ? (
              <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhum alerta pendente.</div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {filteredAlertas.map((item, index) => {
                  const isEstoque = item.tipo === 'estoque'
                  const isBloqueado = item.tipo === 'bloqueado'
                  const Icon = isEstoque ? TrendingDown : isBloqueado ? Lock : Clock
                  const color = isEstoque ? 'var(--color-warning-600)' : isBloqueado ? 'var(--color-text-tertiary)' : 'var(--color-warning-600)'
                  const title = isEstoque ? item.produto : `${item.lote} - ${item.produto}`
                  const subtitle = isEstoque
                    ? `Estoque: ${Number(item.quantidade || 0)} / Min: ${Number(item.estoque_minimo || 0)}`
                    : isBloqueado
                      ? `Bloqueado ha ${Number(item.dias_bloqueado || 0)} dias`
                      : `Vence em ${Number(item.dias || 0)} dias - Qtd: ${Number(item.quantidade || 0)} un`
                  return (
                    <div key={`${item.lote}-${item.tipo}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${color}`, background: 'var(--color-bg-subtle)', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                      <Icon size={14} color={color} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                        <div style={{ fontSize: 11, color, marginTop: 2 }}>{subtitle}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <a href="/alertas" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 700 }}>Ver todos os alertas <ArrowRight size={12} /></a>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ocupacao do Armazem</span>
            <MiniBadge tone={ocupacao.percentual > 90 ? 'danger' : ocupacao.percentual >= 70 ? 'warning' : 'success'}>{Number(ocupacao.percentual || 0)}% ocupado</MiniBadge>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? (
              <SkeletonCard height={280} />
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 7 }}>
                    <span>Ocupacao geral</span>
                    <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{Number(ocupacao.ocupadas || 0)} de {Number(ocupacao.total_posicoes || 0)} posicoes ocupadas</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--color-bg-muted)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Number(ocupacao.percentual || 0))}%`, background: pctColor(Number(ocupacao.percentual || 0)), borderRadius: 999 }} />
                  </div>
                </div>
                <div>
                  {corredores.map((row, index) => (
                    <div key={row.zona} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: index < corredores.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                      <div style={{ width: 58, fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 700 }}>{row.zona}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--color-bg-muted)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, row.percentual)}%`, borderRadius: 999, background: pctColor(row.percentual) }} />
                          </div>
                          <div style={{ width: 42, textAlign: 'right', fontSize: 12, fontWeight: 800 }}>{row.percentual}%</div>
                          <MiniBadge>{row.total_posicoes} pos</MiniBadge>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{row.nome}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <a href="/mapa" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 700 }}>Ver mapa completo <ArrowRight size={12} /></a>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Mais Movimentados</span>
            <select className="input" value={topPeriodo} onChange={e => setTopPeriodo(e.target.value)} style={{ width: 132, height: 32, fontSize: 12 }}>
              <option value="mes">Este mes</option>
              <option value="semana">Esta semana</option>
            </select>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? <SkeletonCard height={250} /> : topProdutos.length === 0 ? (
              <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sem movimentacoes no periodo.</div>
            ) : topProdutos.map((item, index) => {
              const total = Number(item.total_movimentado || 0)
              return (
                <div key={item.nome} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{index + 1} {item.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{total.toLocaleString('pt-BR')} un movimentadas</div>
                    </div>
                    <MiniBadge tone="info">{item.categoria || 'Produto'}</MiniBadge>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: 'var(--color-brand-100)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(8, (total / maxTop) * 100)}%`, borderRadius: 999, background: 'var(--color-brand-600)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Equipe Hoje</span>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? <SkeletonCard height={250} /> : operadores.filter(op => Number(op.total_hoje || 0) > 0).length === 0 ? (
              <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhuma movimentacao registrada hoje.</div>
            ) : operadores.filter(op => Number(op.total_hoje || 0) > 0).slice(0, 5).map(op => {
              const initials = (op.nome || '?').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
              return (
                <div key={op.nome} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--color-border-muted)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--color-brand-100)', color: 'var(--color-brand-700)', fontSize: 12, fontWeight: 800 }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{Number(op.total_hoje || 0)} movimentacoes hoje - Ultima atividade: {fmtTime(op.ultima_atividade)}</div>
                  </div>
                  <MiniBadge tone={op.perfil === 'administrador' ? 'info' : 'neutral'}>{op.perfil === 'administrador' ? 'Administrador' : 'Operador'}</MiniBadge>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Saude do Estoque</span>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            {loading ? <SkeletonCard height={250} /> : (
              <>
                <Gauge value={saudeEstoque?.media_dias || 0} />
                <div style={{ display: 'grid', gap: 9, marginTop: 6, fontSize: 12 }}>
                  {[
                    [ShieldCheck, 'var(--color-success-600)', `${Number(saudeEstoque?.saudaveis || 0)} lotes saudaveis (> 90 dias)`],
                    [Clock, 'var(--color-warning-600)', `${Number(saudeEstoque?.atencao || 0)} lotes em atencao (30-90 dias)`],
                    [AlertTriangle, 'var(--color-danger-600)', `${Number(saudeEstoque?.criticos || 0)} lotes criticos (< 30 dias)`],
                  ].map(([Icon, color, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-secondary)' }}>
                      <Icon size={14} color={color} /> <span>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Movimentacoes recentes</span>
          <a href="/historico" style={{ fontSize: 12, color: 'var(--color-brand-600)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>Ver historico completo <ArrowRight size={12} /></a>
        </div>
        <div
          ref={scrollRef}
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--color-border-muted)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-bg-muted)', flexShrink: 0, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: '60%', background: 'var(--color-bg-muted)', borderRadius: 4, marginBottom: 6, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                  <div style={{ height: 11, width: '40%', background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} />
                </div>
              </div>
            ))
          ) : recentes.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhuma movimentacao registrada</div>
          ) : recentes.map((r, i) => {
            const tipo = r.tipo || r.tipo_movimentacao
            const isEntrada = tipo === 'entrada'
            const isSaida = tipo === 'saida'
            const isTransferencia = tipo === 'transferencia'
            const localizacao = r.localizacao_nome || r.localizacao_destino_nome || r.localizacao_origem_nome || '-'
            return (
              <div key={r.id || r.id_movimentacao || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < recentes.length - 1 ? '1px solid var(--color-border-muted)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: isEntrada ? 'var(--color-success-100)' : isSaida ? 'var(--color-danger-100)' : 'var(--color-brand-100)', color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-brand-600)' }}>
                  {isEntrada ? <ArrowDownLeft size={15} /> : isSaida ? <ArrowUpRight size={15} /> : isTransferencia ? <ArrowRight size={15} /> : <Circle size={12} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.produto_nome || r.codigo_lote || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{r.codigo_lote || r.numero_lote || '-'} - {fmtTipo(tipo)} - {localizacao}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isEntrada ? 'var(--color-success-600)' : isSaida ? 'var(--color-danger-600)' : 'var(--color-brand-600)' }}>
                    {isEntrada ? '+' : isSaida ? '-' : ''}{Number(r.quantidade || 0)} un
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{r.usuario_nome || 'Operador'} - {fmtTime(r.criado_em || r.data_movimentacao)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:.5} }
        @keyframes drawLine {
          from { stroke-dashoffset: 2000; stroke-dasharray: 2000; }
          to { stroke-dashoffset: 0; stroke-dasharray: 2000; }
        }
        @keyframes fadeArea {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (max-width: 1180px) {
          [style*="repeat(4,minmax(0,1fr))"] { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          [style*="repeat(3,minmax(0,1fr))"] { grid-template-columns: 1fr !important; }
          .dashboard-health-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .dashboard-main-grid { grid-template-columns: 1fr !important; }
          [style*="repeat(2,minmax(0,1fr))"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Layout>
  )
}
