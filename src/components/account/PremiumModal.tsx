import { useEffect, useMemo, useRef, useState } from 'react'
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
  if (!value) {
    return '(-)'
  }

  const match = value.match(/\d+/)
  return match ? `(${match[0]} siku)` : `(${value})`
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
  const [failureReason, setFailureReason] = useState('')
  const [successExpiresAt, setSuccessExpiresAt] = useState<string | null>(null)
  const [finalizingSuccess, setFinalizingSuccess] = useState(false)
  const [providers, setProviders] = useState<PaymentProvider[]>([])
  const pollingDoneRef = useRef(false)

  const selectedAmountDisplay = selectedPlan
    ? `TSh ${formatPriceTz(selectedPlan.price)}`
    : 'TSh 0'

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
        setSelectedPlan(nextPlans[0] ?? null)
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
        if (!cancelled) {
          setProviders(liveProviders)
        }
      } catch {
        if (!cancelled) {
          setProviders([])
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
            setFailureReason(result.reason || 'Jaribu tena baadae.')
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

  const handleStartPayment = async () => {
    if (!selectedPlan || !phoneNumber.trim() || submitting) {
      return
    }

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

      setOrderId(payment.orderId)
      setRemainingSeconds(payment.expiresInSeconds ?? 0)
      setStep(3)
    } catch (error) {
      setFailureReason(error instanceof Error ? error.message : 'Malipo yameshindikana.')
      setStep(5)
    } finally {
      setSubmitting(false)
    }
  }

  const modalClass = `premium-modal premium-modal--step-${step}`

  const body = useMemo(() => {
    if (step === 1) {
      return (
        <>
          <div className="premium-modal__handle" />
          <div className="premium-modal__crown">
            <div className="premium-modal__crown-glow" />
            <div className="premium-modal__crown-circle">C</div>
          </div>
          <h2 className="premium-modal__title-center">Karibu Osman TV</h2>
          <p className="premium-modal__subtitle-center">
            {channelName} ni channel ya premium
          </p>

          {plansLoading ? (
            <div className="premium-modal__spinner">Inapakia...</div>
          ) : null}
          {plansError ? <p className="premium-modal__error">{plansError}</p> : null}
          {!plansLoading && !plansError && plans.length === 0 ? (
            <p className="premium-modal__muted-center">
              Hakuna mipango inayopatikana kwa sasa.
            </p>
          ) : null}

          <div className="premium-modal__plans">
            {plans.map((plan) => {
              const selected = selectedPlan?.id === plan.id
              return (
                <button
                  type="button"
                  key={plan.id}
                  className={`premium-modal__plan${
                    selected ? ' premium-modal__plan--selected' : ''
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <span
                    className={`premium-modal__radio${
                      selected ? ' premium-modal__radio--selected' : ''
                    }`}
                  >
                    {selected ? <span /> : null}
                  </span>
                  <span className="premium-modal__plan-text">
                    <strong>{plan.name}</strong>
                    <small>{formatPlanDuration(plan.duration)}</small>
                    <em>TSh {formatPriceTz(plan.price)}</em>
                  </span>
                  {selected ? <span className="premium-modal__plan-badge">OK</span> : null}
                </button>
              )
            })}
          </div>

          <div className="premium-modal__benefits">
            {BENEFITS.map((line) => (
              <div className="premium-modal__benefit" key={line}>
                <span>OK</span>
                <p>{line}</p>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (step === 2) {
      return (
        <>
          <div className="premium-modal__title-row">
            <div className="premium-modal__title-icon">$</div>
            <h2 className="premium-modal__title">Weka Namba ya Simu</h2>
          </div>
          <p className="premium-modal__subtitle">
            Tigo, M-Pesa, Airtel, HaloPesa
          </p>

          <label className="premium-modal__networks-label">
            Mitandao inayokubaliwa
          </label>
          <div className="premium-modal__networks">
            {providers.map((provider) => (
              <div className="premium-modal__network" key={provider.id}>
                <div className="premium-modal__network-icon">
                  {provider.logoUrl ? (
                    <img src={provider.logoUrl} alt={provider.name} />
                  ) : (
                    <span>{provider.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <strong>{provider.name}</strong>
              </div>
            ))}
          </div>

          <div className="premium-modal__input-wrap">
            <span>$</span>
            <input
              className="premium-modal__input"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Ingiza namba ya simu"
              inputMode="tel"
            />
          </div>
        </>
      )
    }

    if (step === 3) {
      return (
        <>
          <div className="premium-modal__ring" />
          <h2 className="premium-modal__title-center">
            Inasubiri uthibitisho wa malipo
          </h2>
          <p className="premium-modal__subtitle-center">
            Thibitisha malipo kwenye simu yako (PIN).
          </p>
          <div className="premium-modal__status-box">
            <strong>{selectedAmountDisplay}</strong>
            <span>{remainingSeconds > 0 ? formatCountdown(remainingSeconds) : '--:--'}</span>
            {orderId ? (
              <small>
                Order ID
                <b>{orderId}</b>
              </small>
            ) : null}
          </div>
        </>
      )
    }

    if (step === 4) {
      return (
        <>
          <div className="premium-modal__result premium-modal__result--success">OK</div>
          <h2 className="premium-modal__title-center">Malipo yamefanikiwa</h2>
          <p className="premium-modal__subtitle-center">
            Kifurushi chako kinaisha:{' '}
            <strong>{formatSubscriptionExpiry(successExpiresAt)}</strong>
          </p>
          <p className="premium-modal__result-copy">
            Sasa unaweza kutazama channel zote live muda wote. Kumbuka kulipia
            kifurushi chako kabla ya muda kuisha.
          </p>
        </>
      )
    }

    return (
      <>
        <div className="premium-modal__result premium-modal__result--fail">X</div>
        <h2 className="premium-modal__title-center">Malipo hayajakamilika</h2>
        <p className="premium-modal__subtitle-center">{failureReason}</p>
      </>
    )
  }, [
    channelName,
    failureReason,
    orderId,
    phoneNumber,
    plans,
    plansError,
    plansLoading,
    providers,
    remainingSeconds,
    selectedAmountDisplay,
    selectedPlan,
    step,
    successExpiresAt,
  ])

  if (!visible) {
    return null
  }

  return (
    <div className={modalClass} role="dialog" aria-modal="true">
      <button
        type="button"
        className="premium-modal__backdrop"
        aria-label="Close premium modal"
        onClick={onClose}
      />
      <div className="premium-modal__sheet">
        {body}

        <div className="premium-modal__footer">
          {step === 1 ? (
            <button
              type="button"
              className={`premium-modal__cta${!selectedPlan ? ' premium-modal__cta--disabled' : ''}`}
              disabled={!selectedPlan}
              onClick={() => setStep(2)}
            >
              Lipia - {selectedAmountDisplay}
            </button>
          ) : null}

          {step === 2 ? (
            <button
              type="button"
              className={`premium-modal__cta${
                !phoneNumber.trim() || submitting ? ' premium-modal__cta--disabled' : ''
              }`}
              disabled={!phoneNumber.trim() || submitting}
              onClick={() => void handleStartPayment()}
            >
              {submitting ? 'Inatuma...' : 'LIPIA SASA'}
            </button>
          ) : null}

          {step === 3 ? (
            <button
              type="button"
              className="premium-modal__secondary"
              onClick={onClose}
            >
              GHAIRI
            </button>
          ) : null}

          {step === 4 ? (
            <button
              type="button"
              className="premium-modal__cta"
              onClick={async () => {
                setFinalizingSuccess(true)
                await onUnlockSuccess?.()
                setFinalizingSuccess(false)
                onClose()
              }}
            >
              {finalizingSuccess ? 'Inafunga...' : 'ENDELEA'}
            </button>
          ) : null}

          {step === 5 ? (
            <>
              <button
                type="button"
                className="premium-modal__cta"
                onClick={() => {
                  setFailureReason('')
                  setStep(2)
                }}
              >
                JARIBU TENA
              </button>
              <button
                type="button"
                className="premium-modal__secondary"
                onClick={onClose}
              >
                FUNGA
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
