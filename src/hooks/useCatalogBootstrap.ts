import { useEffect, useState } from 'react'
import { env } from '../config/env'
import { pickDefaultChannel } from '../lib/catalog'
import type { CatalogBootstrap, ChannelViewModel } from '../types/osmani'
import {
  fetchAppSettings,
  fetchBanners,
  fetchCategories,
  fetchChannels,
  fetchPopupSettings,
  fetchWhatsappSettings,
} from '../services/api/osmaniAdminService'

type LoadState = {
  data: CatalogBootstrap | null
  selectedChannel: ChannelViewModel | null
  loading: boolean
  error: string | null
}

export function useCatalogBootstrap() {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<LoadState>({
    data: null,
    selectedChannel: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let disposed = false

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }))

      try {
        const [channels, settings, banners, popupSettings, whatsappSettings] =
          await Promise.all([
            fetchChannels(),
            fetchAppSettings(),
            fetchBanners(),
            fetchPopupSettings(),
            fetchWhatsappSettings(),
          ])
        const effectiveChannels = settings.freeMode
          ? channels.map((channel) => ({
              ...channel,
              accessType: 'free' as const,
            }))
          : channels
        const categories = await fetchCategories(effectiveChannels)

        const data: CatalogBootstrap = {
          channels: effectiveChannels,
          categories,
          banners,
          settings,
          popupSettings,
          whatsappSettings,
        }

        if (disposed) {
          return
        }

        setState({
          data,
          selectedChannel: pickDefaultChannel(effectiveChannels, env.defaultChannelId),
          loading: false,
          error: null,
        })
      } catch (error) {
        if (disposed) {
          return
        }

        setState({
          data: null,
          selectedChannel: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load the live Osmani TV catalog.',
        })
      }
    }

    void load()

    return () => {
      disposed = true
    }
  }, [reloadToken])

  return {
    ...state,
    selectChannel: (channel: ChannelViewModel) =>
      setState((current) => ({ ...current, selectedChannel: channel })),
    reload: () => setReloadToken((value) => value + 1),
  }
}
