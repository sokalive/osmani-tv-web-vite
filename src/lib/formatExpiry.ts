export function formatSubscriptionExpiry(iso: string | null | undefined) {
  if (!iso) {
    return '-'
  }

  const timestamp = Date.parse(String(iso))
  if (!Number.isFinite(timestamp)) {
    return String(iso)
  }

  try {
    return new Intl.DateTimeFormat('sw-TZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp))
  } catch {
    return String(iso)
  }
}
