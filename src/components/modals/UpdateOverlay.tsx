type UpdateDecision = 'FORCE' | 'PLAY_STORE' | 'SOFT' | string

type UpdateAction = {
  canDownload: boolean
  canOpenStore: boolean
}

type UpdateInfo = {
  notice?: string
  installedVersionName?: string
  latestVersionName?: string
  apkSizeBytes?: number
  releaseNotes?: string
}

type UpdateProgress = {
  percent?: number
}

type UpdateOverlayProps = {
  visible: boolean
  decision?: UpdateDecision
  info?: UpdateInfo | null
  action?: UpdateAction
  downloading?: boolean
  verifying?: boolean
  installing?: boolean
  needsUnknownSourcesPermission?: boolean
  failedReason?: string
  progress?: UpdateProgress | null
  onPrimary: () => void
  onCancel: () => void
}

const DEFAULT_ACTION: UpdateAction = {
  canDownload: true,
  canOpenStore: false,
}

function formatMB(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return ''
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function UpdateIcon({ force }: { force: boolean }) {
  if (force) {
    return (
      <svg className="update-overlay__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.8 5.5 6v5.3c0 4.1 2.4 7.3 6.5 8.9 4.1-1.6 6.5-4.8 6.5-8.9V6L12 3.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="m8.9 12.4 2.1 2.2 4.3-4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg className="update-overlay__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4v9.2m0 0 3.1-3.1M12 13.2 8.9 10.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 15.5v1.2A2.3 2.3 0 0 0 7.8 19h8.4a2.3 2.3 0 0 0 2.3-2.3v-1.2"
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
      className={`update-overlay__spinner${dark ? ' update-overlay__spinner--dark' : ''}`}
      aria-hidden="true"
    />
  )
}

export function UpdateOverlay({
  visible,
  decision = 'SOFT',
  info = null,
  action = DEFAULT_ACTION,
  downloading = false,
  verifying = false,
  installing = false,
  needsUnknownSourcesPermission = false,
  failedReason = '',
  progress = null,
  onPrimary,
  onCancel,
}: UpdateOverlayProps) {
  if (!visible) {
    return null
  }

  const isForce = decision === 'FORCE'
  const isPlayStore = decision === 'PLAY_STORE'
  const inProgress = downloading || verifying || installing
  const percent =
    progress && typeof progress.percent === 'number' ? progress.percent : -1
  const installedName = info?.installedVersionName || ''
  const latestName = info?.latestVersionName || ''
  const sizeText = formatMB(info?.apkSizeBytes)

  const headline = isForce
    ? 'Sasisho la lazima'
    : 'Sasisho linapatikana'

  const subtitle = isForce
    ? info?.notice || 'Toleo jipya ni la lazima ili kuendelea kutumia Osmani TV.'
    : info?.notice || 'Toleo jipya la Osmani TV liko tayari kupakuliwa.'

  const primaryLabel = (() => {
    if (installing) {
      return 'Inafungua msakinishaji…'
    }
    if (verifying) {
      return 'Inathibitisha…'
    }
    if (downloading) {
      return percent >= 0 ? `Inapakua… ${percent}%` : 'Inapakua…'
    }
    if (needsUnknownSourcesPermission) {
      return 'Ruhusu kisha ujaribu tena'
    }
    if (isPlayStore || (!action.canDownload && action.canOpenStore)) {
      return 'Fungua Play Store'
    }
    if (!action.canDownload) {
      return 'Hakuna APK ya kupakua'
    }
    return 'Pakua na Sakinisha'
  })()

  return (
    <div className="update-overlay" role="dialog" aria-modal="true">
      <div className="update-overlay__scrim">
        <div className="update-overlay__card">
          <div className="update-overlay__icon-wrap">
            <div className="update-overlay__icon-bg">
              <UpdateIcon force={isForce} />
            </div>
          </div>

          <h2 className="update-overlay__title">{headline}</h2>
          <p className="update-overlay__subtitle">{subtitle}</p>

          <div className="update-overlay__version-row">
            {installedName ? (
              <span className="update-overlay__version-muted">{installedName}</span>
            ) : null}
            <span className="update-overlay__version-arrow" aria-hidden="true">
              →
            </span>
            <span className="update-overlay__version-gold">
              {latestName || '—'}
            </span>
            {sizeText ? (
              <span className="update-overlay__version-muted"> · {sizeText}</span>
            ) : null}
          </div>

          {info?.releaseNotes ? (
            <p className="update-overlay__notes">{info.releaseNotes}</p>
          ) : null}

          {downloading ? (
            <div className="update-overlay__progress-bar-track">
              <div
                className="update-overlay__progress-bar-fill"
                style={{
                  width: percent >= 0 ? `${Math.max(2, percent)}%` : '20%',
                }}
              />
            </div>
          ) : null}

          {failedReason ? (
            <p className="update-overlay__error">
              Imeshindikana: {String(failedReason)}
            </p>
          ) : null}

          {needsUnknownSourcesPermission ? (
            <p className="update-overlay__warn">
              Ruhusu Osmani TV kusakinisha kutoka chanzo hiki, kisha gusa "
              {primaryLabel}" tena.
            </p>
          ) : null}

          <div className="update-overlay__actions">
            <button
              type="button"
              className={`update-overlay__primary-btn${
                inProgress || (!action.canDownload && !action.canOpenStore)
                  ? ' update-overlay__primary-btn--disabled'
                  : ''
              }`}
              disabled={inProgress || (!action.canDownload && !action.canOpenStore)}
              onClick={onPrimary}
            >
              {inProgress ? <LoadingSpinner dark /> : null}
              <span className="update-overlay__primary-btn-text">
                {primaryLabel}
              </span>
            </button>

            <button
              type="button"
              className="update-overlay__link-btn"
              onClick={onCancel}
            >
              <span
                className={
                  isForce
                    ? 'update-overlay__link-btn-text-danger'
                    : 'update-overlay__link-btn-text'
                }
              >
                {isForce ? 'Funga programu' : downloading ? 'Sitisha' : 'Baadaye'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
