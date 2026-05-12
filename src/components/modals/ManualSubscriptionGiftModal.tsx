import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type ManualSubscriptionGiftModalProps = {
  visible: boolean
  busy?: boolean
  onAcknowledge: () => void | Promise<void>
}

function LoadingSpinner() {
  return <span className="manual-gift-modal__spinner" aria-hidden="true" />
}

export function ManualSubscriptionGiftModal({
  visible,
  busy = false,
  onAcknowledge,
}: ManualSubscriptionGiftModalProps) {
  useBodyScrollLock(visible)

  if (!visible) {
    return null
  }

  return (
    <div className="manual-gift-modal" role="dialog" aria-modal="true">
      <div className="manual-gift-modal__overlay">
        <div className="manual-gift-modal__touch-blocker" aria-hidden="true" />
        <div className="manual-gift-modal__centered-wrap">
          <div className="manual-gift-modal__sheet">
            <div className="manual-gift-modal__scroll-inner">
              <div className="manual-gift-modal__handle-bar" />
              <h2 className="manual-gift-modal__title">Hongera!</h2>
              <p className="manual-gift-modal__body">
                Umepokea kifurushi cha Ofa kutoka kwa Muhudumu Wetu. Sasa Unaweza
                Kutazama Channel Zote Bureee Kuanzia sasa🥳.
              </p>
              <button
                type="button"
                className={`manual-gift-modal__cta-wrap${busy ? ' manual-gift-modal__cta-disabled' : ''}`}
                onClick={() => void onAcknowledge()}
                disabled={busy}
              >
                <span className="manual-gift-modal__cta-gradient">
                  {busy ? (
                    <LoadingSpinner />
                  ) : (
                    <span className="manual-gift-modal__cta-text">ASANTE</span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
