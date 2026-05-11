import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { HomePage } from '../pages/HomePage'
import { SportsPage } from '../pages/SportsPage'
import { MoviesPage } from '../pages/MoviesPage'
import { AccountPage } from '../pages/AccountPage'
import { PlayerPage } from '../pages/PlayerPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'sports',
        element: <SportsPage />,
      },
      {
        path: 'movies',
        element: <MoviesPage />,
      },
      {
        path: 'account',
        element: <AccountPage />,
      },
      {
        path: 'player/:channelId',
        element: <PlayerPage />,
      },
    ],
  },
])
