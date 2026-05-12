const MESSAGE =
  'Hitilafu imetokea. Timu yetu ya ufundi inaishughulikia. Tafadhali jaribu tena baadaye.'

type EmergencyModalProps = {
  visible: boolean
  onSawa: () => void
}

function WarningIcon() {
  return (
    <svg
      className="emergency-modal__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M12 4.5 3.8 19h16.4L12 4.5Z"
        fill="currentColor"
      />
      <path
        d="M12 9.1v4.8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.1" fill="#FFFFFF" />
    </svg>
  )
}

export function EmergencyModal({ visible, onSawa }: EmergencyModalProps) {
  if (!visible) {
    return null
  }

  return (
    <div className="emergency-modal" role="dialog" aria-modal="true">
      <div className="emergency-modal__backdrop">
        <div className="emergency-modal__card">
          <div className="emergency-modal__icon-wrap">
            <WarningIcon />
          </div>
          <p className="emergency-modal__message">{MESSAGE}</p>
          <button
            type="button"
            className="emergency-modal__button"
            onClick={onSawa}
          >
            <span className="emergency-modal__button-label">Sawa</span>
          </button>
        </div>
      </div>
    </div>
  )
}
