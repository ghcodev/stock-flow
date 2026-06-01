import { useEffect, useState } from 'react'
import { Box } from 'lucide-react'

export default function SplashScreen({ onComplete }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2000)
    const completeTimer = setTimeout(() => onComplete?.(), 2400)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div className={`splash-screen${exiting ? ' splash-screen-exit' : ''}`} aria-hidden="true">
      <div className="splash-content">
        <Box className="splash-icon splash-item" size={48} strokeWidth={1.8} />
        <div className="splash-title splash-item" style={{ animationDelay: '200ms' }}>StockFlow</div>
        <div className="splash-subtitle splash-item" style={{ animationDelay: '400ms' }}>
          Sistema de Gestão de Estoque
        </div>

        <div className="splash-progress splash-item" style={{ animationDelay: '500ms' }}>
          <div className="splash-progress-bar" />
        </div>
      </div>

      <div className="splash-footer splash-item" style={{ animationDelay: '600ms' }}>
        Arte Trigo · 2026
      </div>
    </div>
  )
}
