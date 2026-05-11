import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'buffering'
  | 'awaiting-user'
  | 'error'

type UseHlsPlaybackOptions = {
  src: string
  autoPlay?: boolean
  startMuted?: boolean
  retryToken?: number
}

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitRequestFullscreen?: () => Promise<void>
}

const LIVE_HLS_MIME = 'application/vnd.apple.mpegurl'

export function useHlsPlayback({
  src,
  autoPlay = true,
  startMuted = true,
  retryToken = 0,
}: UseHlsPlaybackOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [internalStatus, setInternalStatus] = useState<PlaybackStatus>('idle')
  const [internalError, setInternalError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(startMuted)

  const destroyPlayer = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
  }, [])

  const requestFullscreen = useCallback(async () => {
    const video = videoRef.current as FullscreenVideoElement | null

    if (!video) {
      return
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    if (video.requestFullscreen) {
      await video.requestFullscreen()
      return
    }

    if (video.webkitRequestFullscreen) {
      await video.webkitRequestFullscreen()
      return
    }

    video.webkitEnterFullscreen?.()
  }, [])

  const play = useCallback(async () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    try {
      await video.play()
    } catch {
      setInternalStatus('awaiting-user')
    }
  }, [])

  const updateMutedState = useCallback((nextMuted: boolean) => {
    setIsMuted(nextMuted)

    if (videoRef.current) {
      videoRef.current.muted = nextMuted
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    destroyPlayer()

    if (!src) {
      return
    }

    let isDisposed = false
    video.playsInline = true
    video.muted = startMuted
    video.autoplay = autoPlay
    video.preload = 'auto'
    queueMicrotask(() => {
      if (!isDisposed) {
        setIsMuted(startMuted)
        setInternalError(null)
        setInternalStatus('loading')
      }
    })

    const tryPlay = async () => {
      if (!autoPlay || isDisposed) {
        return
      }

      try {
        await video.play()
      } catch {
        if (!isDisposed) {
          setInternalStatus('awaiting-user')
          setInternalError(
            'Autoplay was blocked by the browser. Keep the stream muted or use the play button.',
          )
        }
      }
    }

    const onPlaying = () => setInternalStatus('playing')
    const onWaiting = () => setInternalStatus('buffering')
    const onCanPlay = () =>
      setInternalStatus((current) => (current === 'playing' ? current : 'ready'))
    const onPause = () =>
      setInternalStatus((current) =>
        current === 'error' || current === 'awaiting-user' ? current : 'ready',
      )

    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('pause', onPause)

    const cleanup = () => {
      isDisposed = true
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('pause', onPause)
      destroyPlayer()
    }

    const attachNativePlayback = () => {
      video.src = src
      video.load()
      void tryPlay()
    }

    if (video.canPlayType(LIVE_HLS_MIME)) {
      attachNativePlayback()
      return cleanup
    }

    const attachManagedHls = async () => {
      const { default: HlsLibrary } = await import('hls.js/dist/hls.light.mjs')

      if (isDisposed) {
        return
      }

      if (!HlsLibrary.isSupported()) {
        queueMicrotask(() => {
          if (!isDisposed) {
            setInternalStatus('error')
            setInternalError(
              'This browser does not support Media Source Extensions for HLS.',
            )
          }
        })
        return
      }

      const hls = new HlsLibrary({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 120,
        liveSyncDurationCount: 3,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 5,
        fragLoadingMaxRetry: 6,
      })

      hlsRef.current = hls
      hls.attachMedia(video)

      hls.on(HlsLibrary.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src)
      })

      hls.on(HlsLibrary.Events.MANIFEST_PARSED, () => {
        setInternalStatus('ready')
        void tryPlay()
      })

      hls.on(HlsLibrary.Events.ERROR, (_, data) => {
        if (!data.fatal) {
          return
        }

        if (data.type === HlsLibrary.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad()
          return
        }

        if (data.type === HlsLibrary.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }

        setInternalStatus('error')
        setInternalError(
          data.details || 'Playback failed to recover from a fatal error.',
        )
      })
    }

    void attachManagedHls()

    return cleanup
  }, [autoPlay, destroyPlayer, retryToken, src, startMuted])

  return {
    videoRef,
    status: src ? internalStatus : 'idle',
    error: src ? internalError : null,
    isMuted,
    setMuted: updateMutedState,
    play,
    requestFullscreen,
  }
}
