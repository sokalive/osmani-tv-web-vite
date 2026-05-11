import { useEffect, useMemo, useState } from 'react'
import type { BannerRecord, ChannelViewModel } from '../../types/osmani'

type HeroCarouselProps = {
  slides: BannerRecord[]
  channels: ChannelViewModel[]
  onSelectChannel: (channel: ChannelViewModel) => void
}

const AUTO_ADVANCE_MS = 5000

export function HeroCarousel({
  slides,
  channels,
  onSelectChannel,
}: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const safeIndex = slides.length ? activeIndex % slides.length : 0

  useEffect(() => {
    if (slides.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length)
    }, AUTO_ADVANCE_MS)

    return () => {
      window.clearInterval(timer)
    }
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

  const activeSlide = slides[safeIndex] ?? null
  const activeChannel = useMemo(() => {
    if (!activeSlide?.redirectChannelId) {
      return null
    }

    return (
      channels.find((channel) => channel.id === activeSlide.redirectChannelId) || null
    )
  }, [activeSlide, channels])

  const countdownLabel = useMemo(() => {
    if (!activeSlide?.enableCountdown || !activeSlide.eventEnd) {
      return null
    }

    const endMs = Date.parse(activeSlide.eventEnd)
    if (Number.isNaN(endMs) || endMs <= nowMs) {
      return null
    }

    const remaining = Math.max(0, Math.floor((endMs - nowMs) / 1000))
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    const seconds = remaining % 60

    return `Ends in ${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}:${String(seconds).padStart(2, '0')}`
  }, [activeSlide, nowMs])

  if (!activeSlide) {
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
      <button
        type="button"
        className="hero-carousel__slide"
        onClick={() => {
          if (activeChannel) {
            onSelectChannel(activeChannel)
          }
        }}
      >
        {activeSlide.imageUrl ? (
          <img src={activeSlide.imageUrl} alt={activeSlide.title} />
        ) : (
          <div className="hero-carousel__fallback" />
        )}

        <div className="hero-carousel__overlay">
          {countdownLabel ? (
            <span className="hero-carousel__countdown">{countdownLabel}</span>
          ) : null}
          {activeSlide.badgeEnabled && activeSlide.badge ? (
            <span
              className={`hero-carousel__badge${
                activeSlide.badgeBlink ? ' hero-carousel__badge--blink' : ''
              }`}
              style={{ backgroundColor: activeSlide.badgeColor }}
            >
              {activeSlide.badge}
            </span>
          ) : null}
          <h2>{activeSlide.title}</h2>
          {activeSlide.description ? <p>{activeSlide.description}</p> : null}
          {activeChannel ? (
            <span className="hero-carousel__cta">Open {activeChannel.name}</span>
          ) : null}
        </div>
      </button>

      {slides.length > 1 ? (
        <div className="hero-carousel__dots" aria-label="Hero slides">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`hero-carousel__dot${
                index === safeIndex ? ' hero-carousel__dot--active' : ''
              }`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
