import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react'
import type { BannerRecord, ChannelViewModel } from '../../types/osmani'

type HeroCarouselProps = {
  slides: BannerRecord[]
  channels: ChannelViewModel[]
  onSelectChannel: (channel: ChannelViewModel) => void
}

const AUTO_ADVANCE_MS = 5000

function formatCountdownClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}`
}

type HeroSlideProps = {
  active: boolean
  channel: ChannelViewModel | null
  countdownLabel: string | null
  onSelectChannel: (channel: ChannelViewModel) => void
  slide: BannerRecord
}

function HeroSlide({
  active,
  channel,
  countdownLabel,
  onSelectChannel,
  slide,
}: HeroSlideProps) {
  const [imageFailed, setImageFailed] = useState(false)

  const content = (
    <>
      {!imageFailed && slide.imageUrl ? (
        <img
          src={slide.imageUrl}
          alt={slide.title}
          loading={active ? 'eager' : 'lazy'}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="hero-carousel__fallback" aria-hidden="true" />
      )}

      <div className="hero-carousel__scrim" aria-hidden="true" />

      <div className="hero-carousel__overlay">
        {countdownLabel ? (
          <span className="hero-carousel__countdown">{countdownLabel}</span>
        ) : null}
        {slide.badgeEnabled && slide.badge ? (
          <span
            className={`hero-carousel__badge${
              slide.badgeBlink ? ' hero-carousel__badge--blink' : ''
            }`}
            style={{ backgroundColor: slide.badgeColor }}
          >
            {slide.badge}
          </span>
        ) : null}
        <h2>{slide.title}</h2>
        {slide.description ? <p>{slide.description}</p> : null}
      </div>
    </>
  )

  if (!channel) {
    return <div className="hero-carousel__slide">{content}</div>
  }

  return (
    <button
      type="button"
      className="hero-carousel__slide hero-carousel__slide--pressable"
      onClick={() => onSelectChannel(channel)}
    >
      {content}
    </button>
  )
}

export function HeroCarousel({
  slides,
  channels,
  onSelectChannel,
}: HeroCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const safeIndex = slides.length ? Math.min(activeIndex, slides.length - 1) : 0

  const channelById = useMemo(
    () => new Map(channels.map((channel) => [channel.id, channel])),
    [channels],
  )

  useEffect(() => {
    queueMicrotask(() => {
      setActiveIndex(0)
    })

    if (!viewportRef.current) {
      return
    }

    viewportRef.current.scrollTo({ left: 0, behavior: 'auto' })
  }, [slides.length])

  useEffect(() => {
    if (!slides.some((slide) => slide.enableCountdown)) {
      return
    }

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [slides])

  const countdownLabels = useMemo(
    () =>
      slides.map((slide) => {
        if (!slide.enableCountdown || !slide.eventEnd) {
          return null
        }

        const endMs = Date.parse(slide.eventEnd)
        if (Number.isNaN(endMs) || endMs <= nowMs) {
          return null
        }

        const remaining = Math.max(0, Math.floor((endMs - nowMs) / 1000))
        return `Ends in ${formatCountdownClock(remaining)}`
      }),
    [nowMs, slides],
  )

  const syncToIndex = useCallback(
    (nextIndex: number, behavior: ScrollBehavior) => {
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }

      const clamped = Math.max(0, Math.min(nextIndex, slides.length - 1))
      viewport.scrollTo({
        left: viewport.clientWidth * clamped,
        behavior,
      })
    },
    [slides.length],
  )

  useEffect(() => {
    if (slides.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      if (draggingRef.current) {
        return
      }

      setActiveIndex((current) => {
        const next = (current + 1) % slides.length
        syncToIndex(next, 'smooth')
        return next
      })
    }, AUTO_ADVANCE_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [slides.length, syncToIndex])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      syncToIndex(safeIndex, 'auto')
    })

    observer.observe(viewport)
    return () => {
      observer.disconnect()
    }
  }, [safeIndex, syncToIndex])

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget
      const width = viewport.clientWidth || 1
      const next = Math.max(
        0,
        Math.min(slides.length - 1, Math.round(viewport.scrollLeft / width)),
      )

      setActiveIndex((current) => (current === next ? current : next))
    },
    [slides.length],
  )

  if (!slides.length) {
    return (
      <div className="hero-carousel hero-carousel--empty">
        <div className="hero-carousel__skeleton" />
        <div className="hero-carousel__dots hero-carousel__dots--skeleton">
          <span className="hero-carousel__dot" />
          <span className="hero-carousel__dot" />
          <span className="hero-carousel__dot" />
        </div>
      </div>
    )
  }

  return (
    <section className="hero-carousel">
      <div
        ref={viewportRef}
        className="hero-carousel__viewport"
        onScroll={handleScroll}
        onPointerDown={() => {
          draggingRef.current = true
        }}
        onPointerUp={() => {
          draggingRef.current = false
        }}
        onPointerCancel={() => {
          draggingRef.current = false
        }}
        onPointerLeave={() => {
          draggingRef.current = false
        }}
      >
        {slides.map((slide, index) => (
          <div
            className="hero-carousel__slide-touch"
            key={`${slide.id}:${slide.imageUrl ?? ''}`}
          >
            <HeroSlide
              active={index === safeIndex}
              channel={
                slide.redirectChannelId
                  ? channelById.get(slide.redirectChannelId) || null
                  : null
              }
              countdownLabel={countdownLabels[index] ?? null}
              onSelectChannel={onSelectChannel}
              slide={slide}
            />
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <div className="hero-carousel__dots" aria-label="Hero slides">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`hero-carousel__dot${
                index === safeIndex ? ' hero-carousel__dot--active' : ''
              }`}
              onClick={() => {
                setActiveIndex(index)
                syncToIndex(index, 'smooth')
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
