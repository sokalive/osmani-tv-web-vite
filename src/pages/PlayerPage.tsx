import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCatalogOutlet } from '../app/catalogOutlet'
import { useHlsPlayback } from '../hooks/useHlsPlayback'

export function PlayerPage() {
  const navigate = useNavigate()
  const params = useParams()
  const { data, selectedChannel } = useCatalogOutlet()
  const [sourceIndex, setSourceIndex] = useState(0)
  const [retryToken, setRetryToken] = useState(0)
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain')
  const [pickerKind, setPickerKind] = useState<'language' | 'quality' | null>(null)

  const channel = useMemo(() => {
    const channelId = String(params.channelId ?? '').trim()

    if (!channelId) {
      return selectedChannel
    }

    return (
      data?.channels.find((item) => item.id === channelId) || selectedChannel || null
    )
  }, [data?.channels, params.channelId, selectedChannel])

  const activeSource = channel?.playbackCandidates[sourceIndex] ?? channel?.playbackCandidates[0] ?? null
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
    play,
    requestFullscreen,
  } = useHlsPlayback({
    src: playbackSrc,
    autoPlay: true,
    startMuted: true,
    retryToken: sourceIndex + retryToken,
  })

  const statusLabel = {
    idle: 'Idle',
    loading: 'Loading',
    ready: 'Ready',
    playing: 'LIVE',
    buffering: 'Buffering',
    'awaiting-user': 'Tap to play',
    error: 'Error',
  }[status]

  const qualityOptions = useMemo(
    () =>
      channel?.playbackCandidates.map((candidate, index) => ({
        id: candidate.id,
        label: candidate.label,
        selected: index === sourceIndex,
        onSelect: () => {
          setSourceIndex(index)
          setPickerKind(null)
        },
      })) ?? [],
    [channel?.playbackCandidates, sourceIndex],
  )

  const languageOptions = useMemo(
    () => [
      {
        id: 'sw',
        label: 'Default Audio',
        selected: true,
        onSelect: () => setPickerKind(null),
      },
      {
        id: 'auto',
        label: 'Auto Detect',
        selected: false,
        onSelect: () => setPickerKind(null),
      },
    ],
    [],
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

  return (
    <section className="player-screen">
      <div className="player-screen__surface">
        <video
          ref={videoRef}
          className={`player-screen__video player-screen__video--${fitMode}`}
          controls
          muted={isMuted}
          playsInline
        />

        <div className="player-screen__overlay">
          <div className="player-screen__topbar">
            <button
              type="button"
              className="player-screen__back"
              onClick={() => navigate(-1)}
            >
              Back
            </button>

            <div className="player-screen__title-wrap">
              <strong>{channel.name}</strong>
              <span>Live Stream</span>
            </div>

            <span className="player-screen__live-pill">{statusLabel}</span>
          </div>

          {status === 'buffering' || status === 'error' ? (
            <div className="player-screen__center-state">
              <strong>{status === 'error' ? 'Hitilafu ya uchezi' : 'Inabuffer...'}</strong>
              <p>{error || channel.playbackMessage}</p>
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

          <div className="player-screen__bottom-actions">
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
              {status === 'playing' ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => setPickerKind('language')}
            >
              Lugha
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => setPickerKind('quality')}
            >
              Quality
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() =>
                setFitMode((value) => (value === 'contain' ? 'cover' : 'contain'))
              }
            >
              Fill
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => void requestFullscreen()}
            >
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
              <div className="player-picker__sheet">
                <div className="player-picker__header">
                  <strong>{pickerKind === 'quality' ? 'Quality' : 'Lugha'}</strong>
                  <button type="button" onClick={() => setPickerKind(null)}>
                    Close
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
                  >
                    <span>{option.label}</span>
                    {option.selected ? <span>Selected</span> : null}
                  </button>
                ))}

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

      <div className="player-screen__details">
        <div className="player-screen__badge-row">
          {channel.isHD ? <span className="badge badge--hd">HD</span> : null}
          <span className={`badge ${channel.isLive ? 'badge--live' : 'badge--offline'}`}>
            LIVE
          </span>
          <span
            className={`badge ${
              channel.accessType === 'premium' ? 'badge--premium' : 'badge--free'
            }`}
          >
            {channel.accessType === 'premium' ? 'KULIPIA' : 'BURE'}
          </span>
        </div>
        <h1>{channel.name}</h1>
        <p>{error || channel.playbackMessage}</p>
      </div>
    </section>
  )
}
