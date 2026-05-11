import { useMemo, useState } from 'react'
import { useHlsPlayback } from '../../hooks/useHlsPlayback'

type HlsPlayerProps = {
  src: string
  title: string
}

const statusLabels: Record<ReturnType<typeof useHlsPlayback>['status'], string> = {
  idle: 'Waiting for stream',
  loading: 'Loading manifest',
  ready: 'Ready',
  playing: 'Playing',
  buffering: 'Buffering',
  'awaiting-user': 'User interaction needed',
  error: 'Playback error',
}

export function HlsPlayer({ src, title }: HlsPlayerProps) {
  const [retryToken, setRetryToken] = useState(0)
  const { videoRef, status, error, isMuted, setMuted, requestFullscreen } =
    useHlsPlayback({
      src,
      autoPlay: true,
      startMuted: true,
      retryToken,
    })

  const helperText = useMemo(() => {
    if (!src) {
      return 'Set VITE_DEFAULT_STREAM_URL to a valid .m3u8 stream to test browser playback.'
    }

    if (status === 'awaiting-user') {
      return 'Chrome often allows muted autoplay first. Use the mute toggle if you need audio immediately.'
    }

    if (error) {
      return error
    }

    return 'This player uses hls.js in browsers with MSE and falls back to native HLS where available.'
  }, [error, src, status])

  return (
    <section className="player-card" id="player">
      <div className="player-card__header">
        <div>
          <p className="eyebrow">Browser-first playback layer</p>
          <h2>{title}</h2>
        </div>

        <span className={`status-pill status-pill--${status}`}>
          {statusLabels[status]}
        </span>
      </div>

      <div className="player-frame">
        <video
          ref={videoRef}
          className="player-frame__video"
          controls
          muted={isMuted}
          playsInline
        />
      </div>

      <div className="player-controls">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setMuted(!isMuted)}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setRetryToken((value) => value + 1)}
        >
          Retry stream
        </button>
        <button
          type="button"
          className="button"
          onClick={() => void requestFullscreen()}
        >
          Toggle fullscreen
        </button>
      </div>

      <p className="player-helper">{helperText}</p>
    </section>
  )
}
