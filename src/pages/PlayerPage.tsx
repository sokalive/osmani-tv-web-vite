import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCatalogOutlet } from '../app/catalogOutlet'
import { useHlsPlayback } from '../hooks/useHlsPlayback'
import {
  PING_MS,
  pingLiveSession,
  startLiveSession,
  stopLiveSession,
} from '../services/analytics'

function PlayerActionIcon({ kind }: { kind: 'play' | 'language' | 'quality' | 'fill' | 'fullscreen' }) {
  if (kind === 'language') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7h10M5 12h7M5 17h10" />
        <path d="M17 8l3 3-3 3" />
      </svg>
    )
  }

  if (kind === 'quality') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="3" />
        <path d="M9 15 11.5 11.5 14 13.8 16 10.8" />
      </svg>
    )
  }

  if (kind === 'fill') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3" />
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
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
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
  const [controlsPinned, setControlsPinned] = useState(true)
  const [accessChecking, setAccessChecking] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const sessionDeviceIdRef = useRef('')
  const heartbeatRef = useRef<number | null>(null)
  const freeMode = data?.settings.freeMode ?? false
  const emergencyMode = data?.settings.emergencyMode ?? false

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

  const controlsVisible = controlsPinned || Boolean(pickerKind) || status !== 'playing'
  const showCenterState = status !== 'playing'
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
        navigate('/account', { state: { openPremiumModal: true } })
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    channel,
    freeMode,
    gateForPlayback,
    navigate,
    subscriptionVersion,
  ])

  useEffect(() => {
    if (!emergencyMode) {
      return
    }

    requestEmergencyModal()
    navigate('/')
  }, [emergencyMode, navigate, requestEmergencyModal])

  useEffect(() => {
    if (!channel || accessChecking || accessDenied) {
      return
    }

    let cancelled = false
    const channelId = channel.id || channel.name
    const channelName = channel.name

    void startLiveSession(channelId, channelName).then((deviceId) => {
      if (cancelled) {
        return
      }

      sessionDeviceIdRef.current = deviceId
      heartbeatRef.current = window.setInterval(() => {
        void pingLiveSession(deviceId, channelId)
      }, PING_MS)
    })

    return () => {
      cancelled = true
      if (heartbeatRef.current != null) {
        window.clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      const deviceId = sessionDeviceIdRef.current
      sessionDeviceIdRef.current = ''
      void stopLiveSession(deviceId, channelId)
    }
  }, [accessChecking, accessDenied, channel])

  useEffect(() => {
    if (pickerKind || status !== 'playing') {
      return
    }

    const timer = window.setTimeout(() => setControlsPinned(false), 3500)
    return () => {
      window.clearTimeout(timer)
    }
  }, [pickerKind, status])

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
      <section className="player-screen player-screen--empty">
        <p className="player-screen__empty-text">Inathibitisha kifurushi...</p>
      </section>
    )
  }

  if (accessDenied) {
    return (
      <section className="player-screen player-screen--empty">
        <p className="player-screen__empty-text">Hauna kifurushi hai.</p>
      </section>
    )
  }

  return (
    <section className="player-screen">
      <div
        className="player-screen__surface"
        onClick={() => {
          if (!pickerKind) {
            setControlsPinned((current) => (controlsVisible ? !current : true))
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
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 6 8.5 12l6 6" />
              </svg>
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
                if (status !== 'playing') {
                  void play()
                  return
                }

                videoRef.current?.pause()
              }}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="play" />
              </span>
              {status === 'playing' ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => setPickerKind('language')}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="language" />
              </span>
              {selectedLanguageLabel}
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => setPickerKind('quality')}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="quality" />
              </span>
              {selectedQualityLabel}
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() =>
                setFitMode((value) => (value === 'contain' ? 'cover' : 'contain'))
              }
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="fill" />
              </span>
              Fill
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => void requestFullscreen()}
            >
              <span className="player-action__icon">
                <PlayerActionIcon kind="fullscreen" />
              </span>
              Full Screen
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
