import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
const TOAST_DURATION = 4500

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger:  XCircle,
  info:    Info,
}

function SuccessCheckmark() {
  return (
    <svg className="checkmark-svg" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" />
      <path d="M6.5 12.5l3.5 3.5 7-7" />
    </svg>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  const add = useCallback((msg, type = 'info', duration = TOAST_DURATION) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type, duration }])
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
          const toastKindClass = t.type === 'danger' ? 'toast-error' : `toast-${t.type}`
          return (
            <div key={t.id} className={`toast ${t.type} ${toastKindClass}`}>
              <div className="toast-icon">
                {t.type === 'success' ? <SuccessCheckmark /> : <Icon size={15} />}
              </div>
              <div className="toast-content">
                <div className="toast-msg">{t.msg}</div>
              </div>
              <button className="toast-close" onClick={() => remove(t.id)}><X size={13} /></button>
              <div
                className="toast-progress"
                style={{ animationDuration: `${t.duration}ms` }}
              />
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
