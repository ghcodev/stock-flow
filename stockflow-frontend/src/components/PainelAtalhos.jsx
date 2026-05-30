import { useEffect } from 'react'

export function PainelAtalhos({ aberto, onFechar }) {
  useEffect(() => {
    if (!aberto) return undefined
    const handler = (e) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [aberto, onFechar])

  if (!aberto) return null

  const grupos = [
    {
      titulo: 'Navegação - tecla F',
      atalhos: [
        { teclas: ['F1'], descricao: 'Dashboard' },
        { teclas: ['F2'], descricao: 'Lotes' },
        { teclas: ['F3'], descricao: 'Entrada' },
        { teclas: ['F4'], descricao: 'Saída' },
        { teclas: ['F5'], descricao: 'Transferência' },
        { teclas: ['F6'], descricao: 'Mapa' },
        { teclas: ['F7'], descricao: 'Alertas' },
        { teclas: ['F8'], descricao: 'Relatórios' },
      ],
    },
    {
      titulo: 'Ações rápidas - Ctrl',
      atalhos: [
        { teclas: ['Ctrl', 'N'], descricao: 'Novo lote' },
        { teclas: ['Ctrl', 'E'], descricao: 'Nova entrada' },
        { teclas: ['Ctrl', 'S'], descricao: 'Nova saída' },
        { teclas: ['Ctrl', 'T'], descricao: 'Nova transferência' },
        { teclas: ['Ctrl', 'K'], descricao: 'Busca global' },
        { teclas: ['Ctrl', 'D'], descricao: 'Alternar tema' },
        { teclas: ['Ctrl', '/'], descricao: 'Este painel' },
      ],
    },
  ]

  return (
    <>
      <div
        onClick={onFechar}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--color-bg-overlay)',
          zIndex: 998,
        }}
      />

      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 999,
        background: 'var(--color-background-primary, var(--color-bg-default))',
        border: '0.5px solid var(--color-border-secondary, var(--color-border-default))',
        borderRadius: '14px',
        padding: '20px 24px',
        minWidth: '320px',
        maxWidth: '380px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Atalhos de teclado
          </span>
          <button
            onClick={onFechar}
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'var(--color-text-secondary)', padding: '2px 4px' }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {grupos.map(grupo => (
          <div key={grupo.titulo} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              {grupo.titulo}
            </div>

            {grupo.atalhos.map(({ teclas, descricao }) => (
              <div key={descricao} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--color-border-tertiary, var(--color-border-default))' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                  {descricao}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {teclas.map((t, i) => (
                    <kbd key={i} style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono, var(--font-data))',
                      fontWeight: 500,
                      background: 'var(--color-background-secondary, var(--color-bg-subtle))',
                      border: '0.5px solid var(--color-border-secondary, var(--color-border-default))',
                      borderRadius: 5,
                      padding: '2px 7px',
                      color: 'var(--color-text-primary)',
                    }}>
                      {t}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          Ctrl+/ para abrir · ESC para fechar
        </div>
      </div>
    </>
  )
}
