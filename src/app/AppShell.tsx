import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { env } from '../config/env'
import { useCatalogBootstrap } from '../hooks/useCatalogBootstrap'
import { BottomNav } from '../components/layout/BottomNav'
import { WhatsAppFab } from '../components/layout/WhatsAppFab'
import { PopupSettingsModal } from '../components/modals/PopupSettingsModal'
import type { CatalogOutletContext } from './catalogOutlet'
import { startRealtimeSync, stopRealtimeSync } from '../services/realtimeSync'

export function AppShell() {
  const location = useLocation()
  const isPlayerRoute = location.pathname.startsWith('/player/')
  const catalog = useCatalogBootstrap({
    backgroundPollingEnabled: !isPlayerRoute,
  })
  const { reloadIfStale } = catalog
  const outletContext: CatalogOutletContext = {
    data: catalog.data,
    selectedChannel: catalog.selectedChannel,
    loading: catalog.loading,
    error: catalog.error,
    reload: catalog.reload,
    selectChannel: catalog.selectChannel,
  }

  useEffect(() => {
    startRealtimeSync()
    return () => {
      stopRealtimeSync()
    }
  }, [])

  useEffect(() => {
    reloadIfStale(isPlayerRoute ? 12000 : 4000, { silent: true })
  }, [isPlayerRoute, location.pathname, reloadIfStale])

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
            catalog.data?.popupSettings?.greeting,
            catalog.data?.popupSettings?.bulletPoints.join('|'),
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
