type TransferredAwayReason = 'transferred' | 'revoked' | 'expired'

type TransferredAwayModalProps = {
  visible: boolean
  reason?: TransferredAwayReason
  onOpenPlans: () => void
  onRecover: () => void
  recovering?: boolean
}

function LockIcon() {
  return (
    <svg
      className="transferred-away-modal__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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
        d="M8 10V7.8A4 4 0 0 1 12 4a4 4 0 0 1 4 3.8V10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LoadingSpinner() {
  return <span className="transferred-away-modal__spinner" aria-hidden="true" />
}

export function TransferredAwayModal({
  visible,
  reason = 'transferred',
  onOpenPlans,
  onRecover,
  recovering = false,
}: TransferredAwayModalProps) {
  const title =
    reason === 'transferred'
      ? 'Kifurushi kimehamishwa'
      : reason === 'revoked'
        ? 'Kifurushi kimezuiwa'
        : 'Kifurushi kimekwisha'

  const body =
    reason === 'transferred'
      ? 'Kifurushi chako kimehamishwa kwenda kifaa kingine. Hauwezi tena kutazama channel za kulipia kwenye simu hii hadi ulipie tena au urudishe kifurushi.'
      : reason === 'revoked'
        ? 'Admin amesimamisha ufikiaji wa kifurushi chako. Tafadhali wasiliana na admin au lipia tena ili kuendelea.'
        : 'Kifurushi chako kimekwisha. Lipia tena au rudisha kifurushi ili kuendelea kutazama.'

  if (!visible) {
    return null
  }

  return (
    <div className="transferred-away-modal" role="dialog" aria-modal="true">
      <div className="transferred-away-modal__backdrop">
        <div className="transferred-away-modal__card">
          <div className="transferred-away-modal__icon-wrap">
            <LockIcon />
          </div>
          <h2 className="transferred-away-modal__title">{title}</h2>
          <p className="transferred-away-modal__body">{body}</p>
          <button
            type="button"
            className="transferred-away-modal__primary-wrap"
            onClick={onOpenPlans}
            aria-label="Lipia tena"
          >
            <span className="transferred-away-modal__primary-gradient">
              <span className="transferred-away-modal__primary-text">
                LIPIA TENA
              </span>
            </span>
          </button>
          <button
            type="button"
            className={`transferred-away-modal__secondary-btn${recovering ? ' transferred-away-modal__disabled' : ''}`}
            onClick={onRecover}
            disabled={recovering}
            aria-label="Rejesha kifurushi"
          >
            {recovering ? (
              <LoadingSpinner />
            ) : (
              <span className="transferred-away-modal__secondary-text">
                Rejesha kifurushi
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export type { TransferredAwayReason }
