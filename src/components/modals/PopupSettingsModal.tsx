import { useMemo, useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import type { PopupSettings } from '../../types/osmani'

const STORAGE_KEY = 'osmani_popup_settings_seen'

type PopupSettingsModalProps = {
  settings: PopupSettings | null
}

function InfoIcon() {
  return (
    <svg
      className="popup-modal__icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 10.25v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.2" r="1.15" fill="currentColor" />
    </svg>
  )
}

export function PopupSettingsModal({ settings }: PopupSettingsModalProps) {
  const [dismissed, setDismissed] = useState(false)

  const bulletPoints = useMemo(
    () => settings?.bulletPoints.filter((item) => item.trim().length > 0) ?? [],
    [settings?.bulletPoints],
  )

  const visible = useMemo(() => {
    if (!settings || dismissed || settings.mode === 'disabled') {
      return false
    }

    if (settings.mode === 'always_show') {
      return true
    }

    return window.localStorage.getItem(STORAGE_KEY) !== '1'
  }, [dismissed, settings])

  useBodyScrollLock(Boolean(settings) && visible)

  if (!settings || !visible) {
    return null
  }

  const close = () => {
    if (settings.mode === 'show_once') {
      window.localStorage.setItem(STORAGE_KEY, '1')
    }
    setDismissed(true)
  }

  return (
    <div className="popup-modal" role="dialog" aria-modal="true">
      <div
        className="popup-modal__backdrop"
        aria-hidden="true"
      />
      <div className="popup-modal__card">
        <div className="popup-modal__icon-wrap">
          <InfoIcon />
        </div>

        <div className="popup-modal__scroll">
          <div className="popup-modal__scroll-inner">
            {settings.title ? (
              <h2 className="popup-modal__title">{settings.title}</h2>
            ) : null}
            {settings.greeting ? (
              <p className="popup-modal__greeting">{settings.greeting}</p>
            ) : null}

            {bulletPoints.length ? (
              <div className="popup-modal__bullets">
                {bulletPoints.map((point, index) => (
                  <div
                    key={`${index}-${point}`}
                    className="popup-modal__bullet-row"
                  >
                    <span className="popup-modal__bullet-dot">&bull;</span>
                    <p className="popup-modal__bullet-text">{point}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {settings.disclaimer ? (
              <div className="popup-modal__disclaimer">
                <strong className="popup-modal__disclaimer-title">
                  Tahadhari
                </strong>
                <p className="popup-modal__disclaimer-body">
                  {settings.disclaimer}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="popup-modal__footer">
          <button
            type="button"
            className="popup-modal__button"
            onClick={close}
          >
            Sawa
          </button>
        </div>
      </div>
    </div>
  )
}
