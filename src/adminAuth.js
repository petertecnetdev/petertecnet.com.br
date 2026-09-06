import { createContext, useContext } from 'react'

export const ADMIN_API = import.meta.env.VITE_API_URL || 'https://api.petertecnet.com.br/api'
export const ADMIN_TOKEN_KEY = 'petertecnet_admin_token'
export const AdminAuthContext = createContext(null)

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth precisa estar dentro de AdminAuthProvider.')
  return context
}
