import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCatalogOutlet } from '../app/catalogOutlet'
import { PremiumModal } from '../components/account/PremiumModal'
import { TransferModal } from '../components/account/TransferModal'
import { formatSubscriptionExpiry } from '../lib/formatExpiry'
import {
  isSubscriptionEffectivelyActive,
  shouldShowSubscriptionExpiry,
} from '../lib/subscriptionActive'
import { computeSubscriptionProgress } from '../lib/subscriptionMath'
import { redeemOfferCode } from '../services/api/subscriptionService'
import { getDeviceIdentity, getDeviceLabel } from '../services/auth/deviceIdentity'
import { subscribeRealtimeEvent } from '../services/realtimeSync'

function formatPrice(amount: number | null, currency: string | null) {
  if (amount == null) {
    return null
  }

  const prefix = currency?.toUpperCase() === 'TZS' || !currency ? 'TSh' : currency

  try {
    return `${prefix} ${amount.toLocaleString('en-US')}`
  } catch {
    return `${prefix} ${amount}`
  }
}

function formatOfferCooldown(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const seconds = Math.max(0, totalSeconds) % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

type StatCardProps = {
  icon: 'payment' | 'access' | 'duration' | 'expiry'
  value: string
  label: string
}

function StatIcon({ icon }: Pick<StatCardProps, 'icon'>) {
  if (icon === 'access') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="3" />
        <path d="M8 18v2M16 18v2M9 12h6" />
      </svg>
    )
  }

  if (icon === 'duration') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    )
  }

  if (icon === 'expiry') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="14" rx="3" />
        <path d="M8 4v4M16 4v4M4 10h16" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h16v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Z" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <article className="account-stat">
      <span className="account-stat__icon" aria-hidden="true">
        <StatIcon icon={icon} />
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

export function AccountPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, subscription, refreshSubscription } = useCatalogOutlet()
  const routeState = location.state as
    | { openPremiumModal?: boolean; openTransferRecover?: boolean }
    | null
  const openPremiumModalOnLoad = Boolean(routeState?.openPremiumModal)
  const openTransferRecoverOnLoad = Boolean(routeState?.openTransferRecover)
  const [transferModalVisible, setTransferModalVisible] = useState(openTransferRecoverOnLoad)
  const [premiumModalVisible, setPremiumModalVisible] = useState(openPremiumModalOnLoad)
  const [offerCodeInput, setOfferCodeInput] = useState('')
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [cooldownEndMs, setCooldownEndMs] = useState<number | null>(null)
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState(0)
  const [deviceIdFull, setDeviceIdFull] = useState('')
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [offerError, setOfferError] = useState('')
  const [deviceCopyNotice, setDeviceCopyNotice] = useState('')
  const [tickNowMs, setTickNowMs] = useState(() => Date.now())

  const deviceLabel = useMemo(() => getDeviceLabel(), [])
  const freeMode = data?.settings.freeMode ?? false
  const isSubscribed = isSubscriptionEffectivelyActive(subscription, {
    nowMs: tickNowMs,
  })
  const channels = data?.channels ?? []
  const totalChannels = channels.length
  const unlockedChannels = (() => {
    if (!channels.length) {
      return 0
    }

    if (freeMode || isSubscribed) {
      return channels.length
    }

    return channels.filter((channel) => channel.accessType !== 'premium').length
  })()

  const progress = useMemo(
    () =>
      computeSubscriptionProgress({
        startedAt: subscription?.startedAt ?? null,
        expiresAt: subscription?.expiresAt ?? null,
        planDurationDays: subscription?.planDurationDays ?? null,
        serverTime: subscription?.serverTime ?? null,
        serverTimeFetchedAt: subscription?.serverTimeFetchedAt ?? null,
        nowMsOverride: tickNowMs,
      }),
    [subscription, tickNowMs],
  )

  useEffect(() => {
    if (!openPremiumModalOnLoad && !openTransferRecoverOnLoad) {
      return
    }

    queueMicrotask(() => {
      navigate('/account', { replace: true })
    })
  }, [navigate, openPremiumModalOnLoad, openTransferRecoverOnLoad])

  useEffect(() => {
    if (!isSubscribed) {
      return
    }

    const timer = window.setInterval(() => setTickNowMs(Date.now()), 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [isSubscribed])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!cooldownEndMs) {
        setCooldownRemainingSec(0)
        return
      }

      const left = Math.max(0, Math.ceil((cooldownEndMs - Date.now()) / 1000))
      setCooldownRemainingSec(left)

      if (left <= 0) {
        setCooldownEndMs(null)
      }
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [cooldownEndMs])

  useEffect(() => {
    if (!deviceCopyNotice) {
      return
    }

    const timer = window.setTimeout(() => setDeviceCopyNotice(''), 2200)
    return () => {
      window.clearTimeout(timer)
    }
  }, [deviceCopyNotice])

  const loadAccount = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setAccountLoading(true)
      setAccountError('')
    }

    try {
      const { deviceId } = await getDeviceIdentity()
      setDeviceIdFull(deviceId)
      const status = await refreshSubscription('account-screen')
      if (!status && !silent) {
        setAccountError('Imeshindwa kupakia akaunti.')
      }
    } catch (error) {
      if (!silent) {
        setAccountError(
          error instanceof Error ? error.message : 'Imeshindwa kupakia akaunti.',
        )
      }
    } finally {
      setAccountLoading(false)
    }
  }, [refreshSubscription])

  useEffect(() => {
    queueMicrotask(() => {
      void loadAccount({ silent: false })
    })
  }, [loadAccount])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const refresh = () => {
      void loadAccount({ silent: true })
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
  }, [loadAccount])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void loadAccount({ silent: true })
      }
    }, 15000)

    return () => {
      window.clearInterval(interval)
    }
  }, [loadAccount])

  useEffect(() => {
    const refresh = () => {
      void loadAccount({ silent: true })
    }

    const subscriptions = [
      subscribeRealtimeEvent('subscription_revoked', refresh),
      subscribeRealtimeEvent('transfer_requested', refresh),
      subscribeRealtimeEvent('transfer_confirmation_required', refresh),
      subscribeRealtimeEvent('transfer_pending', refresh),
      subscribeRealtimeEvent('transfer_approved', refresh),
      subscribeRealtimeEvent('transfer_rejected', refresh),
      subscribeRealtimeEvent('transfer_completed', refresh),
      subscribeRealtimeEvent('app_settings_changed', refresh),
    ]

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [loadAccount])

  const paymentValue = useMemo(() => {
    if (!isSubscribed) {
      return 'Hapana'
    }

    return formatPrice(subscription?.amount ?? null, subscription?.currency ?? null) ?? '-'
  }, [isSubscribed, subscription?.amount, subscription?.currency])

  const accessValue =
    totalChannels > 0 ? `${unlockedChannels} / ${totalChannels}` : isSubscribed ? 'Hai' : 'Hakuna'

  const durationValue = useMemo(() => {
    if (!isSubscribed) {
      return '-'
    }

    const days = subscription?.planDurationDays
    return typeof days === 'number' && Number.isFinite(days) && days > 0
      ? String(Math.trunc(days))
      : '-'
  }, [isSubscribed, subscription?.planDurationDays])

  const deviceShort =
    deviceIdFull.length >= 8 ? deviceIdFull.slice(0, 8).toUpperCase() : deviceIdFull || '-'
  const expiryValue =
    shouldShowSubscriptionExpiry(subscription, { nowMs: tickNowMs }) &&
    subscription?.expiresAt
      ? formatSubscriptionExpiry(subscription.expiresAt)
      : '-'

  return (
    <div className="screen-page">
      <section className="account-screen account-screen--strict">
        <header className="account-screen__header account-screen__header--strict">
          <button
            type="button"
            className="account-screen__back"
            aria-label="Back"
            onClick={() => navigate('/')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 6 8.5 12l6 6" />
            </svg>
          </button>

          <div className="account-screen__header-main">
            <div className="account-screen__avatar">
              <span>B</span>
              <i />
            </div>
            <div className="account-screen__header-copy">
              <h1>{deviceLabel}</h1>
              <small>ID: {deviceShort}</small>
            </div>
          </div>
        </header>

        {isSubscribed && progress.ok ? (
          <section className="account-panel account-panel--usage">
            <div className="account-panel__usage-header">
              <strong>Matumizi ya Kifurushi</strong>
              <span>{Math.round(progress.percentRemaining)}%</span>
            </div>
            <div className="account-panel__usage-track">
              <div
                className="account-panel__usage-fill"
                style={{ width: `${progress.percentRemaining}%` }}
              />
            </div>
            <p className="account-panel__usage-meta">
              {progress.remainingDays} siku zimebaki
              {progress.startMs && progress.expiresMs
                ? ` • ${formatSubscriptionExpiry(
                    new Date(progress.startMs).toISOString(),
                  )} → ${formatSubscriptionExpiry(
                    new Date(progress.expiresMs).toISOString(),
                  )}`
                : ''}
            </p>
          </section>
        ) : null}

        <div className="account-grid">
          <StatCard
            icon="payment"
            value={paymentValue}
            label="Malipo / Kifurushi"
          />
          <StatCard
            icon="access"
            value={accessValue}
            label="Channel Zilizofunguka"
          />
          <StatCard
            icon="duration"
            value={durationValue}
            label="Muda wa Kifurushi"
          />
          <StatCard
            icon="expiry"
            value={expiryValue}
            label="Kuisha Tarehe"
          />
        </div>

        <section className="account-panel">
          <p className="account-panel__label">Hali ya Usajili</p>
          <h2 className={isSubscribed ? 'account-panel__status-good' : 'account-panel__status-bad'}>
            {isSubscribed ? 'ACTIVE' : 'HUNA USAJILI'}
          </h2>
          {accountLoading ? (
            <p>Inapakia taarifa za usajili...</p>
          ) : accountError ? (
            <p>{accountError}</p>
          ) : shouldShowSubscriptionExpiry(subscription, { nowMs: tickNowMs }) &&
            subscription?.expiresAt ? (
            <p className="account-panel__status-copy">
              Kifurushi kinaisha {formatSubscriptionExpiry(subscription.expiresAt)}
            </p>
          ) : (
            <p className="account-panel__status-copy">
              Hakuna kifurushi hai kilichopatikana kwenye kifaa hiki.
            </p>
          )}
        </section>

        <button
          type="button"
          className="account-gradient-card"
          onClick={() => setTransferModalVisible(true)}
        >
          <span>Hamisha Kifurushi</span>
          <strong>HAMISHA KIFURUSHI CHAKO</strong>
        </button>

        <button
          type="button"
          className="account-primary-cta"
          onClick={() => setPremiumModalVisible(true)}
        >
          LIPIA TENA
        </button>

        <section className="account-device-section">
          <h2>Device ID ya kifaa hiki</h2>
          <div className="account-device-row">
            <code>{deviceIdFull || 'Inapakia...'}</code>
            <button
              type="button"
              onClick={async () => {
                if (!deviceIdFull) {
                  return
                }
                await navigator.clipboard.writeText(deviceIdFull)
                setDeviceCopyNotice('Device ID imenakiliwa')
              }}
            >
              Nakili
            </button>
          </div>
          {deviceCopyNotice ? (
            <p className="account-device-section__notice">{deviceCopyNotice}</p>
          ) : null}
          <p>Tuma Device ID hii kwa admin wakati wa kuhamisha kifurushi</p>
        </section>

        <section className="account-offer-section">
          <h2>WEKA CODE YA OFA ULIYOPEWA NA MUHUDUMU</h2>
          <p>Ingiza code uliyopewa na muhudumu</p>

          {cooldownRemainingSec > 0 ? (
            <>
              <p className="account-offer-section__warning">
                Umejaribu code nyingi zisizo sahihi
              </p>
              <strong className="account-offer-section__timer">
                {formatOfferCooldown(cooldownRemainingSec)}
              </strong>
            </>
          ) : null}

          <input
            className={`account-offer-section__input${
              cooldownRemainingSec > 0 ? ' account-offer-section__input--disabled' : ''
            }`}
            value={offerCodeInput}
            onChange={(event) => {
              setOfferError('')
              setOfferCodeInput(event.target.value.toUpperCase())
            }}
            placeholder="__________"
            disabled={cooldownRemainingSec > 0}
          />
          {offerError ? <p className="account-offer-section__error">{offerError}</p> : null}

          <button
            type="button"
            className={`account-primary-cta${
              cooldownRemainingSec > 0 || redeemBusy || !offerCodeInput.trim()
                ? ' account-primary-cta--disabled'
                : ''
            }`}
            disabled={cooldownRemainingSec > 0 || redeemBusy || !offerCodeInput.trim()}
            onClick={async () => {
              if (!offerCodeInput.trim() || redeemBusy || cooldownRemainingSec > 0) {
                return
              }

              setRedeemBusy(true)
              try {
                const { deviceId, deviceFingerprint } = await getDeviceIdentity()
                const result = await redeemOfferCode(
                  deviceId,
                  deviceFingerprint,
                  offerCodeInput.trim(),
                )

                if (result.ok) {
                  setOfferCodeInput('')
                  await loadAccount()
                  navigate('/')
                  return
                }

                if (result.locked) {
                  setCooldownEndMs(Date.now() + result.remainingSeconds * 1000)
                  setOfferError('')
                  return
                }

                setOfferError(result.message)
              } finally {
                setRedeemBusy(false)
              }
            }}
          >
            {redeemBusy ? 'Inathibitisha...' : 'THIBITISHA CODE'}
          </button>
        </section>
      </section>

      {transferModalVisible ? (
        <TransferModal
          visible={transferModalVisible}
          onClose={() => setTransferModalVisible(false)}
          onTransferSuccess={loadAccount}
          initialStep={openTransferRecoverOnLoad ? 'redeem' : 'intro'}
        />
      ) : null}
      {premiumModalVisible ? (
        <PremiumModal
          visible={premiumModalVisible}
          channelName="Chaneli Uliyofungua"
          onClose={() => setPremiumModalVisible(false)}
          onUnlockSuccess={async () => {
            await loadAccount()
            return true
          }}
        />
      ) : null}
    </div>
  )
}
