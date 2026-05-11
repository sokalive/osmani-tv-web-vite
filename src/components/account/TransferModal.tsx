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
}

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function TransferModal({
  visible,
  onClose,
  onTransferSuccess,
}: TransferModalProps) {
  const [step, setStep] = useState<
    'intro' | 'phone' | 'generated' | 'redeem' | 'waiting' | 'redeemed' | 'rejected'
  >('intro')
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
      'Weka code zako kukamilisha uhamisho',
    ],
    [],
  )

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
      <div className="transfer-modal__card">
        <button
          type="button"
          className="transfer-modal__close"
          aria-label="Close"
          onClick={onClose}
        >
          X
        </button>

        {step === 'intro' ? (
          <div className="transfer-modal__step transfer-modal__step--intro">
            <h2>HAMISHA KIFURUSHI</h2>
            <p>
              Unaweza kuhamisha kifurushi chako kwenda kwenye simu nyingine.
              Simu ya sasa itapoteza kifurushi baada ya kuhamisha.
            </p>
            <strong>JINSI YA KUHAMISHA</strong>
            <div className="transfer-modal__bullets">
              {introBullets.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
            {error ? <p className="transfer-modal__error">{error}</p> : null}
            <button
              type="button"
              className="transfer-modal__primary"
              onClick={() => {
                setError('')
                setStep('phone')
              }}
            >
              ENDELEA KUHAMISHA
            </button>
          </div>
        ) : null}

        {step === 'phone' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__icon">^</div>
            <h2>Hamisha Kifurushi</h2>
            <p>
              Weka namba ya simu uliyolipia kifurushi.
              <br />
              Tutakutumia code ya kuhamisha.
            </p>
            <input
              className="transfer-modal__input"
              value={phone}
              onChange={(event) => {
                setError('')
                setPhone(event.target.value.replace(/[^\d]/g, ''))
              }}
              placeholder="Ingiza namba ya simu"
              inputMode="tel"
            />
            {error ? <p className="transfer-modal__error">{error}</p> : null}
            <button
              type="button"
              className={`transfer-modal__primary${busy ? ' transfer-modal__primary--disabled' : ''}`}
              disabled={busy}
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
              {busy ? 'Inatuma...' : 'PATA CODE'}
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
        ) : null}

        {step === 'generated' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__icon">#</div>
            <h2>Code ya Uhamisho</h2>
            <p>
              Tumia code hii kwenye simu nyingine.
              <br />
              Code itaisha baada ya dakika 2.
            </p>
            <div className="transfer-modal__code-box">{generatedCode}</div>
            <button
              type="button"
              className="transfer-modal__copy"
              onClick={async () => {
                await navigator.clipboard.writeText(generatedCode)
                setCopyNotice('Code imenakiliwa')
              }}
            >
              Nakili Code
            </button>
            {copyNotice ? (
              <p className="transfer-modal__copy-notice">{copyNotice}</p>
            ) : null}
            <label>Muda uliobaki</label>
            <strong className="transfer-modal__timer">
              {formatTimer(remainingSeconds)}
            </strong>
            {remainingSeconds <= 0 ? (
              <p className="transfer-modal__error">
                Code imeisha muda. Tengeneza code mpya.
              </p>
            ) : null}
            <button
              type="button"
              className="transfer-modal__primary"
              onClick={onClose}
            >
              THIBITISHA UHAMISHO
            </button>
          </div>
        ) : null}

        {step === 'redeem' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__icon">*</div>
            <h2>Weka Code</h2>
            <p>Weka code ya tarakimu 6 uliyoipata kutoka simu ya zamani.</p>
            <input
              className="transfer-modal__input transfer-modal__input--code"
              value={code}
              onChange={(event) => {
                setError('')
                setCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))
              }}
              inputMode="numeric"
              placeholder="000000"
            />
            {error ? <p className="transfer-modal__error">{error}</p> : null}
            <button
              type="button"
              className={`transfer-modal__primary${busy ? ' transfer-modal__primary--disabled' : ''}`}
              disabled={busy}
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
              {busy ? 'Inathibitisha...' : 'THIBITISHA UHAMISHO'}
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
        ) : null}

        {step === 'waiting' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__spinner" />
            <h2>Subiri Uthibitisho</h2>
            <p>Tunasubiri uthibitisho kutoka kwenye simu yenye kifurushi...</p>
            <small>
              Mwombe mtumiaji wa simu ya zamani akubali ombi la uhamisho.
            </small>
            <button type="button" className="transfer-modal__secondary" onClick={onClose}>
              Funga
            </button>
          </div>
        ) : null}

        {step === 'redeemed' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__result transfer-modal__result--success">
              OK
            </div>
            <h2>Umefanikiwa</h2>
            <p>
              Kifurushi kimehamishwa kwenye simu hii. Sasa unaweza kutazama
              channel zote za kulipia.
            </p>
            <button type="button" className="transfer-modal__primary" onClick={onClose}>
              SAWA
            </button>
          </div>
        ) : null}

        {step === 'rejected' ? (
          <div className="transfer-modal__step">
            <div className="transfer-modal__result transfer-modal__result--fail">
              X
            </div>
            <h2>Uhamisho Umekataliwa</h2>
            <p>
              {rejectionReason ||
                'Mtumiaji wa simu ya zamani amekataa ombi la uhamisho.'}
            </p>
            <button
              type="button"
              className="transfer-modal__primary"
              onClick={() => {
                setError('')
                setRejectionReason('')
                setCode('')
                setStep('redeem')
              }}
            >
              JARIBU TENA
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
