export function resolveAdminSession({ hasToken, meStatus = 200, adminStatus = 200 }) {
  if (!hasToken) return 'guest'
  if (meStatus === 401 || adminStatus === 401) return 'guest'
  if (adminStatus === 403) return 'forbidden'
  if (meStatus >= 200 && meStatus < 300 && adminStatus >= 200 && adminStatus < 300) return 'authenticated'
  return 'retryable'
}
