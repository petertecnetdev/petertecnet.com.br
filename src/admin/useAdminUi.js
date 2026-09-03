import { useContext } from 'react'
import { ADMIN_TABS, adminTabFromLocation, adminTabLabel } from './AdminNavigationConfig.js'
import { requestAdminNavigation } from './AdminUiEvents.js'
import { AdminUiContext } from './AdminUiState.js'

export function useAdminUi() {
  const context = useContext(AdminUiContext)
  if (context) return context
  const activeTab = adminTabFromLocation()
  return {
    activeTab,
    activeLabel: adminTabLabel(activeTab),
    tabs: ADMIN_TABS,
    navigate: requestAdminNavigation,
  }
}
