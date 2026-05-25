import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios.js'

const AuthContext = createContext(null)

function buildAppUser(u) {
  const parts = u.nome.trim().split(' ')
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
  return {
    id: u.id,
    name: u.nome,
    email: u.email,
    perfil: u.perfil,
    role: u.perfil === 'administrador' ? 'Administrador' : 'Operador',
    isAdmin: u.perfil === 'administrador',
    initials,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('stockflow_token')
    const stored = localStorage.getItem('stockflow_user')
    if (token && stored) {
      try { setUser(JSON.parse(stored)) } catch {
        localStorage.removeItem('stockflow_token')
        localStorage.removeItem('stockflow_user')
      }
    }
    setLoading(false)
  }, [])

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha })
    const appUser = buildAppUser(data.usuario)
    localStorage.setItem('stockflow_token', data.token)
    localStorage.setItem('stockflow_user', JSON.stringify(appUser))
    setUser(appUser)
  }

  async function logout() {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('stockflow_token')
    localStorage.removeItem('stockflow_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
