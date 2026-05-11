import { env } from '../../config/env'

export function getSessionToken() {
  if (typeof window === 'undefined' || !env.sessionStorageKey) {
    return ''
  }

  return (
    window.sessionStorage.getItem(env.sessionStorageKey) ||
    window.localStorage.getItem(env.sessionStorageKey) ||
    ''
  )
}
