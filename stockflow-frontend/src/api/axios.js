import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:3000/api/v1' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('stockflow_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('stockflow_token')
      localStorage.removeItem('stockflow_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
