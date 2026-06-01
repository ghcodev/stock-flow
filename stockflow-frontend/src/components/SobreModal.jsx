import { useEffect } from 'react'
import { Box, Code2, X, Github } from 'lucide-react'

const STACK = [
  { nome: 'React 18 + Vite',    desc: 'Frontend' },
  { nome: 'Node.js + Express',  desc: 'Backend' },
  { nome: 'MySQL 8.4',          desc: 'Banco de Dados' },
  { nome: 'JWT + bcrypt',       desc: 'Segurança' },
  { nome: 'CSS Design Tokens',  desc: 'Estilização' },
  { nome: 'IBM Plex Sans',      desc: 'Tipografia' },
]

const EQUIPE = [
  { iniciais: 'VI', nome: 'Vinicius' },
  { iniciais: 'GU', nome: 'Gustavo' },
  { iniciais: 'PE', nome: 'Pedro' },
  { iniciais: 'RA', nome: 'Rayk' },
]

const MODULOS = [
  'Dashboard', 'Produtos', 'Lotes', 'Mapa do Armazém',
  'Entrada', 'Saída', 'Transferência', 'Inventário',
  'Histórico', 'Rastreabilidade', 'Vencimentos', 'Relatórios',
  'Usuários', 'Auditoria', 'Ajuste de Estoque', 'Integração SAP', 'Perfil',
]

export default function SobreModal({ onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'sobreOverlayIn 200ms ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 600, maxWidth: '90vw',
          background: 'var(--color-bg-default)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'sobreModalIn 250ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          overflow: 'hidden',
        }}
      >
        {/* ── HEADER ── */}
        <div style={{
          background: '#0f1f3d',
          padding: '24px 28px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: 'rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Box size={26} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                  StockFlow
                </span>
                <span style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 999,
                }}>
                  v1.0
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
                Sistema de Gestão de Estoque e Rastreabilidade
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', cursor: 'pointer',
              width: 30, height: 30, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 120ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── BODY ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Sobre o projeto */}
          <section>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Sobre o Projeto
            </h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
              StockFlow é um sistema WMS (Warehouse Management System) desenvolvido para a <strong style={{ color: 'var(--color-text-primary)' }}>Arte Trigo</strong>, empresa de alimentos congelados de Goiás. Oferece rastreabilidade completa por lote, controle de localizações físicas, movimentações transacionais e auditoria imutável de todas as operações.
            </p>
          </section>

          {/* Stack tecnológica */}
          <section>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Stack Tecnológica
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {STACK.map(({ nome, desc }) => (
                <div key={nome} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px',
                  background: 'var(--color-bg-subtle)',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-muted)',
                }}>
                  <Code2 size={14} color="var(--color-brand-600)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Equipe */}
          <section>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
              Equipe
            </h3>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
              {EQUIPE.map(({ iniciais, nome }) => (
                <div key={iniciais} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#fff',
                    letterSpacing: '0.02em',
                  }}>
                    {iniciais}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)' }}>{nome}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              Orientadores: Prof. [Nome do Orientador]
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              Projeto Integrador · 2026
            </div>
          </section>

          {/* Módulos implementados */}
          <section>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
              Módulos Implementados
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MODULOS.map(m => (
                <span key={m} style={{
                  background: 'var(--color-brand-100)', color: 'var(--color-brand-700)',
                  fontSize: 11, fontWeight: 600,
                  padding: '3px 10px', borderRadius: 999,
                  border: '1px solid var(--color-brand-200)',
                }}>
                  {m}
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          background: 'var(--color-bg-muted)',
          borderTop: '1px solid var(--color-border-muted)',
          padding: '12px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            © 2026 Arte Trigo · StockFlow v1.0 · Todos os direitos reservados
          </span>
          <a
            href="https://github.com/ghcodev/stock-flow"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, color: 'var(--color-brand-600)',
              textDecoration: 'none',
            }}
          >
            <Github size={13} /> github.com/ghcodev/stock-flow
          </a>
        </div>
      </div>

      <style>{`
        @keyframes sobreOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sobreModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  )
}
