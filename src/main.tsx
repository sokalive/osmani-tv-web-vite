import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function isTouchRuntime() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches
  )
}

function setupMobileRuntimeShell() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  const body = document.body

  const syncViewport = () => {
    const touchRuntime = isTouchRuntime()
    root.classList.toggle('runtime-touch', touchRuntime)
    body.classList.toggle('runtime-touch', touchRuntime)

    if (!touchRuntime) {
      root.style.removeProperty('--app-dvh')
      return
    }

    const height = Math.round(window.visualViewport?.height ?? window.innerHeight)
    root.style.setProperty('--app-dvh', `${height}px`)
  }

  syncViewport()
  window.addEventListener('resize', syncViewport)
  window.addEventListener('orientationchange', syncViewport)
  window.visualViewport?.addEventListener('resize', syncViewport)
}

setupMobileRuntimeShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
