import { type CSSProperties, useEffect, useRef, useState } from 'react'
import {
  createPayment,
  fetchSubscriptionStatus,
  getPaymentProviders,
  getPaymentStatus,
  getPlans,
} from '../../services/api/subscriptionService'
import { formatSubscriptionExpiry } from '../../lib/formatExpiry'
import { getDeviceIdentity } from '../../services/auth/deviceIdentity'
import type { PaymentProvider, SubscriptionPlan } from '../../types/osmani'

type PremiumModalProps = {
  visible: boolean
  channelName?: string
  onClose: () => void
  onUnlockSuccess?: () => Promise<void> | void
}

const ACCENT = '#FACC15'
const NETWORK_COLORS: Record<string, string> = {
  Tigo: '#1F8FFF',
  'M-Pesa': '#22C55E',
  Airtel: '#EF4444',
  HaloPesa: '#F59E0B',
}

const FALLBACK_NETWORKS: PaymentProvider[] = [
  { id: 'tigo', name: 'Tigo', logoUrl: null, active: true },
  { id: 'mpesa', name: 'M-Pesa', logoUrl: null, active: true },
  { id: 'airtel', name: 'Airtel', logoUrl: null, active: true },
  { id: 'halopesa', name: 'HaloPesa', logoUrl: null, active: true },
]

const BENEFITS = [
  'Ukilipia Una Tazama Channel zote',
  'Channel Zote Ni HD & 4K Streaming',
  'Hakuna Kuganda kwa Channel',
  'Channel Zipo Live Muda Wote',
]

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatPriceTz(value: number) {
  try {
    return new Intl.NumberFormat('en-TZ', {
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return String(Math.round(value))
  }
}

function formatPlanDuration(raw: string) {
  const value = String(raw ?? '').trim()
  if (!value || value === '-' || value === '—') {
    return '(—)'
  }

  const match = value.match(/\d+/)
  return match ? `(${match[0]} siku)` : `(${value.replace(/^\(|\)$/g, '')})`
}

type PremiumIconName =
  | 'diamond'
  | 'phone'
  | 'call'
  | 'check-circle'
  | 'card'
  | 'wallet'
  | 'checkmark'
  | 'alert'

function PremiumIcon({
  name,
  className,
}: {
  name: PremiumIconName
  className?: string
}) {
  if (name === 'diamond') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6.5 4h11L21 9.25 12 20 3 9.25 6.5 4Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (name === 'phone') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="7"
          y="2.5"
          width="10"
          height="19"
          rx="2.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'call') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7.7 4.3h3.1l1.3 4-2 1.8a14 14 0 0 0 3.8 3.8l1.8-2 4 1.3v3.1a1.8 1.8 0 0 1-2 1.8A15.7 15.7 0 0 1 5.9 6.3a1.8 1.8 0 0 1 1.8-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (name === 'check-circle') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
        <circle
          cx="12"
          cy="12"
          r="8.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="m8.6 12.1 2.2 2.3 4.7-5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (name === 'card') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="3"
          y="5.5"
          width="18"
          height="13"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M3 9.5h18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (name === 'wallet') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 15.5v-7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M4.5 9.5H18M15.5 13h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (name === 'checkmark') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="m5.5 12.5 4 4 9-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5 3.8 19h16.4L12 4.5Z"
        fill="currentColor"
      />
      <path
        d="M12 9v4.7"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.8" r="1" fill="#FFFFFF" />
    </svg>
  )
}

function LoadingSpinner({
  className = '',
  dark = false,
}: {
  className?: string
  dark?: boolean
}) {
  return (
    <span
      className={`premium-modal__spinner-circle${dark ? ' premium-modal__spinner-circle--dark' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}

function getProviderColor(name: string) {
  return NETWORK_COLORS[name] || ACCENT
}

export function PremiumModal({
  visible,
  channelName = 'Chaneli Uliyofungua',
  onClose,
  onUnlockSuccess,
}: PremiumModalProps) {
  const [step, setStep] = useState(1)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [failureReason, setFailureReason] = useState('')
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null)
  const [finalizingSuccess, setFinalizingSuccess] = useState(false)
  const [providers, setProviders] = useState<PaymentProvider[]>(FALLBACK_NETWORKS)
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({})
  const pollingDoneRef = useRef(false)

  const selectedAmountDisplay =
    selectedPlan && Number.isFinite(selectedPlan.price)
      ? `TSh ${formatPriceTz(selectedPlan.price)}`
      : 'TSh —'
  const isPhoneValid =
    phoneNumber.length === 10 && phoneNumber.startsWith('0')
  const compactResultStep = step === 4 || step === 5

  useEffect(() => {
    if (!visible || typeof document === 'undefined') {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [visible])

  useEffect(() => {
    if (!visible || typeof document === 'undefined') {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, visible])

  useEffect(() => {
    if (!visible) {
      return
    }

    let cancelled = false
    void (async () => {
      setPlansLoading(true)
      setPlansError('')
      try {
        const nextPlans = await getPlans()
        if (cancelled) {
          return
        }

        setPlans(nextPlans)
        setSelectedPlan((current) => {
          if (current && nextPlans.some((plan) => plan.id === current.id)) {
            return current
          }

          return nextPlans[0] ?? null
        })
      } catch (error) {
        if (!cancelled) {
          setPlansError(
            error instanceof Error ? error.message : 'Imeshindwa kupakia mipango',
          )
        }
      } finally {
        if (!cancelled) {
          setPlansLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible])

  useEffect(() => {
    if (!visible) {
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const liveProviders = await getPaymentProviders()
        if (!cancelled && liveProviders.length > 0) {
          setProviders(liveProviders)
          setLogoErrors({})
        }
      } catch {
        if (!cancelled) {
          setProviders(FALLBACK_NETWORKS)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible])

  useEffect(() => {
    if (!visible || step !== 3 || !orderId) {
      return
    }

    const countdownTimer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1))
    }, 1000)

    const pollTimer = window.setInterval(() => {
      if (pollingDoneRef.current) {
        return
      }

      void (async () => {
        try {
          const result = await getPaymentStatus(orderId)
          if (result.status === 'SUCCESS') {
            pollingDoneRef.current = true
            window.clearInterval(pollTimer)
            window.clearInterval(countdownTimer)
            const { deviceId } = await getDeviceIdentity()
            const subscription = await fetchSubscriptionStatus(deviceId)
            setSuccessExpiresAt(subscription.expiresAt)
            setStep(4)
            return
          }

          if (result.status === 'FAILED') {
            pollingDoneRef.current = true
            window.clearInterval(pollTimer)
            window.clearInterval(countdownTimer)
            setFailureReason(result.reason || 'Malipo hayajafanikiwa')
            setStep(5)
          }
        } catch (error) {
          pollingDoneRef.current = true
          window.clearInterval(pollTimer)
          window.clearInterval(countdownTimer)
          setFailureReason(
            error instanceof Error ? error.message : 'Jaribu tena baadae.',
          )
          setStep(5)
        }
      })()
    }, 3000)

    return () => {
      window.clearInterval(countdownTimer)
      window.clearInterval(pollTimer)
    }
  }, [orderId, step, visible])

  async function handleStartPayment() {
    if (!selectedPlan || submitting) {
      return
    }

    if (!isPhoneValid) {
      setSubmissionError('Weka namba sahihi ya simu')
      return
    }

    setSubmissionError('')
    setSubmitting(true)

    try {
      const { deviceId, deviceFingerprint } = await getDeviceIdentity()
      const payment = await createPayment({
        phone: phoneNumber.trim(),
        planId: selectedPlan.id,
        amount: selectedPlan.price,
        deviceId,
        deviceFingerprint,
      })

      pollingDoneRef.current = false
      setFailureReason('')
      setOrderId(payment.orderId)
      setRemainingSeconds(payment.expiresInSeconds ?? 0)
      setStep(3)
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : 'Imeshindwa kuanzisha malipo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleContinue() {
    setFinalizingSuccess(true)
    try {
      await onUnlockSuccess?.()
      onClose()
    } finally {
      setFinalizingSuccess(false)
    }
  }

  function handleRetry() {
    pollingDoneRef.current = false
    setFailureReason('')
    setOrderId(null)
    setRemainingSeconds(0)
    setSubmissionError('')
    setStep(2)
  }

  function renderStepContent() {
    if (step === 1) {
      return (
        <div className="premium-modal__intro">
          <div className="premium-modal__crown-halo-wrap">
            <div className="premium-modal__crown-glow" />
            <div className="premium-modal__crown-circle">
              <PremiumIcon name="diamond" className="premium-modal__icon premium-modal__icon--crown" />
            </div>
          </div>

          <h2 className="premium-modal__title-centered">Karibu Osman TV</h2>
          <p className="premium-modal__subtitle-centered">
            {channelName} ni channel ya premium
          </p>

          {plansLoading ? (
            <div className="premium-modal__spinner-wrap">
              <LoadingSpinner />
            </div>
          ) : null}
          {plansError ? <p className="premium-modal__error">{plansError}</p> : null}
          {!plansLoading && !plansError && plans.length === 0 ? (
            <p className="premium-modal__muted-centered">
              Hakuna mipango inayopatikana kwa sasa.
            </p>
          ) : null}

          <div className="premium-modal__plans-list">
            {plans.map((plan) => {
              const selected = selectedPlan?.id === plan.id
              return (
                <button
                  type="button"
                  key={plan.id}
                  className={`premium-modal__plan-row${selected ? ' premium-modal__plan-row--selected' : ''}`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  {selected ? <span className="premium-modal__plan-row-gradient" aria-hidden="true" /> : null}
                  <span
                    className={`premium-modal__radio-outer${selected ? ' premium-modal__radio-outer--selected' : ''}`}
                    aria-hidden="true"
                  >
                    {selected ? <span className="premium-modal__radio-inner" /> : null}
                  </span>
                  <span className="premium-modal__plan-text-col">
                    <span className="premium-modal__plan-label">{plan.name}</span>
                    <span className="premium-modal__plan-meta">
                      {formatPlanDuration(plan.duration)}
                    </span>
                  </span>
                  <strong className="premium-modal__plan-price-right">
                    TSh {formatPriceTz(plan.price)}
                  </strong>
                </button>
              )
            })}
          </div>

          <div className="premium-modal__benefits-list">
            {BENEFITS.map((line) => (
              <div className="premium-modal__benefit-row" key={line}>
                <PremiumIcon
                  name="check-circle"
                  className="premium-modal__icon premium-modal__icon--benefit"
                />
                <p className="premium-modal__benefit-text">{line}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (step === 2) {
      return (
        <div className="premium-modal__step2-outer-padding">
          <div className="premium-modal__step2-top-section">
            <div className="premium-modal__title-row">
              <div className="premium-modal__title-icon-circle">
                <PremiumIcon name="phone" className="premium-modal__icon premium-modal__icon--title" />
              </div>
              <h2 className="premium-modal__title premium-modal__step2-gap-clear">
                Weka Namba ya Simu
              </h2>
            </div>
            <p className="premium-modal__subtitle-networks">
              Tigo, M-Pesa, Airtel, HaloPesa
            </p>

            <label className="premium-modal__input-wrap premium-modal__step2-gap-clear">
              <PremiumIcon name="call" className="premium-modal__icon premium-modal__icon--input" />
              <input
                className="premium-modal__input-field"
                value={phoneNumber}
                onChange={(event) => {
                  setSubmissionError('')
                  setPhoneNumber(event.target.value.replace(/[^\d]/g, '').slice(0, 10))
                }}
                placeholder="0712345678"
                inputMode="tel"
                maxLength={10}
              />
            </label>

            <p className="premium-modal__networks-label premium-modal__step2-gap-clear">
              Mitandao inayokubaliwa
            </p>

            <div className="premium-modal__networks-grid premium-modal__step2-gap-clear">
              {providers.map((provider) => {
                const color = getProviderColor(provider.name)
                const hasLogo = Boolean(provider.logoUrl) && !logoErrors[provider.id]
                const networkStyle = {
                  '--premium-network-color': color,
                } as CSSProperties

                return (
                  <div className="premium-modal__network-card-outer" key={provider.id}>
                    <div
                      className={`premium-modal__network-card${hasLogo ? '' : ' premium-modal__network-card--fallback'}`}
                      style={networkStyle}
                    >
                      {hasLogo ? (
                        <img
                          src={provider.logoUrl ?? undefined}
                          alt={provider.name}
                          className="premium-modal__network-logo-fill"
                          onError={() =>
                            setLogoErrors((current) =>
                              current[provider.id]
                                ? current
                                : { ...current, [provider.id]: true },
                            )
                          }
                        />
                      ) : (
                        <span className="premium-modal__network-initial-fill-text">
                          {provider.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <strong className="premium-modal__network-card-text">
                      {provider.name}
                    </strong>
                  </div>
                )
              })}
            </div>

            {submissionError ? (
              <p className="premium-modal__error premium-modal__error--step2">
                {submissionError}
              </p>
            ) : null}
          </div>

          <div className="premium-modal__step2-flex-spacer" />

          <div className="premium-modal__step2-bottom-section">
            <button
              type="button"
              className={`premium-modal__cta-wrap premium-modal__cta-dock-btn${!isPhoneValid || submitting ? ' premium-modal__cta-disabled' : ''}`}
              disabled={!isPhoneValid || submitting}
              onClick={() => void handleStartPayment()}
            >
              <span className="premium-modal__cta-gradient">
                {submitting ? (
                  <LoadingSpinner dark />
                ) : (
                  <span className="premium-modal__cta-text">LIPIA SASA</span>
                )}
              </span>
            </button>
          </div>
        </div>
      )
    }

    if (step === 3) {
      return (
        <div className="premium-modal__step3-wrap">
          <div className="premium-modal__loader-halo-wrap">
            <div className="premium-modal__loader-ring" />
            <div className="premium-modal__loader-inner">
              <PremiumIcon name="card" className="premium-modal__icon premium-modal__icon--loader" />
            </div>
          </div>

          <h2 className="premium-modal__wait-title">
            Inasubiri uthibitisho wa malipo
          </h2>
          <p className="premium-modal__wait-pin">
            Thibitisha malipo kwenye simu yako (PIN).
          </p>

          <div className="premium-modal__amount-pill">
            <PremiumIcon name="wallet" className="premium-modal__icon premium-modal__icon--wallet" />
            <span className="premium-modal__amount-pill-text">{selectedAmountDisplay}</span>
          </div>

          <p className="premium-modal__countdown">
            {remainingSeconds > 0 ? formatCountdown(remainingSeconds) : '--:--'}
          </p>

          {orderId ? (
            <div className="premium-modal__order-pill">
              <span className="premium-modal__order-pill-label">Order ID</span>
              <span className="premium-modal__order-pill-value">{orderId}</span>
            </div>
          ) : null}
        </div>
      )
    }

    if (step === 4) {
      return (
        <div className="premium-modal__result-wrap">
          <div className="premium-modal__success-icon-halo">
            <div className="premium-modal__success-icon-circle">
              <PremiumIcon name="checkmark" className="premium-modal__icon premium-modal__icon--result" />
            </div>
          </div>

          <h2 className="premium-modal__success-title">Malipo yamefanikiwa</h2>
          <p className="premium-modal__success-body">
            Kifurushi chako kinaisha:{' '}
            <strong className="premium-modal__success-highlight">
              {formatSubscriptionExpiry(successExpiresAt)}
            </strong>
          </p>
          <p className="premium-modal__success-footnote">
            Sasa unaweza kutazama channel zote live muda wote. Kumbuka kulipia
            kifurushi chako kabla ya muda kuisha.
          </p>

          <button
            type="button"
            className={`premium-modal__cta-wrap premium-modal__result-cta${finalizingSuccess ? ' premium-modal__cta-disabled' : ''}`}
            disabled={finalizingSuccess}
            onClick={() => void handleContinue()}
          >
            <span className="premium-modal__cta-gradient">
              {finalizingSuccess ? (
                <LoadingSpinner dark />
              ) : (
                <span className="premium-modal__cta-text">ENDELEA</span>
              )}
            </span>
          </button>
        </div>
      )
    }

    return (
      <div className="premium-modal__result-wrap">
        <div className="premium-modal__fail-icon-halo">
          <div className="premium-modal__fail-icon-circle">
            <PremiumIcon name="alert" className="premium-modal__icon premium-modal__icon--fail" />
          </div>
        </div>

        <h2 className="premium-modal__fail-title">Malipo hayajakamilika</h2>
        <p className="premium-modal__fail-body">{failureReason}</p>

        <button
          type="button"
          className="premium-modal__cta-wrap premium-modal__result-cta"
          onClick={handleRetry}
        >
          <span className="premium-modal__cta-gradient">
            <span className="premium-modal__cta-text">JARIBU TENA</span>
          </span>
        </button>

        <button
          type="button"
          className="premium-modal__cancel-btn premium-modal__result-secondary"
          onClick={onClose}
        >
          <span className="premium-modal__cancel-btn-text">FUNGA</span>
        </button>
      </div>
    )
  }

  if (!visible) {
    return null
  }

  return (
    <div
      className={`premium-modal premium-modal--step-${step}`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="premium-modal__backdrop"
        aria-label="Close premium modal"
        onClick={onClose}
      />

      <div className={`premium-modal__sheet${compactResultStep ? ' premium-modal__sheet--compact-result' : ''}`}>
        <div className={`premium-modal__sheet-safe${step === 2 ? ' premium-modal__sheet-safe--compact-bottom' : ''}`}>
          <div className="premium-modal__sheet-body">
            <div
              className={`premium-modal__modal-scroll${
                step === 2
                  ? ' premium-modal__modal-scroll--step2-centered'
                  : compactResultStep
                    ? ' premium-modal__modal-scroll--compact-result'
                    : ' premium-modal__modal-scroll--default'
              }`}
            >
              <div className="premium-modal__handle-bar" />
              <div
                key={step}
                className={`premium-modal__animated-step${step === 2 ? ' premium-modal__animated-step--fill' : ''}`}
              >
                {renderStepContent()}
              </div>
            </div>

            <div
              className="premium-modal__cta-dock"
              aria-hidden={step !== 1 && step !== 3}
            >
              {step === 1 ? (
                <button
                  type="button"
                  className={`premium-modal__cta-wrap premium-modal__cta-dock-btn${!selectedPlan || plansLoading ? ' premium-modal__cta-disabled' : ''}`}
                  disabled={!selectedPlan || plansLoading}
                  onClick={() => setStep(2)}
                >
                  <span className="premium-modal__cta-gradient">
                    <span className="premium-modal__cta-text">
                      Lipia — {selectedAmountDisplay}
                    </span>
                  </span>
                </button>
              ) : null}

              {step === 3 ? (
                <button
                  type="button"
                  className="premium-modal__cancel-btn premium-modal__cta-dock-btn"
                  onClick={onClose}
                >
                  <span className="premium-modal__cancel-btn-text">GHAIRI</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
