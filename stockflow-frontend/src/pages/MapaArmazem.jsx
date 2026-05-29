import { useState } from 'react'
import Layout from '../components/Layout.jsx'
import { Map, RefreshCw, Download, ZoomIn, ZoomOut, Layers } from 'lucide-react'

const CORREDORES = ['A', 'B', 'C', 'D']
const NIVEIS = [1, 2, 3, 4, 5]
const POSICOES = [1, 2, 3, 4]

function getPosicaoStatus() {
  const r = Math.random()
  if (r < 0.55) return 'ocupada'
  if (r < 0.70) return 'livre'
  if (r < 0.80) return 'vencendo'
  if (r < 0.88) return 'bloqueada'
  if (r < 0.94) return 'quarentena'
  return 'livre'
}

const COR_STATUS = {
  ocupada:    { bg: 'var(--color-brand-600)', label: 'Ocupada' },
  livre:      { bg: 'var(--color-success-500)', label: 'Livre' },
  vencendo:   { bg: 'var(--color-warning-500)', label: 'Vencendo' },
  bloqueada:  { bg: 'var(--color-danger-500)', label: 'Bloqueada' },
  quarentena: { bg: 'var(--color-admin-600)', label: 'Quarentena' },
}

const POSICOES_MAP = CORREDORES.flatMap(cor =>
  NIVEIS.flatMap(nivel =>
    POSICOES.map(pos => ({
      id: `${cor}${nivel}-N${nivel}-P${pos}`,
      cor, nivel, pos,
      status: getPosicaoStatus(),
    }))
  )
)

export default function MapaArmazem() {
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('todos')

  const counts = POSICOES_MAP.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  return (
    <Layout breadcrumb={['Operação', 'Mapa do Armazém']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Mapa do Armazém</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span>Sincronizado via RFID há 8s</span>
            <span className="sep" />
            <span><strong style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>1.182</strong> / 1.440 posições ocupadas (82%)</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
          <button className="btn btn-outline btn-sm"><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(COR_STATUS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(f => f === k ? 'todos' : k)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: filterStatus === k ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, background: filterStatus === k ? 'var(--color-bg-subtle)' : 'none' }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 3, background: v.bg, flexShrink: 0 }} />
            {v.label} ({counts[k] || 0})
          </button>
        ))}
      </div>

      {/* Warehouse grid */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {CORREDORES.map(cor => (
            <div key={cor}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Corredor {cor}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 4 }}>
                {POSICOES_MAP.filter(p => p.cor === cor).map(pos => {
                  const show = filterStatus === 'todos' || pos.status === filterStatus
                  return (
                    <button
                      key={pos.id}
                      title={`${pos.id} · ${COR_STATUS[pos.status]?.label}`}
                      onClick={() => setSelected(pos)}
                      style={{
                        height: 20, borderRadius: 3, border: 'none', cursor: 'pointer',
                        background: show ? COR_STATUS[pos.status]?.bg : 'var(--color-border-default)',
                        opacity: show ? 1 : 0.25,
                        outline: selected?.id === pos.id ? '2px solid var(--color-text-primary)' : 'none',
                        transition: 'opacity 0.15s, transform 0.1s',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ marginTop: 20, padding: 16, background: 'var(--color-bg-subtle)', borderRadius: 10, border: '1px solid var(--color-border-default)', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: COR_STATUS[selected.status]?.bg, flexShrink: 0, marginTop: 3 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Posição {selected.id}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Status: <strong>{COR_STATUS[selected.status]?.label}</strong>
                {' · '}Corredor {selected.cor} · Nível {selected.nivel} · Prateleira P{selected.pos}
              </div>
            </div>
            <button className="icon-btn" onClick={() => setSelected(null)} style={{ marginLeft: 'auto' }}>×</button>
          </div>
        )}
      </div>
    </Layout>
  )
}
