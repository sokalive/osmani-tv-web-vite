import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { env } from '../../config/env'
import { getSessionToken } from '../../services/auth/session'
import {
  getRealtimeDebugSnapshot,
  subscribeRealtimeDebug,
} from '../../services/realtimeSync'
import type { UpdateRuntimeSnapshot } from '../../hooks/useUpdateRuntime'

const TAP_WINDOW_MS = 2000
const TAP_THRESHOLD = 7
const UPDATE_DEBUG_ENDPOINT_URL = `${env.osmaniAdminApiUrl.replace(/\/+$/, '')}/api/update-debug`

const visibilityListeners = new Set<(visible: boolean) => void>()
let overlayVisible = false

type EndpointStatus = {
  state: 'idle' | 'fetching' | 'done'
  httpStatus: number | null
  body: unknown
  error: string | null
  fetchedAt: number
}

type OtaDebugOverlayProps = {
  runtimeSnapshot?: UpdateRuntimeSnapshot | null
  onForceRecheck?: () => void
}

function setOverlayVisible(next: boolean) {
  overlayVisible = Boolean(next)

  visibilityListeners.forEach((listener) => {
    try {
      listener(overlayVisible)
    } catch {
      return
    }
  })
}

function subscribeVisibility(listener: (visible: boolean) => void) {
  visibilityListeners.add(listener)

  try {
    listener(overlayVisible)
  } catch {
    return () => visibilityListeners.delete(listener)
  }

  return () => {
    visibilityListeners.delete(listener)
  }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function pickBoolean(value: unknown) {
  return value === true
}

function formatTimestamp(value: unknown) {
  if (!value) {
    return '—'
  }

  try {
    const date = new Date(value as string | number | Date)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString()
  } catch {
    return String(value)
  }
}

function formatBoolean(value: unknown) {
  return value ? 'true' : 'false'
}

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function normalizeInfo(
  payload: Record<string, unknown> | null,
  runtimeSnapshot: UpdateRuntimeSnapshot | null | undefined,
) {
  const runtimeInfo = runtimeSnapshot?.info

  return {
    source:
      pickString(runtimeInfo?.source, payload?.source) || '',
    apkUrl:
      pickString(runtimeInfo?.apkUrl, payload?.apkUrl, payload?.apk_url) || '',
    playStoreUrl:
      pickString(
        runtimeInfo?.playStoreUrl,
        payload?.playStoreUrl,
        payload?.play_store_url,
        payload?.playstore_url,
      ) || '',
    apkSha256:
      pickString(runtimeInfo?.apkSha256, payload?.apkSha256, payload?.apk_sha256) || '',
    autoDownload:
      runtimeInfo?.autoDownload === true ||
      pickBoolean(payload?.autoDownload) ||
      pickBoolean(payload?.auto_download),
    latestVersionName:
      pickString(
        runtimeInfo?.latestVersionName,
        payload?.latestVersionName,
        payload?.latest_version_name,
      ) || '',
    latestVersionCode:
      runtimeInfo?.latestVersionCode ??
      payload?.latestVersionCode ??
      payload?.latest_version_code ??
      null,
    installedVersionName:
      pickString(runtimeInfo?.installedVersionName) || '',
    installedVersionCode:
      runtimeInfo?.installedVersionCode ?? null,
    notice:
      pickString(runtimeInfo?.notice, payload?.notice) || '',
    releaseNotes:
      pickString(runtimeInfo?.releaseNotes, payload?.releaseNotes, payload?.release_notes) || '',
  }
}

function getDebugSnapshot(
  visible: boolean,
  endpointStatus: EndpointStatus,
  runtimeSnapshot: UpdateRuntimeSnapshot | null | undefined,
  realtimeSnapshot: ReturnType<typeof getRealtimeDebugSnapshot>,
) {
  const root = asRecord(endpointStatus.body)
  const backendInfo = asRecord(root?.latest_update_payload)
  const latestClientCheck = asRecord(root?.latest_client_check)
  const sseStatus = asRecord(root?.sse_status)
  const currentSettings = asRecord(root?.current_settings)
  const info = normalizeInfo(backendInfo, runtimeSnapshot)

  return {
    platform: 'web',
    nativeAvailable: false,
    started: Boolean(runtimeSnapshot?.started),
    overlayVisible: visible,
    decision:
      pickString(runtimeSnapshot?.decision, root?.current_decision, root?.decision) || '—',
    info,
    lastCheckAt:
      runtimeSnapshot?.lastCheckAt ??
      latestClientCheck?.at ??
      endpointStatus.fetchedAt ??
      0,
    lastUpdateInfoAt:
      runtimeSnapshot?.lastUpdateInfoAt ??
      latestClientCheck?.at ??
      endpointStatus.fetchedAt ??
      0,
    base: pickString(runtimeSnapshot?.base, env.osmaniAdminApiUrl) || '—',
    lastCheckError:
      pickString(runtimeSnapshot?.lastCheckError, endpointStatus.error) || '',
    sse: {
      connected: realtimeSnapshot.connected,
      url: realtimeSnapshot.url,
      attemptIndex: realtimeSnapshot.attemptIndex,
      lastOpenAt: realtimeSnapshot.lastOpenAt,
      lastEventAt: realtimeSnapshot.lastEventAt,
      lastError: realtimeSnapshot.lastError,
      activeClientsCount:
        typeof sseStatus?.active_clients_count === 'number'
          ? sseStatus.active_clients_count
          : typeof root?.active_clients_count === 'number'
            ? root.active_clients_count
            : 0,
      events: Array.isArray(sseStatus?.events) ? sseStatus.events : [],
    },
    overlayState: {
      downloading: runtimeSnapshot?.downloading === true,
      verifying: runtimeSnapshot?.verifying === true,
      installing: runtimeSnapshot?.installing === true,
      needsUnknownSourcesPermission:
        runtimeSnapshot?.needsUnknownSourcesPermission === true,
      failedReason: pickString(runtimeSnapshot?.failedReason),
      progress: runtimeSnapshot?.progress ?? null,
    },
    currentSettings,
    latestClientCheck,
    endpointStatus,
  }
}

function showOtaDebugOverlay() {
  if (!import.meta.env.DEV) {
    return
  }

  setOverlayVisible(true)
}

function hideOtaDebugOverlay() {
  setOverlayVisible(false)
}

export function OtaDebugTitleTap({
  children,
  threshold = TAP_THRESHOLD,
}: {
  children: ReactNode
  threshold?: number
}) {
  const tapsRef = useRef<number[]>([])

  if (!import.meta.env.DEV) {
    return <>{children}</>
  }

  return (
    <span
      className="ota-debug-title-tap"
      onClick={() => {
        const now = Date.now()
        const cutoff = now - TAP_WINDOW_MS
        tapsRef.current = tapsRef.current.filter((timestamp) => timestamp >= cutoff)
        tapsRef.current.push(now)

        if (tapsRef.current.length >= threshold) {
          tapsRef.current = []
          showOtaDebugOverlay()
        }
      }}
    >
      {children}
    </span>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="ota-debug-overlay__section">
      <h3 className="ota-debug-overlay__section-title">{title}</h3>
      <div className="ota-debug-overlay__section-body">{children}</div>
    </section>
  )
}

function Row({
  label,
  mono = false,
  value,
  valueColor = '',
}: {
  label: string
  mono?: boolean
  value: unknown
  valueColor?: string
}) {
  return (
    <div className="ota-debug-overlay__row">
      <div className="ota-debug-overlay__row-label">{label}</div>
      <div
        className={`ota-debug-overlay__row-value${
          mono ? ' ota-debug-overlay__row-value--mono' : ''
        }`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {String(value ?? '—')}
      </div>
    </div>
  )
}

function BugIcon() {
  return (
    <svg className="ota-debug-overlay__bug-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 9.5h8M9.5 6.5 12 4l2.5 2.5M8 14.5h8M12 8v9M6 10 4 8M18 10l2-2M6 14l-2 2M18 14l2 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="ota-debug-overlay__close-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function OtaDebugOverlay({
  runtimeSnapshot = null,
  onForceRecheck,
}: OtaDebugOverlayProps) {
  const [visible, setVisible] = useState(false)
  const [endpointStatus, setEndpointStatus] = useState<EndpointStatus>({
    state: 'idle',
    httpStatus: null,
    body: null,
    error: null,
    fetchedAt: 0,
  })
  const [realtimeSnapshot, setRealtimeSnapshot] = useState(
    getRealtimeDebugSnapshot(),
  )

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    return subscribeVisibility(setVisible)
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    return subscribeRealtimeDebug(setRealtimeSnapshot)
  }, [])

  const fetchEndpoint = useCallback(async () => {
    const token = getSessionToken()
    const headers = new Headers({ Accept: 'application/json' })

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    setEndpointStatus((previous) => ({
      ...previous,
      state: 'fetching',
      error: null,
    }))

    try {
      const response = await fetch(UPDATE_DEBUG_ENDPOINT_URL, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers,
      })
      const text = await response.text()

      let body: unknown = text
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = text
      }

      setEndpointStatus({
        state: 'done',
        httpStatus: response.status,
        body,
        error: response.ok ? null : `HTTP ${response.status}`,
        fetchedAt: Date.now(),
      })
    } catch (error) {
      setEndpointStatus({
        state: 'done',
        httpStatus: null,
        body: null,
        error: error instanceof Error ? error.message : 'fetch failed',
        fetchedAt: Date.now(),
      })
    }
  }, [])

  useEffect(() => {
    if (!visible || !import.meta.env.DEV) {
      return
    }

    queueMicrotask(() => {
      void fetchEndpoint()
    })

    const interval = window.setInterval(() => {
      void fetchEndpoint()
    }, 4000)

    return () => {
      window.clearInterval(interval)
    }
  }, [fetchEndpoint, visible])

  const snapshot = useMemo(
    () => getDebugSnapshot(visible, endpointStatus, runtimeSnapshot, realtimeSnapshot),
    [endpointStatus, realtimeSnapshot, runtimeSnapshot, visible],
  )

  const info = snapshot.info
  const overlayState = snapshot.overlayState
  const progress = asRecord(overlayState.progress)
  const decisionColor =
    snapshot.decision === 'FORCE'
      ? '#f87171'
      : snapshot.decision === 'SOFT'
        ? '#fbbf24'
        : snapshot.decision === 'PLAY_STORE'
          ? '#60a5fa'
          : '#9aa3b2'

  if (!visible || !import.meta.env.DEV) {
    return null
  }

  return (
    <div className="ota-debug-overlay" role="dialog" aria-modal="true">
      <div className="ota-debug-overlay__scrim">
        <div className="ota-debug-overlay__card">
          <div className="ota-debug-overlay__header">
            <div className="ota-debug-overlay__header-left">
              <BugIcon />
              <div className="ota-debug-overlay__header-title">OTA Debug</div>
            </div>
            <button
              type="button"
              className="ota-debug-overlay__close-btn"
              onClick={hideOtaDebugOverlay}
              aria-label="Close OTA debug overlay"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="ota-debug-overlay__body">
            <Section title="Status">
              <Row label="Platform" value={snapshot.platform} />
              <Row
                label="Native module detected"
                value={formatBoolean(snapshot.nativeAvailable)}
                valueColor={snapshot.nativeAvailable ? '#34d399' : '#f87171'}
              />
              <Row
                label="Update client started"
                value={formatBoolean(snapshot.started)}
                valueColor={snapshot.started ? '#34d399' : '#9aa3b2'}
              />
              <Row
                label="Overlay visible"
                value={formatBoolean(snapshot.overlayVisible)}
                valueColor={snapshot.overlayVisible ? '#fbbf24' : '#9aa3b2'}
              />
            </Section>

            <Section title="Decision">
              <Row label="decision" value={snapshot.decision} valueColor={decisionColor} />
              <Row label="source" value={pickString(info?.source) || '—'} />
              <Row label="apk_url" value={pickString(info?.apkUrl) || '—'} mono />
              <Row
                label="playstore_url"
                value={pickString(info?.playStoreUrl) || '—'}
                mono
              />
              <Row label="apk_sha256" value={pickString(info?.apkSha256) || '—'} mono />
              <Row
                label="auto_download"
                value={formatBoolean(pickBoolean(info?.autoDownload))}
              />
              <Row
                label="latest_version_name"
                value={pickString(info?.latestVersionName) || '—'}
              />
              <Row
                label="latest_version_code"
                value={String(info?.latestVersionCode ?? '—')}
              />
              <Row
                label="installed_version_name"
                value={pickString(info?.installedVersionName) || '—'}
              />
              <Row
                label="installed_version_code"
                value={String(info?.installedVersionCode ?? '—')}
              />
              <Row label="notice" value={pickString(info?.notice) || '—'} />
            </Section>

            <Section title="Last update-check">
              <Row label="lastCheckAt" value={formatTimestamp(snapshot.lastCheckAt)} />
              <Row
                label="lastUpdateInfoAt"
                value={formatTimestamp(snapshot.lastUpdateInfoAt)}
              />
              <Row label="base" value={snapshot.base} mono />
              <Row
                label="error"
                value={snapshot.lastCheckError || '—'}
                valueColor={snapshot.lastCheckError ? '#f87171' : '#9aa3b2'}
              />
              <button
                type="button"
                className="ota-debug-overlay__btn"
                onClick={() => {
                  onForceRecheck?.()
                  void fetchEndpoint()
                }}
              >
                Re-check now
              </button>
            </Section>

            <Section title="SSE">
              <Row
                label="connected"
                value={formatBoolean(snapshot.sse.connected)}
                valueColor={snapshot.sse.connected ? '#34d399' : '#f87171'}
              />
              <Row label="url" value={snapshot.sse.url || '—'} mono />
              <Row label="attemptIndex" value={String(snapshot.sse.attemptIndex)} />
              <Row label="lastOpenAt" value={formatTimestamp(snapshot.sse.lastOpenAt)} />
              <Row label="lastEventAt" value={formatTimestamp(snapshot.sse.lastEventAt)} />
              <Row
                label="backend_active_clients"
                value={String(snapshot.sse.activeClientsCount ?? 0)}
              />
              <Row
                label="backend_events"
                value={
                  Array.isArray(snapshot.sse.events) && snapshot.sse.events.length
                    ? snapshot.sse.events.join(', ')
                    : '—'
                }
              />
              <Row
                label="lastError"
                value={snapshot.sse.lastError || '—'}
                valueColor={snapshot.sse.lastError ? '#f87171' : '#9aa3b2'}
              />
            </Section>

            <Section title="Overlay state">
              <Row
                label="downloading"
                value={formatBoolean(overlayState.downloading)}
              />
              <Row label="verifying" value={formatBoolean(overlayState.verifying)} />
              <Row
                label="installing"
                value={formatBoolean(overlayState.installing)}
              />
              <Row
                label="needsUnknownSourcesPermission"
                value={formatBoolean(overlayState.needsUnknownSourcesPermission)}
              />
              <Row
                label="failedReason"
                value={overlayState.failedReason || '—'}
                valueColor={overlayState.failedReason ? '#f87171' : '#9aa3b2'}
              />
              <Row
                label="progress.percent"
                value={String(progress?.percent ?? '—')}
              />
              <Row
                label="progress.bytes"
                value={`${progress?.downloaded ?? 0}/${progress?.total ?? 0}`}
              />
            </Section>

            <Section title="Backend snapshot">
              <Row
                label="current_decision"
                value={pickString(snapshot.endpointStatus.body && asRecord(snapshot.endpointStatus.body)?.current_decision) || '—'}
              />
              <Row
                label="latest_client_check"
                value={formatTimestamp(snapshot.latestClientCheck?.at)}
              />
              <Row
                label="server_time"
                value={formatTimestamp(asRecord(snapshot.endpointStatus.body)?.server_time)}
              />
              <pre className="ota-debug-overlay__code">
                {snapshot.currentSettings
                  ? stringifyJson(snapshot.currentSettings)
                  : '(no current_settings yet)'}
              </pre>
            </Section>

            <Section
              title={`/api/update-debug — ${snapshot.endpointStatus.httpStatus ?? snapshot.endpointStatus.state}`}
            >
              <Row label="endpoint" value={UPDATE_DEBUG_ENDPOINT_URL} mono />
              <Row
                label="last fetch"
                value={formatTimestamp(snapshot.endpointStatus.fetchedAt)}
              />
              <Row
                label="error"
                value={snapshot.endpointStatus.error || '—'}
                valueColor={snapshot.endpointStatus.error ? '#f87171' : '#9aa3b2'}
              />
              <button
                type="button"
                className="ota-debug-overlay__btn"
                onClick={() => {
                  void fetchEndpoint()
                }}
              >
                Fetch now
              </button>
              <pre className="ota-debug-overlay__code">
                {snapshot.endpointStatus.body == null
                  ? '(no body yet)'
                  : stringifyJson(snapshot.endpointStatus.body)}
              </pre>
            </Section>

            <Section title="Latest backend update payload">
              <pre className="ota-debug-overlay__code">
                {info ? stringifyJson(info) : '(no payload yet)'}
              </pre>
            </Section>

            <Section title="Snapshot (debug)">
              <pre className="ota-debug-overlay__code">
                {stringifyJson(snapshot)}
              </pre>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
