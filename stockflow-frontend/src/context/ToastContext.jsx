import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger:  XCircle,
  info:    Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  const add = useCallback((msg, type = 'info', duration = 4500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => remove(id), duration)
    return id
  }, [remove])

  const toast = {
    success: msg => add(msg, 'success'),
    error:   msg => add(msg, 'danger'),
    warning: msg => add(msg, 'warning'),
    info:    msg => add(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <div className="toast-icon"><Icon size={15} /></div>
              <div className="toast-content">
                <div className="toast-msg">{t.msg}</div>
              </div>
              <button className="toast-close" onClick={() => remove(t.id)}><X size={13} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
