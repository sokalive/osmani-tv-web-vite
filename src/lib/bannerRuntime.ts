import type { BannerRecord } from '../types/osmani'

function parseTs(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function isBannerVisibleAt(slide: BannerRecord, nowMs: number) {
  const start = parseTs(slide.eventStart)
  const end = parseTs(slide.eventEnd)

  if (start == null && end == null) {
    return true
  }
  if (end != null && nowMs > end) {
    return false
  }
  if (start != null && end == null) {
    return nowMs >= start
  }
  if (start == null && end != null) {
    return nowMs <= end
  }

  return true
}

export function getCountdownState(slide: BannerRecord, nowMs: number) {
  if (!slide.enableCountdown) {
    return null
  }

  const start = parseTs(slide.eventStart)
  const end = parseTs(slide.eventEnd)

  if (start != null && nowMs < start) {
    return {
      prefix: 'STARTS IN',
      remainingSec: Math.max(0, Math.ceil((start - nowMs) / 1000)),
    }
  }

  if (start != null && end != null && nowMs >= start && nowMs <= end) {
    return {
      prefix: 'ENDS IN',
      remainingSec: Math.max(0, Math.ceil((end - nowMs) / 1000)),
    }
  }

  return null
}

export function formatCountdownClock(totalSec: number) {
  const safe = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
