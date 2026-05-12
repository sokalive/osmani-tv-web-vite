import { useCallback, useEffect, useState } from 'react'
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
import { verifySubscription } from '../services/api/subscriptionService'
import { getDeviceIdentity } from '../services/auth/deviceIdentity'
import { computeSubscriptionProgress } from '../lib/subscriptionMath'

const MANUAL_GIFT_ACK_STORAGE_KEY = 'osmani:manual_gift_ack_key'
const SUBSCRIPTION_EXPIRY_REMINDER_STORAGE_KEY = 'osmani:expiry_reminder_dismissed_key'

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
  const [blockedReason, setBlockedReason] = useState<TransferredAwayReason | null>(null)
  const [blockedReasonHint, setBlockedReasonHint] =
    useState<TransferredAwayReason | null>(null)
  const [blockedPaused, setBlockedPaused] = useState(false)
  const [blockedRecovering, setBlockedRecovering] = useState(false)
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

  useEffect(() => {
    if (catalog.data?.settings.emergencyMode) {
      return
    }

    queueMicrotask(() => {
      setEmergencyDismissed(false)
    })
  }, [catalog.data?.settings.emergencyMode])

  const syncManualGiftState = useCallback(async () => {
    try {
      const { deviceId, deviceFingerprint } = await getDeviceIdentity()
      const subscription = await verifySubscription(deviceId, deviceFingerprint)
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
      let nextBlockedReason: TransferredAwayReason | null = null

      if (subscription.active) {
        setBlockedReasonHint(null)
        setBlockedReason(null)
        setBlockedPaused(false)
        setBlockedRecovering(false)
      } else if (hasSubscriptionHistory(subscription)) {
        const expiresMs = parseMs(subscription.expiresAt)
        nextBlockedReason =
          blockedReasonHint ||
          (expiresMs != null && expiresMs <= Date.now() ? 'expired' : 'transferred')

        setBlockedReason(nextBlockedReason)
      } else {
        setBlockedReason(null)
      }

      setManualGiftAckKey(nextKey && nextKey !== acknowledgedKey ? nextKey : null)
      setExpiryReminderDays(nextReminderDays)
      setExpiryReminderKey(
        nextReminderKey && nextReminderKey !== dismissedReminderKey
          ? nextReminderKey
          : null,
      )
    } catch {
      return
    }
  }, [blockedReasonHint])

  useEffect(() => {
    queueMicrotask(() => {
      void syncManualGiftState()
    })
  }, [syncManualGiftState])

  useEffect(() => {
    queueMicrotask(() => {
      void syncManualGiftState()
    })
  }, [location.pathname, syncManualGiftState])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const refresh = () => {
      void syncManualGiftState()
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
  }, [syncManualGiftState])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void syncManualGiftState()
      }
    }, 15000)

    return () => {
      window.clearInterval(interval)
    }
  }, [syncManualGiftState])

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
    const openTransferConfirm = (payload: unknown) => {
      const nextEvent = normalizeTransferConfirmEvent(payload)
      if (nextEvent) {
        setTransferConfirmEvent(nextEvent)
      }
    }

    const clearTransferConfirm = () => {
      setTransferConfirmEvent(null)
    }

    const subscriptions = [
      subscribeRealtimeEvent('transfer_requested', openTransferConfirm),
      subscribeRealtimeEvent('transfer_confirmation_required', openTransferConfirm),
      subscribeRealtimeEvent('transfer_approved', clearTransferConfirm),
      subscribeRealtimeEvent('transfer_rejected', clearTransferConfirm),
      subscribeRealtimeEvent('transfer_completed', () => {
        clearTransferConfirm()
        setBlockedReasonHint('transferred')
        void syncManualGiftState()
      }),
      subscribeRealtimeEvent('subscription_revoked', () => {
        setBlockedReasonHint('revoked')
        void syncManualGiftState()
      }),
    ]

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [syncManualGiftState])

  const handleAcknowledgeManualGift = useCallback(async () => {
    if (!manualGiftAckKey) {
      return
    }

    setManualGiftBusy(true)
    try {
      writeAcknowledgedManualGiftKey(manualGiftAckKey)
      setManualGiftAckKey(null)
    } finally {
      setManualGiftBusy(false)
    }
  }, [manualGiftAckKey])

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

  const handleRecoverFromBlockedState = useCallback(() => {
    setBlockedRecovering(true)
    setBlockedPaused(true)
    navigate('/account', { state: { openTransferRecover: true } })
  }, [navigate])

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
        onResponded={() => {
          reloadIfStale(0, { silent: true })
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
      <OtaDebugOverlay />
    </div>
  )
}
