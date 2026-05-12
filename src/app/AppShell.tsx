import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { EmergencyModal } from '../components/modals/EmergencyModal'
import { env } from '../config/env'
import { useCatalogBootstrap } from '../hooks/useCatalogBootstrap'
import { BottomNav } from '../components/layout/BottomNav'
import { WhatsAppFab } from '../components/layout/WhatsAppFab'
import { ManualSubscriptionGiftModal } from '../components/modals/ManualSubscriptionGiftModal'
import { OtaDebugOverlay } from '../components/modals/OtaDebugOverlay'
import { PopupSettingsModal } from '../components/modals/PopupSettingsModal'
import { SubscriptionExpiryReminderModal } from '../components/modals/SubscriptionExpiryReminderModal'
import { UpdateOverlay } from '../components/modals/UpdateOverlay'
import {
  TransferredAwayModal,
  type TransferredAwayReason,
} from '../components/modals/TransferredAwayModal'
import {
  TransferConfirmModal,
  type TransferConfirmEvent,
} from '../components/modals/TransferConfirmModal'
import type { CatalogOutletContext } from './catalogOutlet'
import {
  startRealtimeSync,
  stopRealtimeSync,
  subscribeRealtimeEvent,
} from '../services/realtimeSync'
import { trackInstallOnce } from '../services/analytics'
import { startPresence, stopPresence } from '../services/presenceTracker'
import {
  acknowledgeManualGift,
  recoverSubscription,
  verifySubscription,
} from '../services/api/subscriptionService'
import { getDeviceIdentity } from '../services/auth/deviceIdentity'
import { computeSubscriptionProgress } from '../lib/subscriptionMath'
import { useUpdateRuntime } from '../hooks/useUpdateRuntime'
import type {
  ChannelViewModel,
  PlaybackGateResult,
  SubscriptionStatus,
} from '../types/osmani'

const MANUAL_GIFT_ACK_STORAGE_KEY = 'osmani:manual_gift_ack_key'
const SUBSCRIPTION_EXPIRY_REMINDER_STORAGE_KEY = 'osmani:expiry_reminder_dismissed_key'
const SETTINGS_POLL_MS = 2500
const SUBSCRIPTION_SYNC_MS = 15000

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function parseMs(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function hasSubscriptionHistory(subscription: {
  expiresAt?: string | null
  startedAt?: string | null
  amount?: number | null
  planName?: string | null
  planDurationDays?: number | null
}) {
  return Boolean(
    subscription.expiresAt ||
      subscription.startedAt ||
      subscription.planName ||
      subscription.amount != null ||
      (
        typeof subscription.planDurationDays === 'number' &&
        Number.isFinite(subscription.planDurationDays) &&
        subscription.planDurationDays > 0
      ),
  )
}

function pickSourceDeviceId(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const body = payload as Record<string, unknown>
  const sourceDevice = body.source_device

  return pickString(
    body.source_device_id,
    body.sourceDeviceId,
    typeof sourceDevice === 'object' && sourceDevice
      ? (sourceDevice as Record<string, unknown>).device_id
      : null,
    typeof sourceDevice === 'object' && sourceDevice
      ? (sourceDevice as Record<string, unknown>).id
      : null,
  )
}

function mapPlaybackGateReasonToBlockedReason(reason: string | null | undefined) {
  const normalized = String(reason || '')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return null
  }

  if (
    normalized.includes('transfer') ||
    normalized.includes('moved') ||
    normalized.includes('other_device')
  ) {
    return 'transferred' as const
  }

  if (
    normalized.includes('revoke') ||
    normalized.includes('blocked') ||
    normalized.includes('suspend')
  ) {
    return 'revoked' as const
  }

  if (
    normalized.includes('expire') ||
    normalized.includes('expired') ||
    normalized.includes('ended')
  ) {
    return 'expired' as const
  }

  return null
}

function normalizeTransferConfirmEvent(payload: unknown): TransferConfirmEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const body = payload as Record<string, unknown>
  const targetLabel =
    pickString(
      body.target_device_label,
      body.targetDevice,
      body.target_label,
      body.target_device_name,
      body.targetDeviceLabel,
    ) || 'kifaa kingine'

  return {
    key: Date.now(),
    code: pickString(body.code) || null,
    targetLabel,
  }
}

function readAcknowledgedManualGiftKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.localStorage.getItem(MANUAL_GIFT_ACK_STORAGE_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

function writeAcknowledgedManualGiftKey(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(MANUAL_GIFT_ACK_STORAGE_KEY, key)
  } catch {
    return
  }
}

function readDismissedExpiryReminderKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return (
      window.localStorage
        .getItem(SUBSCRIPTION_EXPIRY_REMINDER_STORAGE_KEY)
        ?.trim() || ''
    )
  } catch {
    return ''
  }
}

function writeDismissedExpiryReminderKey(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(SUBSCRIPTION_EXPIRY_REMINDER_STORAGE_KEY, key)
  } catch {
    return
  }
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const isPlayerRoute = location.pathname.startsWith('/player/')
  const isHomeRoute = location.pathname === '/'
  const catalog = useCatalogBootstrap({
    backgroundPollingEnabled: !isPlayerRoute,
  })
  const { reloadIfStale } = catalog
  const [transferConfirmEvent, setTransferConfirmEvent] =
    useState<TransferConfirmEvent | null>(null)
  const [manualGiftAckKey, setManualGiftAckKey] = useState<string | null>(null)
  const [manualGiftBusy, setManualGiftBusy] = useState(false)
  const [expiryReminderKey, setExpiryReminderKey] = useState<string | null>(null)
  const [expiryReminderDays, setExpiryReminderDays] = useState(1)
  const [emergencyDismissed, setEmergencyDismissed] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [subscriptionVersion, setSubscriptionVersion] = useState(0)
  const [blockedReason, setBlockedReason] = useState<TransferredAwayReason | null>(null)
  const [blockedReasonHint, setBlockedReasonHint] =
    useState<TransferredAwayReason | null>(null)
  const [blockedPaused, setBlockedPaused] = useState(false)
  const [blockedRecovering, setBlockedRecovering] = useState(false)
  const isSubscribed = subscription?.active === true
  const updateRuntime = useUpdateRuntime()

  const refreshSubscription = useCallback(
    async (
      _reason = 'manual',
      options: {
        recover?: boolean
      } = {},
    ) => {
      try {
        const { deviceId, deviceFingerprint } = await getDeviceIdentity()
        if (options.recover) {
          await recoverSubscription(deviceId, deviceFingerprint).catch(() => null)
        }

        const next = await verifySubscription(deviceId, deviceFingerprint)
        const runtimeBlockedReason = mapPlaybackGateReasonToBlockedReason(
          next.playbackGateReason,
        )
        setSubscription(next)
        setSubscriptionVersion((current) => current + 1)

        if (next.active) {
          setBlockedReasonHint(null)
          setBlockedReason(null)
          setBlockedPaused(false)
          setBlockedRecovering(false)
        } else if (runtimeBlockedReason) {
          setBlockedReason(runtimeBlockedReason)
        } else if (next.playbackGateReason) {
          setBlockedReason(null)
        } else if (hasSubscriptionHistory(next)) {
          const expiresMs = parseMs(next.expiresAt)
          setBlockedReason(
            blockedReasonHint ||
              (expiresMs != null && expiresMs <= Date.now()
                ? 'expired'
                : 'transferred'),
          )
        } else {
          setBlockedReason(null)
        }

        return next
      } catch {
        setSubscription(null)
        return null
      }
    },
    [blockedReasonHint],
  )

  const requestEmergencyModal = useCallback(() => {
    setEmergencyDismissed(false)
  }, [])

  const gateForPlayback = useCallback(
    async (
      channel: Pick<ChannelViewModel, 'accessType'> | null,
      reason = 'playback',
    ): Promise<PlaybackGateResult> => {
      if (catalog.data?.settings.freeMode) {
        return { allowed: true, reason: null }
      }

      if (!channel || channel.accessType !== 'premium') {
        return { allowed: true, reason: null }
      }

      const next = await refreshSubscription(`gate:${reason}`)
      return {
        allowed: next?.active === true,
        reason: next?.playbackGateReason ?? null,
      }
    },
    [catalog.data?.settings.freeMode, refreshSubscription],
  )

  const outletContext: CatalogOutletContext = useMemo(
    () => ({
      data: catalog.data,
      selectedChannel: catalog.selectedChannel,
      loading: catalog.loading,
      error: catalog.error,
      reload: catalog.reload,
      selectChannel: catalog.selectChannel,
      subscription,
      isSubscribed,
      subscriptionVersion,
      refreshSubscription,
      gateForPlayback,
      requestEmergencyModal,
    }),
    [
      catalog.data,
      catalog.selectedChannel,
      catalog.loading,
      catalog.error,
      catalog.reload,
      catalog.selectChannel,
      subscription,
      isSubscribed,
      subscriptionVersion,
      refreshSubscription,
      gateForPlayback,
      requestEmergencyModal,
    ],
  )

  useEffect(() => {
    void trackInstallOnce()
    void startPresence()
    startRealtimeSync()
    return () => {
      void stopPresence()
      stopRealtimeSync()
    }
  }, [])

  useEffect(() => {
    reloadIfStale(isPlayerRoute ? 12000 : 4000, { silent: true })
  }, [isPlayerRoute, location.pathname, reloadIfStale])

  useEffect(() => {
    if (catalog.data?.settings.emergencyMode) {
      return
    }

    queueMicrotask(() => {
      setEmergencyDismissed(false)
    })
  }, [catalog.data?.settings.emergencyMode])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshSubscription('cold-start', { recover: true })
    })
  }, [refreshSubscription])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshSubscription(`route:${location.pathname}`)
    })
  }, [location.pathname, refreshSubscription])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const refresh = () => {
      void refreshSubscription('focus')
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshSubscription])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void refreshSubscription('foreground-tick')
      }
    }, SUBSCRIPTION_SYNC_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [refreshSubscription])

  useEffect(() => {
    if (!subscription) {
      setManualGiftAckKey(null)
      setExpiryReminderKey(null)
      return
    }

    const nextKey = pickString(subscription.manualGiftAckKey)
    const acknowledgedKey = readAcknowledgedManualGiftKey()
    const progress = computeSubscriptionProgress({
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      planDurationDays: subscription.planDurationDays,
      serverTime: subscription.serverTime,
      serverTimeFetchedAt: subscription.serverTimeFetchedAt,
    })
    const dismissedReminderKey = readDismissedExpiryReminderKey()
    const nextReminderDays = Math.min(
      2,
      Math.max(1, Number(progress.remainingDays) || 1),
    )
    const nextReminderKey =
      subscription.active &&
      progress.ok &&
      progress.remainingDays > 0 &&
      progress.remainingDays <= 2 &&
      subscription.expiresAt
        ? `${subscription.expiresAt}|${nextReminderDays}`
        : ''

    setManualGiftAckKey(nextKey && nextKey !== acknowledgedKey ? nextKey : null)
    setExpiryReminderDays(nextReminderDays)
    setExpiryReminderKey(
      nextReminderKey && nextReminderKey !== dismissedReminderKey
        ? nextReminderKey
        : null,
    )
  }, [subscription, subscriptionVersion])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const refreshSettings = () => {
      void catalog.refreshSettingsOnly()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSettings()
      }
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        refreshSettings()
      }
    }, SETTINGS_POLL_MS)

    window.addEventListener('focus', refreshSettings)
    window.addEventListener('pageshow', refreshSettings)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshSettings)
      window.removeEventListener('pageshow', refreshSettings)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [catalog.refreshSettingsOnly])

  useEffect(() => {
    if (!blockedPaused || location.pathname === '/account') {
      return
    }

    queueMicrotask(() => {
      setBlockedPaused(false)
      setBlockedRecovering(false)
    })
  }, [blockedPaused, location.pathname])

  useEffect(() => {
    const openTransferConfirm = async (payload: unknown) => {
      const sourceDeviceId = pickSourceDeviceId(payload)
      if (sourceDeviceId) {
        const identity = await getDeviceIdentity().catch(() => null)
        const currentDeviceId = identity?.deviceId || ''
        if (currentDeviceId && currentDeviceId !== sourceDeviceId) {
          return
        }
      }

      const nextEvent = normalizeTransferConfirmEvent(payload)
      if (nextEvent) {
        setTransferConfirmEvent(nextEvent)
      }
    }

    const clearTransferConfirm = () => {
      setTransferConfirmEvent(null)
    }

    const subscriptions = [
      subscribeRealtimeEvent('transfer_requested', (payload) => {
        void openTransferConfirm(payload)
      }),
      subscribeRealtimeEvent('transfer_confirmation_required', (payload) => {
        void openTransferConfirm(payload)
      }),
      subscribeRealtimeEvent('transfer_approved', () => {
        clearTransferConfirm()
        void refreshSubscription('sse:transfer-approved')
      }),
      subscribeRealtimeEvent('transfer_rejected', clearTransferConfirm),
      subscribeRealtimeEvent('transfer_completed', () => {
        clearTransferConfirm()
        setBlockedReasonHint('transferred')
        void refreshSubscription('sse:transfer-completed')
      }),
      subscribeRealtimeEvent('subscription_revoked', () => {
        setBlockedReasonHint('revoked')
        void refreshSubscription('sse:subscription-revoked')
      }),
      subscribeRealtimeEvent('app_settings_changed', () => {
        void catalog.refreshSettingsOnly()
      }),
    ]

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [catalog.refreshSettingsOnly, refreshSubscription])

  const handleAcknowledgeManualGift = useCallback(async () => {
    if (!manualGiftAckKey) {
      return
    }

    setManualGiftBusy(true)
    try {
      const { deviceId, deviceFingerprint } = await getDeviceIdentity()
      await acknowledgeManualGift(deviceId, deviceFingerprint, manualGiftAckKey)
      writeAcknowledgedManualGiftKey(manualGiftAckKey)
      setManualGiftAckKey(null)
      await refreshSubscription('manual-gift-ack')
    } finally {
      setManualGiftBusy(false)
    }
  }, [manualGiftAckKey, refreshSubscription])

  const handleDismissExpiryReminder = useCallback(() => {
    if (expiryReminderKey) {
      writeDismissedExpiryReminderKey(expiryReminderKey)
    }
    setExpiryReminderKey(null)
  }, [expiryReminderKey])

  const handleRenewFromReminder = useCallback(() => {
    if (expiryReminderKey) {
      writeDismissedExpiryReminderKey(expiryReminderKey)
    }
    setExpiryReminderKey(null)
    navigate('/account', { state: { openPremiumModal: true } })
  }, [expiryReminderKey, navigate])

  const handleOpenPlansFromBlockedState = useCallback(() => {
    setBlockedPaused(true)
    setBlockedRecovering(false)
    navigate('/account', { state: { openPremiumModal: true } })
  }, [navigate])

  const handleRecoverFromBlockedState = useCallback(async () => {
    setBlockedRecovering(true)
    const recovered = await refreshSubscription('blocked-recover', { recover: true })
    if (recovered?.active) {
      setBlockedRecovering(false)
      setBlockedPaused(false)
      return
    }

    setBlockedPaused(true)
    navigate('/account', { state: { openTransferRecover: true } })
  }, [navigate, refreshSubscription])

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
          {isHomeRoute ? (
            <WhatsAppFab
              enabled={Boolean(catalog.data?.whatsappSettings?.enabled)}
              url={catalog.data?.whatsappSettings?.url || ''}
            />
          ) : null}
          <BottomNav brandName={env.brandName} />
        </>
      ) : null}
      <TransferConfirmModal
        key={transferConfirmEvent?.key ?? 0}
        event={transferConfirmEvent}
        onDismiss={() => setTransferConfirmEvent(null)}
        onResponded={async () => {
          reloadIfStale(0, { silent: true })
          await refreshSubscription('transfer-responded')
        }}
      />
      <ManualSubscriptionGiftModal
        visible={Boolean(manualGiftAckKey)}
        busy={manualGiftBusy}
        onAcknowledge={handleAcknowledgeManualGift}
      />
      <SubscriptionExpiryReminderModal
        visible={
          isHomeRoute &&
          Boolean(expiryReminderKey) &&
          !manualGiftAckKey &&
          !blockedReason
        }
        displayDays={expiryReminderDays}
        onRenew={handleRenewFromReminder}
        onDismissLater={handleDismissExpiryReminder}
      />
      <EmergencyModal
        visible={Boolean(catalog.data?.settings.emergencyMode) && !emergencyDismissed}
        onSawa={() => setEmergencyDismissed(true)}
      />
      <TransferredAwayModal
        visible={Boolean(blockedReason) && !blockedPaused}
        reason={blockedReason ?? 'transferred'}
        onOpenPlans={handleOpenPlansFromBlockedState}
        onRecover={handleRecoverFromBlockedState}
        recovering={blockedRecovering}
      />
      <UpdateOverlay
        visible={updateRuntime.state.visible}
        decision={updateRuntime.state.decision}
        info={updateRuntime.state.info}
        action={updateRuntime.state.action}
        downloading={updateRuntime.state.downloading}
        verifying={updateRuntime.state.verifying}
        installing={updateRuntime.state.installing}
        needsUnknownSourcesPermission={updateRuntime.state.needsUnknownSourcesPermission}
        failedReason={updateRuntime.state.failedReason}
        progress={updateRuntime.state.progress}
        onPrimary={updateRuntime.triggerPrimaryAction}
        onCancel={updateRuntime.dismiss}
      />
      <OtaDebugOverlay
        runtimeSnapshot={updateRuntime.state}
        onForceRecheck={() => {
          void updateRuntime.forceRecheck()
        }}
      />
    </div>
  )
}
