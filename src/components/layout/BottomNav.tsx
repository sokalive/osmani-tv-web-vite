import { NavLink } from 'react-router-dom'

type BottomNavProps = {
  brandName: string
}

const navItems = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/sports', label: 'Sports', icon: 'sports' },
  { to: '/movies', label: 'Tamthilia', icon: 'movies' },
  { to: '/account', label: 'Akaunti Yangu', icon: 'account' },
] as const

type NavIconName = (typeof navItems)[number]['icon']

function NavIcon({ name }: { name: NavIconName }) {
  if (name === 'sports') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5l2.8 3.1-.9 4.1H10.1l-.9-4.1L12 3.5Z" />
        <path d="M5.4 8.2l4-.3 2.3 3.1-1.5 3.7-4.1.4-2.1-3.3 1.4-3.6Z" />
        <path d="M18.6 8.2l-4-.3-2.3 3.1 1.5 3.7 4.1.4 2.1-3.3-1.4-3.6Z" />
      </svg>
    )
  }

  if (name === 'movies') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="M8 5v14M16 5v14M4 9h16M4 15h16" />
      </svg>
    )
  }

  if (name === 'account') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 19c1.5-3 4-4.5 6.5-4.5s5 1.5 6.5 4.5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  )
}

export function BottomNav({ brandName }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label={`${brandName} navigation`}>
      <div className="bottom-nav__inner">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="bottom-nav__icon">
                  <NavIcon name={item.icon} />
                </span>
                <span className={`bottom-nav__label${isActive ? ' bottom-nav__label--active' : ''}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
