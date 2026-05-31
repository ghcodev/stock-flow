import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Produtos from './pages/Produtos.jsx'
import Lotes from './pages/Lotes.jsx'
import MapaArmazem from './pages/MapaArmazem.jsx'
import Entrada from './pages/Entrada.jsx'
import Saida from './pages/Saida.jsx'
import Transferencia from './pages/Transferencia.jsx'
import Historico from './pages/Historico.jsx'
import Rastreabilidade from './pages/Rastreabilidade.jsx'
import AlertasVencimento from './pages/AlertasVencimento.jsx'
import Relatorios from './pages/Relatorios.jsx'
import Inventario from './pages/Inventario.jsx'
import Auditoria from './pages/Auditoria.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Perfil from './pages/Perfil.jsx'
import AjusteEstoque from './pages/AjusteEstoque.jsx'
import IntegracaoSAP from './pages/IntegracaoSAP.jsx'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--color-bg-canvas)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--color-brand-200)', borderTopColor: 'var(--color-brand-600)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>Carregando…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard"    element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/produtos"     element={<PrivateRoute><Produtos /></PrivateRoute>} />
      <Route path="/lotes"        element={<PrivateRoute><Lotes /></PrivateRoute>} />
      <Route path="/lotes/novo"   element={<PrivateRoute><Lotes /></PrivateRoute>} />
      <Route path="/mapa"         element={<PrivateRoute><MapaArmazem /></PrivateRoute>} />
      <Route path="/entrada"      element={<PrivateRoute><Entrada /></PrivateRoute>} />
      <Route path="/saida"        element={<PrivateRoute><Saida /></PrivateRoute>} />
      <Route path="/transferencia" element={<PrivateRoute><Transferencia /></PrivateRoute>} />
      <Route path="/movimentacoes" element={<PrivateRoute><Historico /></PrivateRoute>} />
      <Route path="/movimentacoes/entrada" element={<PrivateRoute><Entrada /></PrivateRoute>} />
      <Route path="/movimentacoes/saida" element={<PrivateRoute><Saida /></PrivateRoute>} />
      <Route path="/movimentacoes/transferencia" element={<PrivateRoute><Transferencia /></PrivateRoute>} />
      <Route path="/historico"    element={<PrivateRoute><Historico /></PrivateRoute>} />
      <Route path="/rastreabilidade" element={<PrivateRoute><Rastreabilidade /></PrivateRoute>} />
      <Route path="/alertas"      element={<PrivateRoute><AlertasVencimento /></PrivateRoute>} />
      <Route path="/alertas-vencimento" element={<PrivateRoute><AlertasVencimento /></PrivateRoute>} />
      <Route path="/relatorios"   element={<PrivateRoute><Relatorios /></PrivateRoute>} />
      <Route path="/inventario"   element={<PrivateRoute><Inventario /></PrivateRoute>} />
      <Route path="/perfil"       element={<PrivateRoute><Perfil /></PrivateRoute>} />

      <Route path="/auditoria"    element={<AdminRoute><Auditoria /></AdminRoute>} />
      <Route path="/usuarios"     element={<AdminRoute><Usuarios /></AdminRoute>} />
      <Route path="/ajuste"       element={<AdminRoute><AjusteEstoque /></AdminRoute>} />
      <Route path="/sap"          element={<AdminRoute><IntegracaoSAP /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
