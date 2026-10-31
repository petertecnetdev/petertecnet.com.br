export const publicNavigationMenuLabel = open => open ? 'Fechar menu' : 'Abrir menu'

export function handlePublicNavigationKeyDown(event, { close, focusTrigger } = {}) {
  if (event?.key !== 'Escape') return false

  event.preventDefault?.()
  close?.()
  focusTrigger?.()
  return true
}
