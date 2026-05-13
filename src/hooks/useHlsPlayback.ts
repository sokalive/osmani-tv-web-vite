import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isLikelyHlsManifestUrl } from '../lib/playbackMime'

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'buffering'
  | 'awaiting-user'
  | 'error'

export type PlaybackQualityOption = {
  id: number
  label: string
  selected: boolean
}

export type PlaybackAudioTrackOption = {
  id: number
  label: string
  selected: boolean
}

type UseHlsPlaybackOptions = {
  src: string
  autoPlay?: boolean
  startMuted?: boolean
  retryToken?: number
}

type FullscreenVideoElement = HTMLVideoElement & {
  requestFullscreen?: (options?: { navigationUI?: 'auto' | 'hide' | 'show' }) => Promise<void>
  webkitEnterFullscreen?: () => void
  webkitRequestFullscreen?: () => Promise<void>
}

type FullscreenTargetElement = HTMLElement & {
  requestFullscreen?: (options?: { navigationUI?: 'auto' | 'hide' | 'show' }) => Promise<void>
  webkitRequestFullscreen?: () => Promise<void>
}

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

const LIVE_HLS_MIME = 'application/vnd.apple.mpegurl'

function formatQualityLabel(level: {
  height?: number
  width?: number
  bitrate?: number
  name?: string
}, index: number) {
  if (typeof level.name === 'string' && level.name.trim()) {
    return level.name.trim()
  }

  if (typeof level.height === 'number' && level.height > 0) {
    return `${level.height}p`
  }

  if (typeof level.width === 'number' && level.width > 0) {
    return `${level.width}w`
  }

  if (typeof level.bitrate === 'number' && level.bitrate > 0) {
    return `${Math.round(level.bitrate / 1000)} kbps`
  }

  return `Level ${index + 1}`
}

function formatAudioTrackLabel(track: {
  name?: string
  lang?: string
  label?: string
}, index: number) {
  if (typeof track.name === 'string' && track.name.trim()) {
    return track.name.trim()
  }

  if (typeof track.label === 'string' && track.label.trim()) {
    return track.label.trim()
  }

  if (typeof track.lang === 'string' && track.lang.trim()) {
    return track.lang.trim().toUpperCase()
  }

  return `Audio ${index + 1}`
}

export function useHlsPlayback({
  src,
  autoPlay = true,
  startMuted = true,
  retryToken = 0,
}: UseHlsPlaybackOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const lastProgressAtRef = useRef(0)
  const lastObservedTimeRef = useRef(0)
  const lastRecoveryAtRef = useRef(0)
  const stallRecoveryCountRef = useRef(0)
  const [internalStatus, setInternalStatus] = useState<PlaybackStatus>('idle')
  const [internalError, setInternalError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(startMuted)
  const [qualityOptions, setQualityOptions] = useState<PlaybackQualityOption[]>([])
  const [audioTrackOptions, setAudioTrackOptions] = useState<PlaybackAudioTrackOption[]>([])

  const destroyPlayer = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
    lastProgressAtRef.current = 0
    lastObservedTimeRef.current = 0
    lastRecoveryAtRef.current = 0
    stallRecoveryCountRef.current = 0

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
  }, [])

  const syncHlsMetadata = useCallback(() => {
    const hls = hlsRef.current as
      | (Hls & {
          autoLevelEnabled?: boolean
          currentLevel?: number
          nextLevel?: number
          levels?: Array<{
            height?: number
            width?: number
            bitrate?: number
            name?: string
          }>
          audioTrack?: number
          audioTracks?: Array<{
            id?: number
            name?: string
            lang?: string
            label?: string
          }>
        })
      | null

    if (!hls) {
      setQualityOptions([])
      setAudioTrackOptions([])
      return
    }

    const levels = Array.isArray(hls.levels) ? hls.levels : []
    const autoLevelEnabled = hls.autoLevelEnabled !== false
    const currentLevel =
      typeof hls.currentLevel === 'number' ? hls.currentLevel : -1
    setQualityOptions([
      {
        id: -1,
        label: 'Auto',
        selected: autoLevelEnabled || currentLevel < 0,
      },
      ...levels.map((level, index) => ({
        id: index,
        label: formatQualityLabel(level, index),
        selected: !autoLevelEnabled && currentLevel === index,
      })),
    ])

    const audioTracks = Array.isArray(hls.audioTracks) ? hls.audioTracks : []
    const currentAudioTrack =
      typeof hls.audioTrack === 'number' ? hls.audioTrack : -1
    setAudioTrackOptions(
      audioTracks.map((track, index) => ({
        id: typeof track.id === 'number' ? track.id : index,
        label: formatAudioTrackLabel(track, index),
        selected:
          (typeof track.id === 'number' ? track.id : index) === currentAudioTrack,
      })),
    )
  }, [])

  const requestFullscreen = useCallback(async (target?: HTMLElement | null) => {
    const doc = document as FullscreenCapableDocument
    const video = videoRef.current as FullscreenVideoElement | null
    const preferredTarget = (target as FullscreenTargetElement | null) ?? video

    if (!preferredTarget) {
      return false
    }

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      return true
    }

    const fullscreenTargets = [preferredTarget, video].filter(
      (candidate, index, all): candidate is FullscreenTargetElement | FullscreenVideoElement =>
        Boolean(candidate) && all.indexOf(candidate) === index,
    )

    for (const candidate of fullscreenTargets) {
      try {
        if (candidate.requestFullscreen) {
          await candidate.requestFullscreen({ navigationUI: 'hide' })
          return true
        }
      } catch {}

      try {
        if (candidate.webkitRequestFullscreen) {
          await candidate.webkitRequestFullscreen()
          return true
        }
      } catch {}
    }

    try {
      video?.webkitEnterFullscreen?.()
      return true
    } catch {
      return false
    }
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

  const setQuality = useCallback(
    (qualityId: number) => {
      const hls = hlsRef.current as
        | (Hls & {
            currentLevel?: number
            nextLevel?: number
            loadLevel?: number
          })
        | null

      if (!hls) {
        return
      }

      hls.currentLevel = qualityId
      hls.nextLevel = qualityId
      hls.loadLevel = qualityId
      syncHlsMetadata()
    },
    [syncHlsMetadata],
  )

  const setAudioTrack = useCallback(
    (trackId: number) => {
      const hls = hlsRef.current as (Hls & { audioTrack?: number }) | null
      if (!hls) {
        return
      }

      hls.audioTrack = trackId
      syncHlsMetadata()
    },
    [syncHlsMetadata],
  )

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    destroyPlayer()
    setQualityOptions([])
    setAudioTrackOptions([])

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
        lastProgressAtRef.current = Date.now()
        lastObservedTimeRef.current = 0
        lastRecoveryAtRef.current = 0
        stallRecoveryCountRef.current = 0
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

    const markPlaybackProgress = () => {
      lastObservedTimeRef.current = video.currentTime || 0
      lastProgressAtRef.current = Date.now()
      stallRecoveryCountRef.current = 0
      setInternalError((current) =>
        current?.startsWith('Stream stalled') ? null : current,
      )
    }

    const attemptStallRecovery = () => {
      const now = Date.now()
      if (now - lastRecoveryAtRef.current < 5000) {
        return
      }

      lastRecoveryAtRef.current = now
      stallRecoveryCountRef.current += 1

      if (stallRecoveryCountRef.current >= 3) {
        setInternalStatus('error')
        setInternalError('Stream stalled repeatedly. Trying the next source.')
        return
      }

      setInternalStatus('buffering')
      setInternalError('Stream stalled. Recovering the live stream...')

      const hls = hlsRef.current as
        | (Hls & {
            recoverMediaError?: () => void
            startLoad?: (startPosition?: number) => void
          })
        | null

      try {
        hls?.recoverMediaError?.()
      } catch {}

      try {
        hls?.startLoad?.(-1)
      } catch {}

      if (!hls) {
        try {
          video.load()
        } catch {}
      }

      void tryPlay()
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', markPlaybackProgress)
    video.addEventListener('progress', markPlaybackProgress)
    video.addEventListener('seeking', markPlaybackProgress)

    const stallWatchdog = window.setInterval(() => {
      if (isDisposed || video.paused || video.ended || !src) {
        return
      }

      const currentTime = video.currentTime || 0
      if (currentTime > lastObservedTimeRef.current + 0.05) {
        lastObservedTimeRef.current = currentTime
        lastProgressAtRef.current = Date.now()
        stallRecoveryCountRef.current = 0
        return
      }

      if (Date.now() - lastProgressAtRef.current < 8000) {
        return
      }

      attemptStallRecovery()
    }, 4000)

    const cleanup = () => {
      isDisposed = true
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', markPlaybackProgress)
      video.removeEventListener('progress', markPlaybackProgress)
      video.removeEventListener('seeking', markPlaybackProgress)
      window.clearInterval(stallWatchdog)
      destroyPlayer()
    }

    const attachNativePlayback = () => {
      video.src = src
      video.load()
      void tryPlay()
    }

    if (!isLikelyHlsManifestUrl(src)) {
      queueMicrotask(() => {
        if (!isDisposed) {
          setInternalStatus('error')
          setInternalError('This URL is not an HLS manifest (.m3u8).')
        }
      })
      return cleanup
    }

    if (video.canPlayType(LIVE_HLS_MIME)) {
      attachNativePlayback()
      return cleanup
    }

    const attachManagedHls = async () => {
      const { default: HlsLibrary } = await import('hls.js')

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
        liveDurationInfinity: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 120,
        liveSyncDurationCount: 3,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 64000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 32000,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 32000,
      })

      hlsRef.current = hls
      hls.attachMedia(video)

      hls.on(HlsLibrary.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src)
      })

      hls.on(HlsLibrary.Events.MANIFEST_PARSED, () => {
        syncHlsMetadata()
        setInternalStatus('ready')
        void tryPlay()
      })

      hls.on(HlsLibrary.Events.LEVEL_SWITCHED, () => {
        syncHlsMetadata()
      })

      hls.on(HlsLibrary.Events.AUDIO_TRACKS_UPDATED, () => {
        syncHlsMetadata()
      })

      hls.on(HlsLibrary.Events.AUDIO_TRACK_SWITCHED, () => {
        syncHlsMetadata()
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
  }, [autoPlay, destroyPlayer, retryToken, src, startMuted, syncHlsMetadata])

  return {
    videoRef,
    status: src ? internalStatus : 'idle',
    error: src ? internalError : null,
    isMuted,
    setMuted: updateMutedState,
    qualityOptions,
    audioTrackOptions,
    setQuality,
    setAudioTrack,
    play,
    requestFullscreen,
  }
}
