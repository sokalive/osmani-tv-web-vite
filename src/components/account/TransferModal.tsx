import { useEffect, useMemo, useState } from 'react'
import {
  getTransferStatus,
  initiateTransfer,
  redeemTransfer,
} from '../../services/api/subscriptionService'
import { getDeviceIdentity } from '../../services/auth/deviceIdentity'

type TransferModalProps = {
  visible: boolean
  onClose: () => void
  onTransferSuccess?: () => Promise<void> | void
  initialStep?: 'intro' | 'redeem'
}

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function normalizePhone(raw: string) {
  return String(raw || '').replace(/[^\d]/g, '').slice(0, 10)
}

function TransferModalIcon({
  kind,
  className,
}: {
  kind:
    | 'close'
    | 'call'
    | 'keypad'
    | 'unlock'
    | 'hourglass'
    | 'checkmark'
    | 'reject'
    | 'copy'
  className?: string
}) {
  if (kind === 'close') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 6 18 18M18 6 6 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (kind === 'call') {
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

  if (kind === 'keypad') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="6"
          y="4"
          width="12"
          height="16"
          rx="2.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="9.2" cy="8.3" r="1.1" fill="currentColor" />
        <circle cx="12" cy="8.3" r="1.1" fill="currentColor" />
        <circle cx="14.8" cy="8.3" r="1.1" fill="currentColor" />
        <circle cx="9.2" cy="11.8" r="1.1" fill="currentColor" />
        <circle cx="12" cy="11.8" r="1.1" fill="currentColor" />
        <circle cx="14.8" cy="11.8" r="1.1" fill="currentColor" />
        <circle cx="9.2" cy="15.4" r="1.1" fill="currentColor" />
        <circle cx="12" cy="15.4" r="1.1" fill="currentColor" />
        <circle cx="14.8" cy="15.4" r="1.1" fill="currentColor" />
      </svg>
    )
  }

  if (kind === 'unlock') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="5"
          y="10"
          width="14"
          height="10"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M8 10V8a4 4 0 1 1 8 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (kind === 'hourglass') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 4h8M8 20h8M8 4c0 3 2 4.5 4 6 2-1.5 4-3 4-6M8 20c0-3 2-4.5 4-6 2 1.5 4 3 4 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === 'checkmark') {
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

  if (kind === 'reject') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 7 17 17M17 7 7 17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="6"
        y="7"
        width="12"
        height="13"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 7V5h6v2M9.5 12h5M9.5 15h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LoadingSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`transfer-modal__spinner-circle${dark ? ' transfer-modal__spinner-circle--dark' : ''}`}
      aria-hidden="true"
    />
  )
}

export function TransferModal({
  visible,
  onClose,
  onTransferSuccess,
  initialStep = 'intro',
}: TransferModalProps) {
  const [step, setStep] = useState<
    'intro' | 'phone' | 'generated' | 'redeem' | 'waiting' | 'redeemed' | 'rejected'
  >(initialStep)
  const [phone, setPhone] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [code, setCode] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [copyNotice, setCopyNotice] = useState('')

  useEffect(() => {
    if (!visible || step !== 'generated' || remainingSeconds <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1))
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [remainingSeconds, step, visible])

  useEffect(() => {
    if (!visible || step !== 'waiting' || !code.trim()) {
      return
    }

    const timer = window.setInterval(() => {
      void (async () => {
        const status = await getTransferStatus(code)
        if (status.pending) {
          return
        }

        if (status.status.toLowerCase().includes('reject')) {
          setRejectionReason('Mtumiaji wa simu ya zamani amekataa ombi la uhamisho.')
          setStep('rejected')
          return
        }

        await onTransferSuccess?.()
        setStep('redeemed')
      })()
    }, 5000)

    return () => {
      window.clearInterval(timer)
    }
  }, [code, onTransferSuccess, step, visible])

  useEffect(() => {
    if (!copyNotice) {
      return
    }

    const timer = window.setTimeout(() => setCopyNotice(''), 2200)
    return () => {
      window.clearTimeout(timer)
    }
  }, [copyNotice])

  const introBullets = useMemo(
    () => [
      'Bonyeza [ ENDELEA KUHAMISHA ]',
      'Weka namba uliyolipia nayo',
      'Utapokea code za kuhamisha',
      'Fungua simu mpya',
      'Chagua "Nina code tayari"',
      'Weka code zako kukamilisha uhamisho ✅',
    ],
    [],
  )
  const isPhoneValid = /^0[67]\d{8}$/.test(phone)
  const isRedeemCodeValid = /^\d{6}$/.test(code.trim())

  if (!visible) {
    return null
  }

  return (
    <div className="transfer-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="transfer-modal__backdrop"
        aria-label="Close transfer modal"
        onClick={onClose}
      />
      <div className="transfer-modal__center-content">
        <div
          className="transfer-modal__card-hit-area"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="transfer-modal__card">
            <button
              type="button"
              className="transfer-modal__close"
              aria-label="Close"
              onClick={onClose}
            >
              <TransferModalIcon kind="close" className="transfer-modal__close-icon" />
            </button>

        {step === 'intro' ? (
          <div className="transfer-modal__step transfer-modal__step--intro">
            <h2 className="transfer-modal__step-title transfer-modal__step-title--intro">
              HAMISHA KIFURUSHI
            </h2>
            <div className="transfer-modal__intro-mid-scroll">
              <div className="transfer-modal__intro-mid-scroll-content">
                <p className="transfer-modal__intro-body">
                  Unaweza kuhamisha kifurushi chako kwenda kwenye simu nyingine.
                  Simu ya sasa itapoteza kifurushi baada ya kuhamisha.
                </p>
                <strong className="transfer-modal__intro-section-heading">
                  JINSI YA KUHAMISHA
                </strong>
                <div className="transfer-modal__bullets">
                  {introBullets.map((item, index) => (
                    <p
                      key={item}
                      className={`transfer-modal__intro-bullet${
                        index === introBullets.length - 1
                          ? ' transfer-modal__intro-bullet--last'
                          : ''
                      }`}
                    >
                      • {item}
                    </p>
                  ))}
                </div>
                {error ? <p className="transfer-modal__error">{error}</p> : null}
              </div>
            </div>
            <button
              type="button"
              className="transfer-modal__primary-wrap transfer-modal__actions-block-intro"
              onClick={() => {
                setError('')
                setStep('phone')
              }}
            >
              <span className="transfer-modal__primary-gradient">
                <span className="transfer-modal__primary-text">
                  ENDELEA KUHAMISHA
                </span>
              </span>
            </button>
          </div>
        ) : null}

        {step === 'phone' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__icon-halo-small">
              <div className="transfer-modal__icon-circle-small">
                <TransferModalIcon
                  kind="call"
                  className="transfer-modal__step-icon transfer-modal__step-icon--dark"
                />
              </div>
            </div>
            <h2 className="transfer-modal__step-title">Hamisha Kifurushi</h2>
            <p className="transfer-modal__desc-center">
              Weka namba ya simu uliyolipia kifurushi.
              <br />
              Tutakutumia code ya kuhamisha.
            </p>
            <input
              className="transfer-modal__phone-input"
              value={phone}
              onChange={(event) => {
                setError('')
                setPhone(normalizePhone(event.target.value))
              }}
              placeholder="06XXXXXXXX au 07XXXXXXXX"
              inputMode="tel"
              maxLength={10}
            />
            {error ? <p className="transfer-modal__error">{error}</p> : null}
            <div className="transfer-modal__actions-block-step">
              <button
                type="button"
                className={`transfer-modal__primary-wrap${
                  !isPhoneValid || busy ? ' transfer-modal__btn-disabled' : ''
                }`}
                disabled={!isPhoneValid || busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const { deviceId, deviceFingerprint } = await getDeviceIdentity()
                    const result = await initiateTransfer(deviceId, deviceFingerprint, phone)
                    setGeneratedCode(result.code)
                    const expiresMs = result.expiresAt ? Date.parse(result.expiresAt) : NaN
                    setRemainingSeconds(
                      Number.isFinite(expiresMs)
                        ? Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000))
                        : 120,
                    )
                    setStep('generated')
                  } catch (nextError) {
                    setError(
                      nextError instanceof Error
                        ? nextError.message
                        : 'Weka namba sahihi ya simu.',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <span className="transfer-modal__primary-gradient">
                  {busy ? (
                    <LoadingSpinner dark />
                  ) : (
                    <span className="transfer-modal__primary-text">PATA CODE</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="transfer-modal__secondary"
                onClick={() => {
                  setError('')
                  setStep('redeem')
                }}
              >
                Nina code tayari
              </button>
            </div>
          </div>
        ) : null}

        {step === 'generated' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__icon-halo-small">
              <div className="transfer-modal__icon-circle-small">
                <TransferModalIcon
                  kind="keypad"
                  className="transfer-modal__step-icon transfer-modal__step-icon--dark"
                />
              </div>
            </div>
            <h2 className="transfer-modal__step-title">Code ya Uhamisho</h2>
            <p className="transfer-modal__desc-center">
              Tumia code hii kwenye simu nyingine.
              <br />
              Code itaisha baada ya dakika 2.
            </p>
            <div className="transfer-modal__code-box">
              <span className="transfer-modal__code-text">
                {generatedCode}
              </span>
            </div>
            <button
              type="button"
              className="transfer-modal__copy"
              onClick={async () => {
                await navigator.clipboard.writeText(generatedCode)
                setCopyNotice('Code imenakiliwa')
              }}
            >
              <TransferModalIcon kind="copy" className="transfer-modal__copy-icon" />
              <span className="transfer-modal__copy-text">Nakili Code</span>
            </button>
            {copyNotice ? (
              <p className="transfer-modal__copy-notice">{copyNotice}</p>
            ) : null}
            <label className="transfer-modal__countdown-label">Muda uliobaki</label>
            <strong className="transfer-modal__timer">
              {formatTimer(remainingSeconds)}
            </strong>
            {remainingSeconds <= 0 ? (
              <p className="transfer-modal__error">
                Code imeisha muda. Tengeneza code mpya.
              </p>
            ) : null}
            <div className="transfer-modal__actions-block-step">
              <button
                type="button"
                className="transfer-modal__primary-wrap"
                onClick={onClose}
              >
                <span className="transfer-modal__primary-gradient">
                  <span className="transfer-modal__primary-text">
                    THIBITISHA UHAMISHO
                  </span>
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {step === 'redeem' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__icon-halo-small">
              <div className="transfer-modal__icon-circle-small">
                <TransferModalIcon
                  kind="unlock"
                  className="transfer-modal__step-icon transfer-modal__step-icon--dark"
                />
              </div>
            </div>
            <h2 className="transfer-modal__step-title">Weka Code</h2>
            <p className="transfer-modal__desc-center">
              Weka code ya tarakimu 6 uliyoipata kutoka simu ya zamani.
            </p>
            <input
              className="transfer-modal__code-input"
              value={code}
              onChange={(event) => {
                setError('')
                setCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))
              }}
              inputMode="numeric"
              placeholder="000000"
            />
            {error ? <p className="transfer-modal__error">{error}</p> : null}
            <div className="transfer-modal__actions-block-step">
              <button
                type="button"
                className={`transfer-modal__primary-wrap${
                  !isRedeemCodeValid || busy ? ' transfer-modal__btn-disabled' : ''
                }`}
                disabled={!isRedeemCodeValid || busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const { deviceId, deviceFingerprint } = await getDeviceIdentity()
                    const result = await redeemTransfer(code, deviceId, deviceFingerprint)
                    if (result.status === 'pending') {
                      setStep('waiting')
                      return
                    }
                    if (result.status === 'approved' || result.active) {
                      await onTransferSuccess?.()
                      setStep('redeemed')
                      return
                    }
                    setError('Code haijafanikiwa. Hakikisha umeingiza code sahihi.')
                  } catch (nextError) {
                    setError(
                      nextError instanceof Error
                        ? nextError.message
                        : 'Code haijafanikiwa.',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <span className="transfer-modal__primary-gradient">
                  {busy ? (
                    <LoadingSpinner dark />
                  ) : (
                    <span className="transfer-modal__primary-text">
                      THIBITISHA UHAMISHO
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="transfer-modal__secondary"
                onClick={() => {
                  setError('')
                  setStep('phone')
                }}
              >
                Rudi nyuma
              </button>
            </div>
          </div>
        ) : null}

        {step === 'waiting' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__icon-halo-small">
              <div className="transfer-modal__icon-circle-small">
                <TransferModalIcon
                  kind="hourglass"
                  className="transfer-modal__step-icon transfer-modal__step-icon--dark"
                />
              </div>
            </div>
            <h2 className="transfer-modal__step-title">Subiri Uthibitisho</h2>
            <p className="transfer-modal__desc-center">
              Tunasubiri uthibitisho kutoka kwenye simu yenye kifurushi...
            </p>
            <div className="transfer-modal__waiting-spinner-wrap">
              <LoadingSpinner />
            </div>
            <small className="transfer-modal__waiting-hint">
              Mwombe mtumiaji wa simu ya zamani akubali ombi la uhamisho.
            </small>
            <div className="transfer-modal__actions-block-step">
              <button type="button" className="transfer-modal__secondary" onClick={onClose}>
                Funga
              </button>
            </div>
          </div>
        ) : null}

        {step === 'redeemed' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__success-circle">
              <TransferModalIcon
                kind="checkmark"
                className="transfer-modal__result-icon transfer-modal__result-icon--dark"
              />
            </div>
            <h2 className="transfer-modal__step-title">Umefanikiwa</h2>
            <p className="transfer-modal__desc-center">
              Kifurushi kimehamishwa kwenye simu hii. Sasa unaweza kutazama
              channel zote za kulipia.
            </p>
            <div className="transfer-modal__actions-block">
              <button type="button" className="transfer-modal__primary-wrap" onClick={onClose}>
                <span className="transfer-modal__primary-gradient">
                  <span className="transfer-modal__primary-text">SAWA</span>
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {step === 'rejected' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__reject-circle">
              <TransferModalIcon
                kind="reject"
                className="transfer-modal__result-icon transfer-modal__result-icon--light"
              />
            </div>
            <h2 className="transfer-modal__step-title">Uhamisho Umekataliwa</h2>
            <p className="transfer-modal__desc-center">
              {rejectionReason ||
                'Mtumiaji wa simu ya zamani amekataa ombi la uhamisho.'}
            </p>
            <div className="transfer-modal__actions-block-step">
              <button
                type="button"
                className="transfer-modal__primary-wrap"
                onClick={() => {
                  setError('')
                  setRejectionReason('')
                  setCode('')
                  setStep('redeem')
                }}
              >
                <span className="transfer-modal__primary-gradient">
                  <span className="transfer-modal__primary-text">JARIBU TENA</span>
                </span>
              </button>
              <button type="button" className="transfer-modal__secondary" onClick={onClose}>
                Funga
              </button>
            </div>
          </div>
        ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
