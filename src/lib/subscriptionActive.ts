import type { SubscriptionStatus } from '../types/osmani'

function parseMs(value: string | number | null | undefined) {
  if (value == null) {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function effectiveNowMs(
  serverTime: string | number | null | undefined,
  serverTimeFetchedAt: number | null | undefined,
  nowMsOverride?: number,
) {
  const localNow =
    typeof nowMsOverride === 'number' && Number.isFinite(nowMsOverride)
      ? nowMsOverride
      : Date.now()
  const anchor = parseMs(serverTime)

  if (anchor == null || !Number.isFinite(serverTimeFetchedAt)) {
    return localNow
  }

  const elapsed = localNow - Number(serverTimeFetchedAt)
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return anchor
  }

  return anchor + elapsed
}

function isInactivePlaybackGateReason(reason: string | null | undefined) {
  const normalized = String(reason || '')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return false
  }

  return (
    normalized.includes('transfer') ||
    normalized.includes('moved') ||
    normalized.includes('other_device') ||
    normalized.includes('expire') ||
    normalized.includes('expired') ||
    normalized.includes('ended') ||
    normalized.includes('revoke') ||
    normalized.includes('revoked') ||
    normalized.includes('blocked') ||
    normalized.includes('suspend')
  )
}

/**
 * True only when the user currently has an active, unexpired subscription on this device.
 * Stale `expiresAt` values from past or transferred subscriptions must not count as active.
 */
export function isSubscriptionEffectivelyActive(
  subscription: SubscriptionStatus | null | undefined,
  options?: { nowMs?: number },
) {
  if (!subscription || subscription.active !== true) {
    return false
  }

  if (isInactivePlaybackGateReason(subscription.playbackGateReason)) {
    return false
  }

  const expiresMs = parseMs(subscription.expiresAt)
  if (expiresMs != null) {
    const nowMs = effectiveNowMs(
      subscription.serverTime,
      subscription.serverTimeFetchedAt,
      options?.nowMs,
    )

    if (expiresMs <= nowMs) {
      return false
    }
  }

  return true
}

export function shouldShowSubscriptionExpiry(
  subscription: SubscriptionStatus | null | undefined,
  options?: { nowMs?: number },
) {
  return (
    isSubscriptionEffectivelyActive(subscription, options) &&
    Boolean(subscription?.expiresAt)
  )
}
