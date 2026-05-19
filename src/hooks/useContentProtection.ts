import { useCallback, useEffect, useRef, useState } from 'react'

/** User-facing copy for screenshot / recording deterrence (website-only). */
export const CONTENT_PROTECTION_WARNING =
  'Screenshots and recording are restricted on this platform.'

const WARNING_VISIBLE_MS = 4500
const BLUR_FOCUS_DELAY_MS = 200

function isScreenshotShortcut(event: KeyboardEvent) {
  if (event.key === 'PrintScreen' || event.code === 'PrintScreen') {
    return true
  }

  // macOS default region/window capture shortcuts (best-effort; browser may not deliver all keys).
  if (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(event.key)) {
    return true
  }

  // Windows Snipping Tool / Game Bar style shortcuts (best-effort).
  if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 's') {
    return true
  }

  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
    return true
  }

  return false
}

/**
 * Website-only deterrence: conceal protected media when the tab loses visibility/focus
 * and react to common screenshot shortcuts. Does not intercept video playback APIs.
 */
export function useContentProtection() {
  const [concealed, setConcealed] = useState(false)
  const [warningVisible, setWarningVisible] = useState(false)
  const blurTimerRef = useRef<number | null>(null)
  const warningTimerRef = useRef<number | null>(null)

  const reveal = useCallback(() => {
    setConcealed(false)
    setWarningVisible(false)
    if (warningTimerRef.current != null) {
      window.clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
  }, [])

  const concealWithWarning = useCallback(() => {
    setConcealed(true)
    setWarningVisible(true)
    if (warningTimerRef.current != null) {
      window.clearTimeout(warningTimerRef.current)
    }
    warningTimerRef.current = window.setTimeout(() => {
      setWarningVisible(false)
      warningTimerRef.current = null
    }, WARNING_VISIBLE_MS)
  }, [])

  const syncVisibilityConceal = useCallback(() => {
    if (typeof document === 'undefined') {
      return
    }

    if (document.visibilityState !== 'visible') {
      setConcealed(true)
      return
    }

    if (document.hasFocus()) {
      reveal()
    }
  }, [reveal])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const onVisibilityChange = () => {
      syncVisibilityConceal()
    }

    const onFocus = () => {
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current)
        blurTimerRef.current = null
      }
      reveal()
    }

    const onBlur = () => {
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current)
      }
      blurTimerRef.current = window.setTimeout(() => {
        blurTimerRef.current = null
        if (!document.hasFocus() || document.visibilityState !== 'visible') {
          setConcealed(true)
        }
      }, BLUR_FOCUS_DELAY_MS)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isScreenshotShortcut(event)) {
        return
      }

      concealWithWarning()
    }

    const onPageHide = () => {
      setConcealed(true)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('keydown', onKeyDown)

    syncVisibilityConceal()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('keydown', onKeyDown)
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current)
      }
      if (warningTimerRef.current != null) {
        window.clearTimeout(warningTimerRef.current)
      }
    }
  }, [concealWithWarning, reveal, syncVisibilityConceal])

  // Best-effort: browsers that expose display-capture permission state (no playback hooks).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
      return
    }

    let cancelled = false
    let permissionStatus: PermissionStatus | null = null

    const attach = async () => {
      try {
        permissionStatus = await navigator.permissions.query({
          name: 'display-capture' as PermissionName,
        })
        if (cancelled) {
          return
        }

        const onChange = () => {
          if (permissionStatus?.state === 'granted') {
            concealWithWarning()
          }
        }

        permissionStatus.addEventListener('change', onChange)
        if (permissionStatus.state === 'granted') {
          concealWithWarning()
        }

        return () => {
          permissionStatus?.removeEventListener('change', onChange)
        }
      } catch {
        return undefined
      }
    }

    let detach: (() => void) | undefined
    void attach().then((cleanup) => {
      detach = cleanup
    })

    return () => {
      cancelled = true
      detach?.()
    }
  }, [concealWithWarning])

  return {
    concealed,
    warningVisible,
    warningMessage: CONTENT_PROTECTION_WARNING,
  }
}
