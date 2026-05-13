import { useCallback, useEffect, useRef, useState } from 'react'
import { env } from '../config/env'
import { pickDefaultChannel, channelPlaybackDigest } from '../lib/catalog'
import type { CatalogBootstrap, ChannelViewModel, WhatsappSettings } from '../types/osmani'
import {
  fetchBanners,
  fetchCategories,
  fetchChannels,
  fetchRuntimeAppModes,
  fetchServerHealth,
  fetchWhatsappSettings,
} from '../services/api/osmaniAdminService'
import { subscribeRealtimeEvent } from '../services/realtimeSync'

type LoadState = {
  data: CatalogBootstrap | null
  selectedChannel: ChannelViewModel | null
  loading: boolean
  error: string | null
}

type CatalogReloadOptions = {
  silent?: boolean
}

type UseCatalogBootstrapOptions = {
  backgroundPollingEnabled?: boolean
}

const VISIBLE_REVALIDATE_MS = 8000
const HIDDEN_REVALIDATE_MS = 45000
const PLAYER_ROUTE_REVALIDATE_MS = 60000
const FOCUS_REVALIDATE_MS = 4000
const SSE_RELOAD_DEBOUNCE_MS = 500

function applyFreeModeToChannels(
  channels: ChannelViewModel[],
  freeMode: boolean,
) {
  if (!freeMode) {
    return channels
  }

  return channels.map((channel) => ({
    ...channel,
    accessType: 'free' as const,
  }))
}

async function loadCatalogSnapshot() {
  const serverHealthPromise = fetchServerHealth()
  const bannersPromise = fetchBanners().catch(() => [])
  const whatsappSettingsPromise =
    /(?:^|\/)api\/settings\/whatsapp(?:$|[/?#])/i.test(env.whatsappSettingsPath)
      ? fetchWhatsappSettings().catch(() => null as WhatsappSettings | null)
      : Promise.resolve(null as WhatsappSettings | null)
  const [serverHealth, banners, whatsappSettings, channels, settings] =
    await Promise.all([
      serverHealthPromise,
      bannersPromise,
      whatsappSettingsPromise,
      serverHealthPromise.then((health) => fetchChannels(health)),
      fetchRuntimeAppModes(),
    ])

  const effectiveChannels = applyFreeModeToChannels(channels, settings.freeMode)
  const categories = await fetchCategories(effectiveChannels)

  return {
    channels: effectiveChannels,
    categories,
    banners,
    settings,
    serverHealth,
    popupSettings: null,
    whatsappSettings,
  } satisfies CatalogBootstrap
}

export function useCatalogBootstrap({
  backgroundPollingEnabled = true,
}: UseCatalogBootstrapOptions = {}) {
  const [state, setState] = useState<LoadState>({
    data: null,
    selectedChannel: null,
    loading: true,
    error: null,
  })
  const stateRef = useRef(state)
  const dataSignatureRef = useRef('')
  const lastSyncedAtRef = useRef(0)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const queuedReloadRef = useRef<CatalogReloadOptions | null>(null)
  const sseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const runReload = useCallback(async ({ silent = false }: CatalogReloadOptions = {}) => {
    if (inFlightRef.current) {
      queuedReloadRef.current = { silent: (queuedReloadRef.current?.silent ?? true) && silent }
      return inFlightRef.current
    }

    const shouldShowLoading = !silent || !stateRef.current.data
    if (shouldShowLoading) {
      setState((current) => ({ ...current, loading: true, error: null }))
    }

    const task = (async () => {
      try {
        const data = await loadCatalogSnapshot()
        const signature = JSON.stringify(data)
        const previousSignature = dataSignatureRef.current

        dataSignatureRef.current = signature
        lastSyncedAtRef.current = Date.now()

        setState((current) => {
          const nextSelected = pickDefaultChannel(
            data.channels,
            current.selectedChannel?.id || env.defaultChannelId,
          )

          const prevSelected = current.selectedChannel
          let selectionPlaybackStale = false
          if (prevSelected && nextSelected && prevSelected.id === nextSelected.id) {
            selectionPlaybackStale =
              channelPlaybackDigest(prevSelected) !== channelPlaybackDigest(nextSelected)
          }

          if (
            current.data &&
            previousSignature === signature &&
            current.selectedChannel?.id === nextSelected?.id &&
            !selectionPlaybackStale &&
            !current.loading &&
            current.error == null
          ) {
            return current
          }

          return {
            data,
            selectedChannel: nextSelected,
            loading: false,
            error: null,
          }
        })
      } catch (error) {
        setState((current) => {
          if (current.data) {
            return {
              ...current,
              loading: false,
              error: silent ? current.error : error instanceof Error ? error.message : current.error,
            }
          }

          return {
            data: null,
            selectedChannel: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load the live Osmani TV catalog.',
          }
        })
      }
    })().finally(() => {
      inFlightRef.current = null
      if (queuedReloadRef.current) {
        const queued = queuedReloadRef.current
        queuedReloadRef.current = null
        void runReload(queued)
      }
    })

    inFlightRef.current = task
    return task
  }, [])

  const reloadIfStale = useCallback(
    (maxAgeMs = 0, options: CatalogReloadOptions = {}) => {
      const isFresh =
        stateRef.current.data != null &&
        Date.now() - lastSyncedAtRef.current < maxAgeMs
      if (isFresh) {
        return
      }

      void runReload({
        silent: options.silent ?? stateRef.current.data != null,
      })
    },
    [runReload],
  )

  const scheduleSilentReload = useCallback(
    (delayMs = SSE_RELOAD_DEBOUNCE_MS) => {
      if (typeof window === 'undefined') {
        void runReload({ silent: stateRef.current.data != null })
        return
      }

      if (sseTimerRef.current != null) {
        window.clearTimeout(sseTimerRef.current)
      }

      sseTimerRef.current = window.setTimeout(() => {
        sseTimerRef.current = null
        void runReload({ silent: stateRef.current.data != null })
      }, delayMs)
    },
    [runReload],
  )

  useEffect(() => {
    void runReload({ silent: false })

    return () => {
      if (sseTimerRef.current != null && typeof window !== 'undefined') {
        window.clearTimeout(sseTimerRef.current)
      }
    }
  }, [runReload])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const onFocus = () => reloadIfStale(FOCUS_REVALIDATE_MS, { silent: true })
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reloadIfStale(FOCUS_REVALIDATE_MS, { silent: true })
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [reloadIfStale])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    let active = true
    let timer: number | null = null

    const loop = () => {
      if (!active) {
        return
      }

      const delay =
        document.visibilityState === 'visible'
          ? backgroundPollingEnabled
            ? VISIBLE_REVALIDATE_MS
            : PLAYER_ROUTE_REVALIDATE_MS
          : HIDDEN_REVALIDATE_MS

      timer = window.setTimeout(async () => {
        if (!active) {
          return
        }

        await runReload({ silent: true })
        loop()
      }, delay)
    }

    loop()

    return () => {
      active = false
      if (timer != null) {
        window.clearTimeout(timer)
      }
    }
  }, [backgroundPollingEnabled, runReload])

  useEffect(() => {
    const subscriptions = [
      subscribeRealtimeEvent('app_settings_changed', () => scheduleSilentReload()),
      subscribeRealtimeEvent('app_modes_changed', () => scheduleSilentReload()),
      subscribeRealtimeEvent('popup_settings_changed', () => scheduleSilentReload()),
      subscribeRealtimeEvent('whatsapp_settings_changed', () => scheduleSilentReload()),
      subscribeRealtimeEvent('server_health_changed', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('channels_changed', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('channel_changed', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('channel_updated', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('channel_saved', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('channels_updated', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('catalog_updated', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('banners_changed', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('banner_changed', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('banner_updated', () => scheduleSilentReload(250)),
      subscribeRealtimeEvent('snapshot', () => scheduleSilentReload(250)),
    ]

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [scheduleSilentReload])

  return {
    ...state,
    selectChannel: (channel: ChannelViewModel) =>
      setState((current) => ({ ...current, selectedChannel: channel })),
    reload: () => {
      void runReload({ silent: false })
    },
    reloadIfStale,
  }
}
