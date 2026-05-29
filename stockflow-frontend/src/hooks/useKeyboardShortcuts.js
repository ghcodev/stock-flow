import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const ROTAS_F = {
  F1: '/dashboard',
  F2: '/lotes',
  F3: '/movimentacoes/entrada',
  F4: '/movimentacoes/saida',
  F5: '/movimentacoes/transferencia',
  F6: '/mapa',
  F7: '/alertas',
  F8: '/relatorios',
}

const TECLAS_CTRL = {
  n: '/lotes/novo',
  e: '/movimentacoes/entrada',
  s: '/movimentacoes/saida',
  t: '/movimentacoes/transferencia',
}

export function useKeyboardShortcuts({ onAbrirBusca, onAbrirAjuda, onToggleTema }) {
  const navigate = useNavigate()

  const handleKeyDown = useCallback((e) => {
    const emInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
    const k = e.key.toLowerCase()
    const combo = e.ctrlKey || e.metaKey ? `Ctrl+${k === '/' ? '/' : k.toUpperCase()}` : e.key

    if (emInput && combo !== 'Ctrl+K' && combo !== 'Ctrl+/') return

    if (e.key in ROTAS_F) {
      e.preventDefault()
      navigate(ROTAS_F[e.key])
      return
    }

    if (e.ctrlKey || e.metaKey) {
      if (k === 'k') {
        e.preventDefault()
        onAbrirBusca?.()
        return
      }
      if (k === '/') {
        e.preventDefault()
        onAbrirAjuda?.()
        return
      }

      if (k in TECLAS_CTRL && document.hasFocus()) {
        e.preventDefault()
        navigate(TECLAS_CTRL[k])
        return
      }
      if (k === 'd') {
        e.preventDefault()
        onToggleTema?.()
      }
    }
  }, [navigate, onAbrirBusca, onAbrirAjuda, onToggleTema])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
