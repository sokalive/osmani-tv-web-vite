import type {
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../types/osmani'
import { osmaniAdminClient } from './osmaniAdminClient'

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/,/g, ''))
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

function pickActive(body: PlainObject) {
  const candidates = [
    body.active,
    body.is_active,
    body.isActive,
    body.has_subscription,
    body.subscribed,
  ]

  for (const candidate of candidates) {
    if (candidate === true || candidate === 1) {
      return true
    }

    if (candidate === false || candidate === 0) {
      return false
    }

    if (typeof candidate === 'string') {
      const value = candidate.trim().toLowerCase()
      if (['true', '1', 'yes', 'active', 'paid', 'live', 'ok'].includes(value)) {
        return true
      }
      if (['false', '0', 'no', 'inactive'].includes(value)) {
        return false
      }
    }
  }

  const status = pickString(body.status, body.state)?.toLowerCase()
  return status ? ['active', 'paid', 'live', 'ok', 'success'].includes(status) : false
}

function normalizePlanRow(raw: unknown): SubscriptionPlan | null {
  if (!isPlainObject(raw)) {
    return null
  }

  const id = pickString(raw.id, raw.plan_id, raw.slug, raw.code)
  const name = pickString(raw.name, raw.title, raw.label)

  if (!name) {
    return null
  }

  return {
    id: id || name.toLowerCase().replace(/[^a-z0-9_-]+/gi, '-'),
    name,
    price:
      pickNumber(raw.price, raw.amount, raw.Price, raw.Amount) ?? 0,
    duration:
      pickString(
        raw.duration_days,
        raw.durationDays,
        raw.days,
        raw.validity_days,
        raw.validityDays,
        raw.period_days,
        raw.periodDays,
        raw.duration,
        raw.duration_label,
        raw.duration_text,
      ) || '',
    isActive:
      raw.is_active === true ||
      raw.isActive === true ||
      raw.active === true ||
      raw.enabled === true,
  }
}

function pickPlans(body: PlainObject) {
  const data = isPlainObject(body.data) ? body.data : null
  const subscription = isPlainObject(body.subscription) ? body.subscription : null

  const rawLists = [
    body.plans,
    body.available_plans,
    data?.plans,
    subscription?.plans,
  ]

  for (const rawList of rawLists) {
    if (Array.isArray(rawList)) {
      return rawList
        .map(normalizePlanRow)
        .filter((item): item is SubscriptionPlan => Boolean(item))
    }
  }

  return [] as SubscriptionPlan[]
}

function pickProviderLogoUrl(raw: PlainObject) {
  return (
    pickString(
      raw.logoUrl,
      raw.logo_url,
      raw.logoURL,
      raw.logo,
      raw.image,
      raw.image_url,
      raw.imageUrl,
    ) || null
  )
}

function normalizeProviderRow(raw: unknown): PaymentProvider | null {
  if (!isPlainObject(raw)) {
    return null
  }

  const name = pickString(raw.name, raw.title, raw.label)
  if (!name) {
    return null
  }

  return {
    id:
      pickString(raw.id, raw.provider_id, raw.code, raw.slug) ||
      name.toLowerCase().replace(/[^a-z0-9_-]+/gi, '-'),
    name,
    logoUrl: pickProviderLogoUrl(raw),
    active:
      raw.active !== false &&
      raw.is_active !== false &&
      raw.isActive !== false &&
      raw.enabled !== false,
  }
}

function normalizeVerifyResponse(payload: unknown): SubscriptionStatus {
  if (!isPlainObject(payload)) {
    return {
      active: false,
      expiresAt: null,
      startedAt: null,
      serverTime: null,
      serverTimeFetchedAt: Date.now(),
      amount: null,
      currency: null,
      planName: null,
      planDurationDays: null,
      plans: [],
      deviceId: null,
      manualGiftAckKey: null,
      raw: payload,
    }
  }

  const data = isPlainObject(payload.data) ? payload.data : null
  const subscription = isPlainObject(payload.subscription) ? payload.subscription : null
  const nested = subscription || data || payload
  const payment = isPlainObject(payload.payment) ? payload.payment : null
  const plan = isPlainObject(payload.plan)
    ? payload.plan
    : isPlainObject(subscription?.plan)
      ? subscription.plan
      : isPlainObject(data?.plan)
        ? data.plan
        : null

  return {
    active: pickActive(payload),
    expiresAt: pickString(
      payload.expires_at,
      payload.expiresAt,
      data?.expires_at,
      data?.expiresAt,
      subscription?.expires_at,
      subscription?.expiresAt,
      nested.expires_at,
      nested.expiresAt,
    ),
    startedAt: pickString(
      payload.started_at,
      payload.startedAt,
      data?.started_at,
      data?.startedAt,
      subscription?.started_at,
      subscription?.startedAt,
      nested.started_at,
      nested.startedAt,
    ),
    serverTime: pickString(
      payload.server_time,
      payload.serverTime,
      data?.server_time,
      data?.serverTime,
    ),
    serverTimeFetchedAt: Date.now(),
    amount: pickNumber(
      payload.amount,
      payload.price,
      payment?.amount,
      payment?.price,
      plan?.price,
      plan?.amount,
    ),
    currency:
      pickString(
        payload.currency,
        payment?.currency,
        payment?.currency_code,
        plan?.currency,
        plan?.currency_code,
      ) || 'TZS',
    planName:
      pickString(
        plan?.name,
        plan?.title,
        subscription?.plan_name,
        subscription?.planName,
        payload.plan_name,
        payload.planName,
      ) || null,
    planDurationDays: pickNumber(
      plan?.duration_days,
      plan?.durationDays,
      plan?.days,
      plan?.plan_duration_days,
      plan?.planDurationDays,
      subscription?.plan_duration_days,
      subscription?.planDurationDays,
      payload.plan_duration_days,
      payload.planDurationDays,
      data?.plan_duration_days,
      data?.planDurationDays,
      data?.duration_days,
      data?.durationDays,
    ),
    plans: pickPlans(payload),
    deviceId: pickString(payload.device_id, payload.deviceId),
    manualGiftAckKey:
      pickString(
        payload.manualGiftAckKey,
        payload.manual_gift_ack_key,
        payment?.manualGiftAckKey,
        payment?.manual_gift_ack_key,
      ) || null,
    raw: payload,
  }
}

function withTransferPrefix(raw: string) {
  const value = String(raw || '').trim()
  if (!value) {
    return ''
  }

  return /^TR[-_]/i.test(value)
    ? value.toUpperCase().replace(/^TR_/, 'TR-')
    : `TR-${value}`
}

function stripTransferPrefix(raw: string) {
  return String(raw || '')
    .trim()
    .replace(/^TR[\s\-_]*/i, '')
}

function pickTransferCode(body: PlainObject) {
  return pickString(
    body.code,
    body.transfer_code,
    isPlainObject(body.transfer) ? body.transfer.code : null,
    isPlainObject(body.data) ? body.data.code : null,
  )
}

function pickOrderId(body: PlainObject) {
  return pickString(
    body.order_id,
    body.orderId,
    isPlainObject(body.data) ? body.data.order_id : null,
    isPlainObject(body.data) ? body.data.orderId : null,
    isPlainObject(body.transaction) ? body.transaction.order_id : null,
  )
}

function mapOfferRedeemErrorMessage(body: PlainObject, httpStatus?: number) {
  const joined = `${pickString(body.error, body.message) || ''} ${
    pickString(body.code, body.reason) || ''
  }`.toLowerCase()

  if (
    joined.includes('already') ||
    joined.includes('other device') ||
    joined.includes('other_device') ||
    joined.includes('imetumika')
  ) {
    return 'Code hii tayari imetumika kwenye kifaa kingine'
  }

  if (
    joined.includes('expired') ||
    joined.includes('imeisha') ||
    joined.includes('muda')
  ) {
    return 'Code hii imeisha muda wake'
  }

  if (
    joined.includes('invalid') ||
    joined.includes('wrong') ||
    joined.includes('si sahihi') ||
    httpStatus === 400 ||
    httpStatus === 404 ||
    httpStatus === 422
  ) {
    return 'Code si sahihi'
  }

  return 'Code si sahihi'
}

function normalizePaymentProviders(payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : isPlainObject(payload) && Array.isArray(payload.providers)
      ? payload.providers
      : isPlainObject(payload) && Array.isArray(payload.data)
        ? payload.data
        : []

  return rows
    .map(normalizeProviderRow)
    .filter((item): item is PaymentProvider => Boolean(item && item.active))
}

export async function verifySubscription(
  deviceId: string,
  deviceFingerprint: string,
) {
  const payload = await osmaniAdminClient.post<unknown>('/api/subscription/verify', {
    device_id: deviceId,
    device_fingerprint: deviceFingerprint,
  })

  return normalizeVerifyResponse(payload)
}

export async function fetchSubscriptionStatus(deviceId: string) {
  const payload = await osmaniAdminClient.get<unknown>(
    `/api/subscription-status?device_id=${encodeURIComponent(deviceId)}`,
  )

  return normalizeVerifyResponse(payload)
}

export async function redeemOfferCode(
  deviceId: string,
  deviceFingerprint: string,
  offerCode: string,
) {
  try {
    await osmaniAdminClient.post<unknown>('/api/subscription/redeem-offer-code', {
      device_id: deviceId,
      device_fingerprint: deviceFingerprint,
      offer_code: String(offerCode).trim(),
    })

    return { ok: true as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Offer redeem failed'
    const responseBody =
      error instanceof Error && 'responseBody' in error
        ? String((error as { responseBody?: string }).responseBody || '')
        : ''
    const status =
      error instanceof Error && 'status' in error
        ? Number((error as { status?: number }).status ?? 0)
        : 0

    let parsed: PlainObject
    try {
      parsed = JSON.parse(responseBody) as PlainObject
    } catch {
      parsed = {}
    }

    if (parsed.locked === true || parsed.locked === 1 || parsed.locked === 'true') {
      return {
        ok: false as const,
        locked: true as const,
        remainingSeconds:
          pickNumber(parsed.remaining_seconds, parsed.remainingSeconds) ?? 0,
      }
    }

    return {
      ok: false as const,
      locked: false as const,
      message:
        mapOfferRedeemErrorMessage(parsed, status) ||
        message ||
        'Code si sahihi',
    }
  }
}

export async function initiateTransfer(
  deviceId: string,
  deviceFingerprint: string,
  phone: string,
) {
  const payload = await osmaniAdminClient.post<unknown>('/api/transfer/request', {
    source_device_id: deviceId,
    target_device_id: deviceId,
    device_id: deviceId,
    device_fingerprint: deviceFingerprint,
    phone: String(phone || '').replace(/[^\d]/g, ''),
  })

  if (!isPlainObject(payload)) {
    throw new Error('Transfer code missing in response')
  }

  const code = pickTransferCode(payload)
  if (!code) {
    throw new Error('Transfer code missing in response')
  }

  return {
    code: stripTransferPrefix(code),
    expiresAt:
      pickString(payload.expires_at, payload.expiresAt) ||
      null,
  }
}

export async function redeemTransfer(
  code: string,
  deviceId: string,
  deviceFingerprint: string,
) {
  const payload = await osmaniAdminClient.post<unknown>('/api/transfer/confirm', {
    code: withTransferPrefix(code),
    target_device_id: deviceId,
    device_id: deviceId,
    device_fingerprint: deviceFingerprint,
  })

  if (!isPlainObject(payload)) {
    return { status: 'unknown', active: false, expiresAt: null }
  }

  const status = pickString(payload.status, payload.state)?.toLowerCase() || ''
  if (
    status === 'pending' ||
    status === 'awaiting_confirmation' ||
    status === 'awaiting_approval' ||
    payload.pending === true ||
    payload.awaiting_confirmation === true
  ) {
    return {
      status: 'pending',
      active: false,
      expiresAt: pickString(payload.expires_at, payload.expiresAt),
    } as const
  }

  const verified = normalizeVerifyResponse(payload)
  return {
    status: verified.active ? 'approved' : 'unknown',
    active: verified.active,
    expiresAt: verified.expiresAt,
  } as const
}

export async function getTransferStatus(code: string) {
  const trimmed = String(code ?? '').trim()
  if (!trimmed) {
    return { status: 'unknown', pending: false }
  }

  const prefixed = withTransferPrefix(trimmed)
  const paths = [
    `/api/transfer/status/${encodeURIComponent(prefixed)}`,
    `/api/transfer/status?code=${encodeURIComponent(prefixed)}`,
    `/api/transfer/${encodeURIComponent(prefixed)}`,
    `/api/transfer/poll/${encodeURIComponent(prefixed)}`,
    `/api/transfer/info/${encodeURIComponent(prefixed)}`,
    `/api/subscription/transfer/${encodeURIComponent(prefixed)}`,
    `/api/subscription/transfer/status/${encodeURIComponent(prefixed)}`,
  ]

  for (const path of paths) {
    try {
      const payload = await osmaniAdminClient.get<unknown>(path)
      if (!isPlainObject(payload)) {
        continue
      }

      const status = pickString(payload.status, payload.state) || 'ok'
      const pending =
        status.toLowerCase().includes('pending') ||
        payload.pending === true ||
        payload.awaiting_confirmation === true

      return { status, pending }
    } catch {
      continue
    }
  }

  return { status: 'unknown', pending: false }
}

export async function getPlans() {
  const payload = await osmaniAdminClient.get<unknown>('/api/plans')

  const rows = Array.isArray(payload)
    ? payload
    : isPlainObject(payload) && Array.isArray(payload.plans)
      ? payload.plans
      : isPlainObject(payload) && Array.isArray(payload.data)
        ? payload.data
        : []

  return rows
    .map(normalizePlanRow)
    .filter((item): item is SubscriptionPlan => Boolean(item && item.isActive))
}

export async function getPaymentProviders() {
  const payload = await osmaniAdminClient.get<unknown>('/api/payment-providers')
  return normalizePaymentProviders(payload)
}

export async function createPayment({
  phone,
  planId,
  amount,
  deviceId,
  deviceFingerprint,
}: {
  phone: string
  planId: string
  amount: number
  deviceId: string
  deviceFingerprint: string
}) {
  const payload = await osmaniAdminClient.post<unknown>(
    '/api/payments/create-payment',
    {
      phone,
      plan_id: planId,
      amount,
      device_id: deviceId,
      device_fingerprint: deviceFingerprint,
    },
  )

  if (!isPlainObject(payload)) {
    throw new Error('Missing order_id from server')
  }

  const orderId = pickOrderId(payload)
  if (!orderId) {
    throw new Error('Missing order_id from server')
  }

  return {
    orderId,
    expiresInSeconds:
      pickNumber(payload.expires_in_seconds, payload.expiresIn, payload.timeout_seconds) ??
      null,
  }
}

export async function getPaymentStatus(orderId: string) {
  const payload = await osmaniAdminClient.get<unknown>(
    `/api/payment-status/${encodeURIComponent(orderId)}`,
  )

  if (!isPlainObject(payload)) {
    return { status: 'PENDING', reason: '' as string }
  }

  return {
    status: (pickString(payload.status) || 'PENDING').toUpperCase(),
    reason: pickString(payload.reason, payload.error) || '',
  }
}
