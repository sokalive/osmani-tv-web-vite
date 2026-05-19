import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useContentProtection } from '../../hooks/useContentProtection'

type ContentProtectionProps = {
  children: ReactNode
}

/**
 * Website-only content protection shell.
 * - Blocks context menu / drag on `.protected-media` regions only.
 * - Blurs protected media when the tab loses focus or visibility.
 * - Shows a short warning after suspected screenshot shortcuts.
 * Does not modify streaming URLs, players, auth, or backend integrations.
 */
export function ContentProtection({ children }: ContentProtectionProps) {
  const { concealed, warningVisible, warningMessage } = useContentProtection()

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.classList.toggle(
      'content-protection--concealed',
      concealed,
    )

    return () => {
      document.documentElement.classList.remove('content-protection--concealed')
    }
  }, [concealed])

  useEffect(() => {
    const blockProtectedContextMenu = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('.protected-media')) {
        event.preventDefault()
      }
    }

    const blockProtectedDrag = (event: DragEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('.protected-media')) {
        event.preventDefault()
      }
    }

    document.addEventListener('contextmenu', blockProtectedContextMenu)
    document.addEventListener('dragstart', blockProtectedDrag)

    return () => {
      document.removeEventListener('contextmenu', blockProtectedContextMenu)
      document.removeEventListener('dragstart', blockProtectedDrag)
    }
  }, [])

  return (
    <>
      {children}
      {concealed ? <div className="content-protection-shield" aria-hidden="true" /> : null}
      {warningVisible ? (
        <div
          className="content-protection-warning"
          role="status"
          aria-live="polite"
        >
          <p>{warningMessage}</p>
        </div>
      ) : null}
    </>
  )
}
