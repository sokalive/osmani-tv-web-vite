import { useEffect } from 'react'

let preservedBodyStyles:
  | {
      overflow: string
      overscrollBehavior: string
      touchAction: string
    }
  | null = null

function getLockCount(body: HTMLElement) {
  const raw = Number(body.dataset.scrollLockCount ?? '0')
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') {
      return
    }

    const { body, documentElement } = document
    const currentCount = getLockCount(body)

    if (currentCount === 0) {
      preservedBodyStyles = {
        overflow: body.style.overflow,
        overscrollBehavior: body.style.overscrollBehavior,
        touchAction: body.style.touchAction,
      }
      body.style.overflow = 'hidden'
      body.style.overscrollBehavior = 'none'
      body.style.touchAction = 'none'
      body.classList.add('app-scroll-locked')
      documentElement.classList.add('app-scroll-locked')
    }

    body.dataset.scrollLockCount = String(currentCount + 1)

    return () => {
      const nextCount = Math.max(0, getLockCount(body) - 1)
      body.dataset.scrollLockCount = String(nextCount)

      if (nextCount > 0) {
        return
      }

      if (preservedBodyStyles) {
        body.style.overflow = preservedBodyStyles.overflow
        body.style.overscrollBehavior = preservedBodyStyles.overscrollBehavior
        body.style.touchAction = preservedBodyStyles.touchAction
      } else {
        body.style.overflow = ''
        body.style.overscrollBehavior = ''
        body.style.touchAction = ''
      }

      body.classList.remove('app-scroll-locked')
      documentElement.classList.remove('app-scroll-locked')
      delete body.dataset.scrollLockCount
      preservedBodyStyles = null
    }
  }, [locked])
}
