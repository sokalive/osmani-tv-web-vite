import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCatalogOutlet } from '../app/catalogOutlet'
import { useHlsPlayback } from '../hooks/useHlsPlayback'

export function PlayerPage() {
  const navigate = useNavigate()
  const params = useParams()
  const { data, selectedChannel } = useCatalogOutlet()
  const [sourceIndex, setSourceIndex] = useState(0)

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
    retryToken: sourceIndex,
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
          className="player-screen__video"
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
              onClick={() => setMuted(!isMuted)}
            >
              {isMuted ? 'Sound' : 'Mute'}
            </button>
            <button
              type="button"
              className="player-action"
              onClick={() => void requestFullscreen()}
            >
              Full Screen
            </button>
            {channel.playbackCandidates.length > 1 ? (
              <button
                type="button"
                className="player-action"
                onClick={() =>
                  setSourceIndex((value) => (value + 1) % channel.playbackCandidates.length)
                }
              >
                Source
              </button>
            ) : null}
          </div>
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
