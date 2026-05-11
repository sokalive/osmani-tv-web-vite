import { Outlet, useLocation } from 'react-router-dom'
import { env } from '../config/env'
import { useCatalogBootstrap } from '../hooks/useCatalogBootstrap'
import { BottomNav } from '../components/layout/BottomNav'
import { WhatsAppFab } from '../components/layout/WhatsAppFab'
import { PopupSettingsModal } from '../components/modals/PopupSettingsModal'
import type { CatalogOutletContext } from './catalogOutlet'

export function AppShell() {
  const location = useLocation()
  const catalog = useCatalogBootstrap()
  const isPlayerRoute = location.pathname.startsWith('/player/')
  const outletContext: CatalogOutletContext = {
    data: catalog.data,
    selectedChannel: catalog.selectedChannel,
    loading: catalog.loading,
    error: catalog.error,
    reload: catalog.reload,
    selectChannel: catalog.selectChannel,
  }

  return (
    <div className={`app-shell${isPlayerRoute ? ' app-shell--player' : ''}`}>
      <div className="app-shell__ambient" aria-hidden="true" />
      <main className={`page-content${isPlayerRoute ? ' page-content--player' : ''}`}>
        <Outlet context={outletContext} />
      </main>
      {!isPlayerRoute ? (
        <PopupSettingsModal
          key={[
            catalog.data?.popupSettings?.mode,
            catalog.data?.popupSettings?.title,
            catalog.data?.popupSettings?.disclaimer,
          ].join('|')}
          settings={catalog.data?.popupSettings || null}
        />
      ) : null}
      {!isPlayerRoute ? (
        <>
          <WhatsAppFab url={catalog.data?.whatsappSettings?.url || ''} />
          <BottomNav brandName={env.brandName} />
        </>
      ) : null}
    </div>
  )
}
