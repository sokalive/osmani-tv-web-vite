type SubscriptionExpiryReminderModalProps = {
  visible: boolean
  displayDays: number
  onRenew: () => void
  onDismissLater: () => void
}

export function SubscriptionExpiryReminderModal({
  visible,
  displayDays,
  onRenew,
  onDismissLater,
}: SubscriptionExpiryReminderModalProps) {
  const days = Math.min(2, Math.max(1, Number(displayDays) || 1))

  if (!visible) {
    return null
  }

  return (
    <div className="subscription-expiry-modal" role="dialog" aria-modal="true">
      <div className="subscription-expiry-modal__overlay">
        <button
          type="button"
          className="subscription-expiry-modal__backdrop"
          aria-label="Dismiss reminder"
          onClick={onDismissLater}
        />
        <div className="subscription-expiry-modal__centered-wrap">
          <div className="subscription-expiry-modal__sheet">
            <div className="subscription-expiry-modal__scroll-inner">
              <div className="subscription-expiry-modal__handle-bar" />
              <p className="subscription-expiry-modal__body">
                Kifurushi chako kimebakiza siku {days} kuisha. Tafadhali lipia
                kifurushi chako kabla ya muda kuisha.
              </p>
              <button
                type="button"
                className="subscription-expiry-modal__cta-wrap"
                onClick={onRenew}
              >
                <span className="subscription-expiry-modal__cta-gradient">
                  <span className="subscription-expiry-modal__cta-text">
                    LIPIA TENA
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="subscription-expiry-modal__secondary-btn"
                onClick={onDismissLater}
              >
                <span className="subscription-expiry-modal__secondary-btn-text">
                  SIKU NYINGINE
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
