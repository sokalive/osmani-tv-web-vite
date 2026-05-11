const DAY_MS = 24 * 60 * 60 * 1000

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

export function resolveStartMs({
  startedAt,
  expiresAt,
  planDurationDays,
}: {
  startedAt?: string | null
  expiresAt?: string | null
  planDurationDays?: number | null
} = {}) {
  const start = parseMs(startedAt)
  if (start != null) {
    return start
  }

  const end = parseMs(expiresAt)
  const days = Number(planDurationDays)

  if (end != null && Number.isFinite(days) && days > 0) {
    return end - days * DAY_MS
  }

  return null
}

function effectiveNowMs(
  serverTime: string | number | null | undefined,
  serverTimeFetchedAt: number | null | undefined,
  nowMsOverride?: number | null,
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

export function computeSubscriptionProgress({
  startedAt = null,
  expiresAt = null,
  planDurationDays = null,
  serverTime = null,
  serverTimeFetchedAt = null,
  nowMsOverride = null,
}: {
  startedAt?: string | null
  expiresAt?: string | null
  planDurationDays?: number | null
  serverTime?: string | null
  serverTimeFetchedAt?: number | null
  nowMsOverride?: number | null
} = {}) {
  const expiresMs = parseMs(expiresAt)
  const startMs = resolveStartMs({ startedAt, expiresAt, planDurationDays })
  const nowMs = effectiveNowMs(serverTime, serverTimeFetchedAt, nowMsOverride)

  if (expiresMs == null || startMs == null || expiresMs <= startMs) {
    return {
      ok: false,
      percentRemaining: 0,
      percentUsed: 0,
      remainingMs: 0,
      remainingDays: 0,
      totalDurationMs: 0,
      startMs,
      expiresMs,
      nowMs,
    }
  }

  const totalDurationMs = expiresMs - startMs
  const remainingMs = Math.max(0, expiresMs - nowMs)
  const percentRemaining = Math.max(
    0,
    Math.min(100, (remainingMs / totalDurationMs) * 100),
  )

  return {
    ok: true,
    percentRemaining,
    percentUsed: 100 - percentRemaining,
    remainingMs,
    remainingDays: Math.max(0, Math.ceil(remainingMs / DAY_MS)),
    totalDurationMs,
    startMs,
    expiresMs,
    nowMs,
  }
}
