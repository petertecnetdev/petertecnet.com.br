import { createContext, useContext } from 'react'

export const AdminDataContext = createContext(null)

export function useAdminData() {
  const context = useContext(AdminDataContext)
  if (!context) throw new Error('useAdminData precisa estar dentro de AdminDataProvider.')
  return context
}
