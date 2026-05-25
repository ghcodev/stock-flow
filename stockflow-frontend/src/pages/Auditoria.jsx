import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api from '../api/axios.js'
import { Shield, Download, Search, Filter, ArrowDownLeft, ArrowUpRight, Shuffle, Edit, Lock, LogIn, Activity } from 'lucide-react'

const ACAO_CFG = {
  ENTRADA:       { icon: ArrowDownLeft, color: 'var(--color-success-600)', bg: 'var(--color-success-100)' },
  SAIDA:         { icon: ArrowUpRight,  color: 'var(--color-danger-600)',  bg: 'var(--color-danger-100)'  },
  TRANSFERENCIA: { icon: Shuffle,       color: 'var(--color-brand-600)',   bg: 'var(--color-brand-100)'   },
  LOGIN:         { icon: LogIn,         color: 'var(--color-info-700)',    bg: 'var(--color-info-100)'    },
  USUARIO_EDIT:  { icon: Edit,          color: 'var(--color-admin-700)',   bg: 'var(--color-admin-100)'   },
  BLOQUEIO:      { icon: Lock,          color: 'var(--color-warning-700)', bg: 'var(--color-warning-100)' },
  AJUSTE:        { icon: Activity,      color: 'var(--color-admin-700)',   bg: 'var(--color-admin-100)'   },
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i}><div style={{ height: 13, background: 'var(--color-bg-muted)', borderRadius: 4, animation: 'shimmer 1.2s ease-in-out infinite' }} /></td>
      ))}
    </tr>
  )
}

export default function Auditoria() {
  const toast = useToast()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/auditoria', { params: { search, limit: 50 } })
      setLogs(data.data || data || [])
      setTotal(data.total || (data.data || data || []).length)
    } catch {
      toast.error('Erro ao carregar log de auditoria.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = search
    ? logs.filter(l =>
        (l.usuario_nome || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.acao || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.entidade || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs

  return (
    <Layout breadcrumb={['Administração', 'Auditoria']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Log de Auditoria</h1>
          <div className="subtitle">
            <span className="live-dot" />
            <span>Log imutável · hash SHA-256</span>
            <span className="sep" />
            <span><strong style={{ fontWeight: 600 }}>{total.toLocaleString('pt-BR')}</strong> registros · retenção 7 anos</span>
            <span className="sep" />
            <span style={{ background: 'var(--color-admin-100)', color: 'var(--color-admin-700)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Somente Admin</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm"><Filter size={14} /> Filtros</button>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Exportar</button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={14} />
            <input type="text" placeholder="Buscar por usuário, entidade ou ação…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID Registro</th>
              <th>Data / Hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>Detalhe</th>
              <th>IP</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-icon"><Shield size={24} /></div>
                      <div className="empty-title">Nenhum registro encontrado</div>
                    </div>
                  </td></tr>
                )
                : filtered.map((l, i) => {
                  const acao = (l.acao || '').toUpperCase()
                  const cfg = ACAO_CFG[acao] || { icon: Shield, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)' }
                  return (
                    <tr key={l.id || i}>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 10.5, color: 'var(--color-brand-700)', fontWeight: 500 }}>{l.id}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>
                        {l.criado_em ? new Date(l.criado_em).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 500 }}>{l.usuario_nome || l.usuario || '—'}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color, letterSpacing: '0.04em' }}>
                          <cfg.icon size={10} />{acao}
                        </span>
                      </td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11 }}>{l.entidade || l.recurso || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 220 }}>{l.detalhe || l.descricao || '—'}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{l.ip || '—'}</td>
                      <td style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {l.hash ? `${l.hash.slice(0, 4)}…${l.hash.slice(-4)}` : '—'}
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">Exibindo {filtered.length} de {total.toLocaleString('pt-BR')} registros</span>
        </div>
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </Layout>
  )
}
