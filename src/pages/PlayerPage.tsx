import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCatalogOutlet } from '../app/catalogOutlet'
import { useHlsPlayback } from '../hooks/useHlsPlayback'
import {
  PING_MS,
  pingLiveSession,
  startLiveSession,
  stopLiveSession,
} from '../services/analytics'
import { clearActiveChannel, setActiveChannel } from '../services/presenceTracker'

function PlayerActionIcon({
  kind,
}: {
  kind:
    | 'play'
    | 'pause'
    | 'language'
    | 'quality'
    | 'fill'
    | 'fill-off'
    | 'fullscreen'
    | 'back'
    | 'close'
    | 'lock'
    | 'check'
}) {
  if (kind === 'back') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 6 8.5 12l6 6" />
      </svg>
    )
  }

  if (kind === 'close') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    )
  }

  if (kind === 'lock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="11" width="12" height="9" rx="2.5" />
        <path d="M9 11V8.5A3 3 0 0 1 12 5.5a3 3 0 0 1 3 3V11" />
      </svg>
    )
  }

  if (kind === 'check') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12 4.2 4.2L19 6.8" />
      </svg>
    )
  }

  if (kind === 'pause') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6.5v11M15 6.5v11" />
      </svg>
    )
  }

  if (kind === 'language') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 12h7M8 7.5h6.5M6.5 16.5h3" />
        <path d="M15.5 6.5c1 4 2.6 7.4 5 10.5" />
        <path d="M18 6.5c-.6 3.4-2.1 6.6-4.5 9.5" />
      </svg>
    )
  }

  if (kind === 'quality') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 15a7 7 0 1 1 14 0" />
        <path d="M12 15l3.8-3.4" />
        <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (kind === 'fill') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5H5v4M15 5h4v4M9 19H5v-4M15 19h4v-4" />
      </svg>
    )
  }

  if (kind === 'fill-off') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 8H5V5M16 8h3V5M8 16H5v3M16 16h3v3" />
      </svg>
    )
  }

  if (kind === 'fullscreen') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" />
    </svg>
  )
}

function CloseIcon() {
  return <PlayerActionIcon kind="close" />
}

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: OrientationLockType) => Promise<void>
  unlock?: () => void
}

function getFullscreenElement() {
  if (typeof document === 'undefined') {
    return null
  }

  const doc = document as FullscreenCapableDocument
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

function isAndroidWebViewRuntime() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent || ''
  return (
    /Android/i.test(userAgent) &&
    (/\bwv\b/i.test(userAgent) ||
      (/Version\/[\d.]+/i.test(userAgent) && /Chrome\/[\d.]+/i.test(userAgent)))
  )
}

export function PlayerPage() {
  const navigate = useNavigate()
  const params = useParams()
  const {
    data,
    selectedChannel,
    gateForPlayback,
    requestEmergencyModal,
    subscriptionVersion,
  } = useCatalogOutlet()
  const [retryToken, setRetryToken] = useState(0)
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain')
  const [pickerKind, setPickerKind] = useState<'language' | 'quality' | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [accessChecking, setAccessChecking] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [immersiveActive, setImmersiveActive] = useState(() => Boolean(getFullscreenElement()))
  const sessionDeviceIdRef = useRef('')
  const heartbeatRef = useRef<number | null>(null)
  const hideControlsTimerRef = useRef<number | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const autoImmersiveAttemptRef = useRef(false)
  const playStartedImmersiveRetryRef = useRef(false)
  const freeMode = data?.settings.freeMode ?? false
  const emergencyMode = data?.settings.emergencyMode ?? false
  const androidWebViewRuntime = useMemo(() => isAndroidWebViewRuntime(), [])

  const channel = useMemo(() => {
    const channelId = String(params.channelId ?? '').trim()

    if (!channelId) {
      return selectedChannel
    }

    if (data?.channels) {
      return data.channels.find((item) => item.id === channelId) || null
    }

    return selectedChannel
  }, [data?.channels, params.channelId, selectedChannel])

  const activeSource =
    channel?.playbackCandidates.find((candidate) => candidate.isDirectManifest) ??
    channel?.playbackCandidates[0] ??
    null
  const playbackSrc =
    channel?.playbackReadiness === 'ready' && activeSource
      ? activeSource.proxiedUrl
      : ''

  const {
    videoRef,
    status,
    error,
    isMuted,
    setMuted,
    qualityOptions: availableQualityOptions,
    audioTrackOptions: availableAudioTrackOptions,
    setQuality,
    setAudioTrack,
    play,
    requestFullscreen,
  } = useHlsPlayback({
    src: playbackSrc,
    autoPlay: true,
    startMuted: true,
    retryToken,
  })

  const qualityOptions = useMemo(
    () =>
      availableQualityOptions.map((option) => ({
        id: option.id,
        label: option.label,
        selected: option.selected,
        onSelect: () => {
          setQuality(option.id)
          setPickerKind(null)
        },
      })),
    [availableQualityOptions, setQuality],
  )

  const languageOptions = useMemo(
    () =>
      availableAudioTrackOptions.map((option) => ({
        id: option.id,
        label: option.label,
        selected: option.selected,
        onSelect: () => {
          setAudioTrack(option.id)
          setPickerKind(null)
        },
      })),
    [availableAudioTrackOptions, setAudioTrack],
  )
  const selectedQualityLabel =
    qualityOptions.find((option) => option.selected)?.label || 'Quality'
  const selectedLanguageLabel =
    languageOptions.find((option) => option.selected)?.label || 'Lugha'

  const controlsVisible = overlayVisible
  const showCenterState =
    status === 'loading' ||
    status === 'buffering' ||
    status === 'awaiting-user' ||
    status === 'error'
  const centerTitle =
    status === 'error'
      ? 'Hitilafu ya uchezi'
      : status === 'awaiting-user'
        ? 'Gusa ili uanze'
        : 'Inapakia moja kwa moja...'
  const centerMessage =
    status === 'error'
      ? error || channel?.playbackMessage
      : status === 'buffering'
        ? 'Inabuffer stream ya moja kwa moja...'
        : channel?.playbackMessage

  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimerRef.current != null) {
      window.clearTimeout(hideControlsTimerRef.current)
      hideControlsTimerRef.current = null
    }
  }, [])

  const startHideControlsTimer = useCallback(() => {
    clearHideControlsTimer()
    hideControlsTimerRef.current = window.setTimeout(() => {
      setOverlayVisible(false)
    }, 3000)
  }, [clearHideControlsTimer])

  const showControls = useCallback(() => {
    setOverlayVisible(true)

    if (pickerKind || status !== 'playing') {
      clearHideControlsTimer()
      return
    }

    startHideControlsTimer()
  }, [clearHideControlsTimer, pickerKind, startHideControlsTimer, status])

  const lockLandscape = useCallback(async () => {
    if (typeof window === 'undefined') {
      return
    }

    const orientation = window.screen?.orientation as LockableOrientation | undefined

    if (!orientation?.lock) {
      return
    }

    try {
      await orientation.lock('landscape')
    } catch {}
  }, [])

  const unlockOrientation = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const orientation = window.screen?.orientation as LockableOrientation | undefined

    try {
      orientation?.unlock?.()
    } catch {}
  }, [])

  const enterImmersivePlayback = useCallback(async () => {
    const entered = await requestFullscreen(surfaceRef.current)

    if (!entered) {
      return false
    }

    setImmersiveActive(true)
    setOverlayVisible(true)
    await lockLandscape()
    return true
  }, [lockLandscape, requestFullscreen])

  const exitImmersivePlayback = useCallback(async () => {
    if (typeof document === 'undefined') {
      unlockOrientation()
      setImmersiveActive(false)
      return
    }

    const doc = document as FullscreenCapableDocument

    try {
      if (doc.fullscreenElement && doc.exitFullscreen) {
        await doc.exitFullscreen()
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      }
    } catch {}

    unlockOrientation()
    setImmersiveActive(false)
  }, [unlockOrientation])

  const leavePlayer = useCallback(async () => {
    await exitImmersivePlayback()
    navigate(-1)
  }, [exitImmersivePlayback, navigate])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const body = document.body
    const root = document.documentElement
    const previousBodyOverflow = body.style.overflow
    const previousRootOverflow = root.style.overflow
    const previousBodyBackground = body.style.background
    const previousRootBackground = root.style.background
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousRootOverscroll = root.style.overscrollBehavior

    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    body.style.background = '#000000'
    root.style.background = '#000000'
    body.style.overscrollBehavior = 'none'
    root.style.overscrollBehavior = 'none'

    return () => {
      body.style.overflow = previousBodyOverflow
      root.style.overflow = previousRootOverflow
      body.style.background = previousBodyBackground
      root.style.background = previousRootBackground
      body.style.overscrollBehavior = previousBodyOverscroll
      root.style.overscrollBehavior = previousRootOverscroll
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const syncFullscreenState = () => {
      const active = Boolean(getFullscreenElement())
      setImmersiveActive(active)
      if (!active) {
        unlockOrientation()
      }
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
    }
  }, [unlockOrientation])

  useEffect(() => {
    autoImmersiveAttemptRef.current = false
    playStartedImmersiveRetryRef.current = false
    clearHideControlsTimer()
    setOverlayVisible(true)
  }, [channel?.id, clearHideControlsTimer, playbackSrc])

  useEffect(() => {
    let cancelled = false
    if (!channel) {
      setAccessChecking(false)
      setAccessDenied(false)
      return
    }

    if (freeMode || channel.accessType !== 'premium') {
      setAccessChecking(false)
      setAccessDenied(false)
      return
    }

    setAccessChecking(true)
    setAccessDenied(false)
    void gateForPlayback(channel, `player:${channel.id}`).then((allowed) => {
      if (cancelled) {
        return
      }
      setAccessChecking(false)
      setAccessDenied(!allowed)
      if (!allowed) {
        void exitImmersivePlayback().finally(() => {
          navigate('/account', { state: { openPremiumModal: true } })
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    channel,
    exitImmersivePlayback,
    freeMode,
    gateForPlayback,
    navigate,
    subscriptionVersion,
  ])

  useEffect(() => {
    if (!emergencyMode) {
      return
    }

    void exitImmersivePlayback().finally(() => {
      requestEmergencyModal()
      navigate('/')
    })
  }, [emergencyMode, exitImmersivePlayback, navigate, requestEmergencyModal])

  useEffect(() => {
    if (!channel || accessChecking || accessDenied) {
      return
    }

    const channelId = channel.id || channel.name
    const channelName = channel.name
    setActiveChannel(channelId, channelName)

    return () => {
      clearActiveChannel()
    }
  }, [accessChecking, accessDenied, channel])

  useEffect(() => {
    if (!channel || accessChecking || accessDenied) {
      return
    }

    let cancelled = false
    let sessionActive = false
    const channelId = channel.id || channel.name
    const channelName = channel.name

    const stopSession = () => {
      if (heartbeatRef.current != null) {
        window.clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }

      const deviceId = sessionDeviceIdRef.current
      sessionDeviceIdRef.current = ''
      if (!deviceId) {
        sessionActive = false
        return
      }

      sessionActive = false
      void stopLiveSession(deviceId, channelId)
    }

    const startSession = () => {
      if (cancelled || sessionActive) {
        return
      }

      sessionActive = true

      void startLiveSession(channelId, channelName).then((deviceId) => {
        if (cancelled || !sessionActive) {
          if (deviceId) {
            void stopLiveSession(deviceId, channelId)
          }
          return
        }

        sessionDeviceIdRef.current = deviceId
        heartbeatRef.current = window.setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return
          }

          void pingLiveSession(deviceId, channelId)
        }, PING_MS)
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!sessionActive) {
          startSession()
          return
        }

        if (sessionDeviceIdRef.current) {
          void pingLiveSession(sessionDeviceIdRef.current, channelId)
        }
        return
      }

      if (document.visibilityState === 'hidden') {
        stopSession()
      }
    }

    const onPageShow = () => {
      if (!sessionActive) {
        startSession()
        return
      }

      if (sessionDeviceIdRef.current) {
        void pingLiveSession(sessionDeviceIdRef.current, channelId)
      }
    }

    const onPageHide = () => {
      stopSession()
    }

    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      startSession()
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('pageshow', onPageShow)
      window.addEventListener('pagehide', onPageHide)
      window.addEventListener('beforeunload', onPageHide)
    }

    return () => {
      cancelled = true

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        window.removeEventListener('pageshow', onPageShow)
        window.removeEventListener('pagehide', onPageHide)
        window.removeEventListener('beforeunload', onPageHide)
      }

      stopSession()
    }
  }, [accessChecking, accessDenied, channel])

  useEffect(() => {
    clearHideControlsTimer()

    if (pickerKind || status !== 'playing') {
      setOverlayVisible(true)
      return
    }

    setOverlayVisible(true)
    startHideControlsTimer()

    return () => {
      clearHideControlsTimer()
    }
  }, [clearHideControlsTimer, pickerKind, startHideControlsTimer, status])

  useEffect(() => {
    if (!channel || accessChecking || accessDenied || !playbackSrc) {
      return
    }

    if (status === 'idle' || status === 'loading') {
      return
    }

    if (autoImmersiveAttemptRef.current) {
      return
    }

    autoImmersiveAttemptRef.current = true

    const timer = window.setTimeout(() => {
      void enterImmersivePlayback()
    }, androidWebViewRuntime ? 60 : 120)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    accessChecking,
    accessDenied,
    androidWebViewRuntime,
    channel,
    enterImmersivePlayback,
    playbackSrc,
    status,
  ])

  useEffect(() => {
    if (status !== 'playing' || immersiveActive) {
      return
    }

    if (playStartedImmersiveRetryRef.current) {
      return
    }

    playStartedImmersiveRetryRef.current = true
    void enterImmersivePlayback()
  }, [enterImmersivePlayback, immersiveActive, status])

  useEffect(
    () => () => {
      clearHideControlsTimer()
      void exitImmersivePlayback()
    },
    [clearHideControlsTimer, exitImmersivePlayback],
  )

  if (!channel) {
    return (
      <div className="player-screen player-screen--empty">
        <button
          type="button"
          className="player-screen__back"
          onClick={() => navigate('/')}
        >
          Back
        </button>
        <p className="player-screen__empty-text">
          Channel not found in the live catalog.
        </p>
      </div>
    )
  }

  if (accessChecking) {
    return (
      <section className="player-screen">
        <div className="player-screen__surface">
          <div className="player-screen__gate-state">
            <span className="player-screen__status-spinner" aria-hidden="true" />
            <strong>Inathibitisha kifurushi...</strong>
            <p>Inafuata kanuni za premium kabla ya kufungua player.</p>
          </div>
        </div>
      </section>
    )
  }

  if (accessDenied) {
    return (
      <section className="player-screen">
        <div className="player-screen__surface">
          <div className="player-screen__gate-state player-screen__gate-state--locked">
            <span className="player-screen__gate-icon" aria-hidden="true">
              <PlayerActionIcon kind="lock" />
            </span>
            <strong>Hauna kifurushi hai</strong>
            <p>Fungua kifurushi chako ili kuendelea kutazama channel hii.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="player-screen">
      <div
        ref={surfaceRef}
        className="player-screen__surface"
        onClick={() => {
          if (!immersiveActive) {
            void enterImmersivePlayback()
          }
          if (!pickerKind) {
            showControls()
          }
        }}
      >
        <video
          ref={videoRef}
          className={`player-screen__video player-screen__video--${fitMode}`}
          muted={isMuted}
          playsInline
        />

        <div
          className={`player-screen__overlay${
            controlsVisible || pickerKind ? ' player-screen__overlay--visible' : ''
          }`}
        >
          <div className="player-screen__topbar" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="player-screen__back"
              onClick={() => {
                void leavePlayer()
              }}
              aria-label="Back"
            >
              <PlayerActionIcon kind="back" />
            </button>

            <div className="player-screen__title-wrap">
              <strong>{channel.name}</strong>
              <span>Live Stream</span>
            </div>

            <span className="player-screen__live-pill">LIVE</span>
          </div>

          {showCenterState ? (
            <div
              className="player-screen__center-state"
              onClick={(event) => event.stopPropagation()}
            >
              {status !== 'error' ? (
                <span className="player-screen__status-spinner" aria-hidden="true" />
              ) : null}
              <strong>{centerTitle}</strong>
              <p>{centerMessage}</p>
              {status === 'error' ? (
                <button
                  type="button"
                  className="player-screen__retry"
                  onClick={() => setRetryToken((value) => value + 1)}
                >
                  Jaribu tena
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className="player-screen__bottom-actions"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="player-action"
              onClick={() => {
                showControls()
                if (status !== 'playing') {
                  void play()
                  void enterImmersivePlayback()
                  return
                }

                videoRef.current?.pause()
              }}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind={status === 'playing' ? 'pause' : 'play'} />
              </span>
              <span className="player-action__label">
                {status === 'playing' ? 'Pause' : 'Play'}
              </span>
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => {
                showControls()
                setPickerKind('language')
              }}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="language" />
              </span>
              <span className="player-action__label">{selectedLanguageLabel}</span>
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => {
                showControls()
                setPickerKind('quality')
              }}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="quality" />
              </span>
              <span className="player-action__label">{selectedQualityLabel}</span>
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => {
                showControls()
                setFitMode((value) => (value === 'contain' ? 'cover' : 'contain'))
              }}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind={fitMode === 'cover' ? 'fill-off' : 'fill'} />
              </span>
              <span className="player-action__label">Fill</span>
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => {
                showControls()
                void enterImmersivePlayback()
              }}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="fullscreen" />
              </span>
              <span className="player-action__label">Full Screen</span>
            </button>
          </div>

          {pickerKind ? (
            <div className="player-picker" role="dialog" aria-modal="true">
              <button
                type="button"
                className="player-picker__backdrop"
                aria-label="Close picker"
                onClick={() => setPickerKind(null)}
              />
              <div
                className="player-picker__sheet"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="player-picker__header">
                  <strong>
                    {pickerKind === 'quality'
                      ? 'Chagua Ubora'
                      : 'Chagua Lugha / Audio'}
                  </strong>
                  <button
                    type="button"
                    className="player-picker__close"
                    onClick={() => setPickerKind(null)}
                    aria-label="Close picker"
                  >
                    <CloseIcon />
                  </button>
                </div>

                {(pickerKind === 'quality' ? qualityOptions : languageOptions).map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`player-picker__row${
                      option.selected ? ' player-picker__row--active' : ''
                    }`}
                    onClick={option.onSelect}
                    aria-pressed={option.selected}
                  >
                    <span>{option.label}</span>
                    {option.selected ? (
                      <span className="player-picker__check" aria-hidden="true">
                        <PlayerActionIcon kind="check" />
                      </span>
                    ) : null}
                  </button>
                ))}

                {(pickerKind === 'quality' ? qualityOptions : languageOptions).length === 0 ? (
                  <p className="player-picker__empty">
                    {pickerKind === 'quality'
                      ? 'Hakuna ubora wa ziada kutoka kwenye stream hii.'
                      : 'Hakuna lugha au audio tracks za ziada kwenye stream hii.'}
                  </p>
                ) : null}

                {pickerKind === 'language' ? (
                  <button
                    type="button"
                    className="player-picker__mute-toggle"
                    onClick={() => {
                      setMuted(!isMuted)
                      setPickerKind(null)
                    }}
                  >
                    {isMuted ? 'Washa sauti' : 'Mute'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
