import { useMemo, useState } from 'react'
import type { PopupSettings } from '../../types/osmani'

const STORAGE_KEY = 'osmani_popup_settings_seen'

type PopupSettingsModalProps = {
  settings: PopupSettings | null
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

  if (!settings || !visible) {
    return null
  }

  return (
    <div className="popup-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="popup-modal__backdrop"
        aria-label="Close popup"
        onClick={() => {
          if (settings.mode === 'show_once') {
            window.localStorage.setItem(STORAGE_KEY, '1')
          }
          setDismissed(true)
        }}
      />
      <div className="popup-modal__card">
        <div className="popup-modal__icon">!</div>
        {settings.title ? <h2>{settings.title}</h2> : null}
        {settings.greeting ? <p className="popup-modal__greeting">{settings.greeting}</p> : null}

        {bulletPoints.length ? (
          <div className="popup-modal__bullets">
            {bulletPoints.map((point) => (
              <div key={point} className="popup-modal__bullet">
                <span>&bull;</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        ) : null}

        {settings.disclaimer ? (
          <div className="popup-modal__disclaimer">
            <strong>Tahadhari</strong>
            <p>{settings.disclaimer}</p>
          </div>
        ) : null}

        <button
          type="button"
          className="popup-modal__button"
          onClick={() => {
            if (settings.mode === 'show_once') {
              window.localStorage.setItem(STORAGE_KEY, '1')
            }
            setDismissed(true)
          }}
        >
          Sawa
        </button>
      </div>
    </div>
  )
}
