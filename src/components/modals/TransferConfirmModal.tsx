import { useState } from 'react'
import { respondToTransfer } from '../../services/api/subscriptionService'

export type TransferConfirmEvent = {
  key: number
  code: string | null
  targetLabel: string
}

type TransferConfirmModalProps = {
  event: TransferConfirmEvent | null
  onDismiss?: () => void
  onResponded?: () => Promise<void> | void
}

function TransferConfirmIcon() {
  return (
    <svg
      className="transfer-confirm-modal__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M5 8.5h11.5m0 0-3-3m3 3-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 15.5H7.5m0 0 3 3m-3-3 3-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LoadingSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`transfer-confirm-modal__spinner${dark ? ' transfer-confirm-modal__spinner--dark' : ''}`}
      aria-hidden="true"
    />
  )
}

export function TransferConfirmModal({
  event,
  onDismiss,
  onResponded,
}: TransferConfirmModalProps) {
  const [busy, setBusy] = useState<'approve' | 'reject' | ''>('')
  const [error, setError] = useState('')

  if (!event) {
    return null
  }

  const currentEvent = event

  async function respond(decision: 'approve' | 'reject') {
    if (!currentEvent.code) {
      onDismiss?.()
      return
    }

    try {
      setBusy(decision)
      setError('')
      await respondToTransfer(currentEvent.code, decision)
      await onResponded?.()
      onDismiss?.()
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : String(nextError ?? 'unknown_error'),
      )
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="transfer-confirm-modal" role="dialog" aria-modal="true">
      <div className="transfer-confirm-modal__backdrop">
        <div className="transfer-confirm-modal__card">
          <div className="transfer-confirm-modal__icon-wrap">
            <TransferConfirmIcon />
          </div>

          <h2 className="transfer-confirm-modal__title">Hamisha Kifurushi?</h2>

          <p className="transfer-confirm-modal__body">
            Kuna ombi la kuhamisha kifurushi chako kwenda{' '}
            <strong className="transfer-confirm-modal__body-bold">
              {currentEvent.targetLabel}
            </strong>
            . Ukikubali, kifaa hiki kitapoteza ufikiaji wa channel za kulipia
            mara moja.
          </p>

          {currentEvent.code ? (
            <p className="transfer-confirm-modal__code-label">
              Code:{' '}
              <span className="transfer-confirm-modal__code-value">
                {currentEvent.code}
              </span>
            </p>
          ) : null}

          {error ? <p className="transfer-confirm-modal__error">{error}</p> : null}

          <div className="transfer-confirm-modal__row">
            <button
              type="button"
              className={`transfer-confirm-modal__btn transfer-confirm-modal__btn--reject${busy ? ' transfer-confirm-modal__btn--disabled' : ''}`}
              disabled={busy !== ''}
              onClick={() => void respond('reject')}
            >
              {busy === 'reject' ? (
                <LoadingSpinner />
              ) : (
                <span className="transfer-confirm-modal__reject-text">KATAA</span>
              )}
            </button>

            <button
              type="button"
              className={`transfer-confirm-modal__btn transfer-confirm-modal__btn--approve${busy ? ' transfer-confirm-modal__btn--disabled' : ''}`}
              disabled={busy !== ''}
              onClick={() => void respond('approve')}
            >
              {busy === 'approve' ? (
                <LoadingSpinner dark />
              ) : (
                <span className="transfer-confirm-modal__approve-text">KUBALI</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
