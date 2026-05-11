import { Outlet } from 'react-router-dom'
import { env } from '../config/env'

const navItems = [
  { href: '#player', label: 'Live' },
  { href: '#api', label: 'API' },
  { href: '#architecture', label: 'Architecture' },
]

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="/">
            <span className="brand__mark" aria-hidden="true">
              OT
            </span>
            <span>
              <strong>{env.brandName}</strong>
              <small>Browser playback frontend</small>
            </span>
          </a>

          <nav className="site-nav" aria-label="Primary">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <a className="site-header__cta" href="#player">
            Open player
          </a>
        </div>
      </header>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  )
}
