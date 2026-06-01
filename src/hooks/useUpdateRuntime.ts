import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { env } from '../config/env'
import { isWebBrowser } from '../lib/platform'
import { subscribeRealtimeEvent } from '../services/realtimeSync'
import { getDeviceIdentity } from '../services/auth/deviceIdentity'

type UpdateDecision = 'NONE' | 'SOFT' | 'FORCE' | 'PLAY_STORE' | string

type UpdateInfo = {
  decision: UpdateDecision
  latestVersionCode: number
  latestVersionName: string
  minSupportedVersionCode: number
  autoDownload: boolean
  apkUrl: string
  apkSha256: string
  apkSizeBytes: number
  playStoreUrl: string
  releaseNotes: string
  notice: string
  source: string
  installedVersionCode: number
  installedVersionName: string
}

type UpdateAction = {
  canDownload: boolean
  canOpenStore: boolean
  downloadUrl: string
  storeUrl: string
}

export type UpdateRuntimeSnapshot = {
  started: boolean
  visible: boolean
  decision: UpdateDecision
  info: UpdateInfo | null
  action: UpdateAction
  downloading: boolean
  verifying: boolean
  installing: boolean
  needsUnknownSourcesPermission: boolean
  failedReason: string
  progress: { percent: number; downloaded: number; total: number }
  lastCheckAt: number
  lastUpdateInfoAt: number
  lastCheckError: string
  base: string
  lastCheckRequestUrl: string
}

const RECHECK_DEBOUNCE_MS = 1500
const RESUME_RECHECK_GUARD_MS = 30000

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim())
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

function pickBoolean(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true
      }
      if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false
      }
    }
  }

  return false
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function resolveUpdateCheckUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  return new URL(
    `${env.osmaniAdminApiUrl.replace(/\/+$/, '')}/api/update-check`,
    window.location.origin,
  ).toString()
}

function normalizeUpdateInfo(payload: unknown): UpdateInfo {
  const body = isPlainObject(payload) ? payload : {}

  return {
    decision: pickString(body.decision) || 'NONE',
    latestVersionCode: pickNumber(
      body.latest_version_code,
      body.latestVersionCode,
    ),
    latestVersionName:
      pickString(body.latest_version_name, body.latestVersionName) || '',
    minSupportedVersionCode: pickNumber(
      body.min_supported_version_code,
      body.minSupportedVersionCode,
    ),
    autoDownload: pickBoolean(body.auto_download, body.autoDownload),
    apkUrl: pickString(body.apk_url, body.apkUrl),
    apkSha256: pickString(body.apk_sha256, body.apkSha256),
    apkSizeBytes: pickNumber(body.apk_size_bytes, body.apkSizeBytes),
    playStoreUrl: pickString(
      body.play_store_url,
      body.playstore_url,
      body.playStoreUrl,
    ),
    releaseNotes: pickString(body.release_notes, body.releaseNotes),
    notice: pickString(body.notice),
    source: pickString(body.source),
    installedVersionCode: env.updateInstalledVersionCode,
    installedVersionName: env.updateInstalledVersionName,
  }
}

function shouldShowApkUpdateOverlay(decision: UpdateDecision) {
  if (isWebBrowser()) {
    return false
  }

  return decision === 'SOFT' || decision === 'FORCE' || decision === 'PLAY_STORE'
}

function getAction(info: UpdateInfo | null): UpdateAction {
  const downloadUrl =
    info?.apkUrl && !/^(market:\/\/|https?:\/\/play\.google\.com\/)/i.test(info.apkUrl)
      ? info.apkUrl
      : ''
  const storeUrl = pickString(info?.playStoreUrl) || (!downloadUrl ? pickString(info?.apkUrl) : '')

  return {
    canDownload: Boolean(downloadUrl),
    canOpenStore: Boolean(storeUrl),
    downloadUrl,
    storeUrl,
  }
}

function openExternalUrl(url: string) {
  if (!url || typeof window === 'undefined') {
    return false
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (opened) {
    return true
  }

  window.location.assign(url)
  return true
}

export function useUpdateRuntime() {
  const [state, setState] = useState<UpdateRuntimeSnapshot>(() => ({
    started: false,
    visible: false,
    decision: 'NONE',
    info: null,
    action: getAction(null),
    downloading: false,
    verifying: false,
    installing: false,
    needsUnknownSourcesPermission: false,
    failedReason: '',
    progress: { percent: -1, downloaded: 0, total: 0 },
    lastCheckAt: 0,
    lastUpdateInfoAt: 0,
    lastCheckError: '',
    base: resolveUpdateCheckUrl(),
    lastCheckRequestUrl: '',
  }))
  const lastCheckAtRef = useRef(0)
  const lastResumeCheckAtRef = useRef(0)
  const dismissedSignatureRef = useRef('')
  const inFlightRef = useRef<Promise<UpdateInfo | null> | null>(null)

  const applyInfo = useCallback((info: UpdateInfo | null) => {
    const action = getAction(info)
    const signature = info
      ? [
          info.decision,
          info.latestVersionCode,
          info.latestVersionName,
          info.apkUrl,
          info.playStoreUrl,
        ].join('|')
      : ''

    setState((current) => ({
      ...current,
      decision: info?.decision ?? 'NONE',
      visible:
        info != null &&
        shouldShowApkUpdateOverlay(info.decision) &&
        !(
          info.decision === 'SOFT' &&
          dismissedSignatureRef.current &&
          dismissedSignatureRef.current === signature
        ),
      info,
      action,
      downloading: false,
      verifying: false,
      installing: false,
      needsUnknownSourcesPermission: false,
      failedReason: '',
      lastUpdateInfoAt: Date.now(),
    }))
  }, [])

  const checkNow = useCallback(
    async (reason: string) => {
      if (isWebBrowser()) {
        return null
      }

      const urlBase = resolveUpdateCheckUrl()
      if (!urlBase) {
        return null
      }

      const now = Date.now()
      if (
        reason !== 'manual' &&
        now - lastCheckAtRef.current < RECHECK_DEBOUNCE_MS &&
        inFlightRef.current
      ) {
        return inFlightRef.current
      }

      const task = (async () => {
        lastCheckAtRef.current = now
        try {
          const identity = await getDeviceIdentity().catch(() => null)
          const requestUrl = new URL(urlBase)
          requestUrl.searchParams.set('platform', 'android')
          requestUrl.searchParams.set('package', env.updatePackageName)
          requestUrl.searchParams.set(
            'version_code',
            String(env.updateInstalledVersionCode),
          )
          requestUrl.searchParams.set(
            'version_name',
            env.updateInstalledVersionName,
          )
          if (identity?.deviceId) {
            requestUrl.searchParams.set('device_id', identity.deviceId)
          }

          setState((current) => ({
            ...current,
            started: true,
            lastCheckAt: Date.now(),
            lastCheckRequestUrl: requestUrl.toString(),
            lastCheckError: '',
            base: urlBase,
          }))

          const response = await fetch(requestUrl.toString(), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
            },
          })
          const text = await response.text()
          const payload = text ? (JSON.parse(text) as unknown) : null

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const info = normalizeUpdateInfo(payload)
          applyInfo(info)
          return info
        } catch (error) {
          setState((current) => ({
            ...current,
            started: true,
            lastCheckError:
              error instanceof Error ? error.message : 'update_check_failed',
            failedReason:
              error instanceof Error ? error.message : 'update_check_failed',
          }))
          return null
        } finally {
          inFlightRef.current = null
        }
      })()

      inFlightRef.current = task
      return task
    },
    [applyInfo],
  )

  const dismiss = useCallback(() => {
    setState((current) => {
      if (current.decision !== 'SOFT') {
        return current
      }

      const info = current.info
      dismissedSignatureRef.current = info
        ? [
            info.decision,
            info.latestVersionCode,
            info.latestVersionName,
            info.apkUrl,
            info.playStoreUrl,
          ].join('|')
        : ''

      return {
        ...current,
        visible: false,
      }
    })
  }, [])

  const triggerPrimaryAction = useCallback(() => {
    setState((current) => {
      const targetUrl = current.action.downloadUrl || current.action.storeUrl
      if (!targetUrl) {
        return current
      }

      openExternalUrl(targetUrl)
      return {
        ...current,
        visible: current.decision === 'FORCE',
      }
    })
  }, [])

  useEffect(() => {
    if (isWebBrowser()) {
      return undefined
    }

    void checkNow('app-launch')

    const onFocus = () => {
      const now = Date.now()
      if (now - lastResumeCheckAtRef.current < RESUME_RECHECK_GUARD_MS) {
        return
      }

      lastResumeCheckAtRef.current = now
      void checkNow('focus')
    }

    const subscriptions = [
      subscribeRealtimeEvent('app_settings_changed', () => {
        void checkNow('sse:app_settings_changed')
      }),
      subscribeRealtimeEvent('app_version_changed', () => {
        void checkNow('sse:app_version_changed')
      }),
      subscribeRealtimeEvent('app_version', () => {
        void checkNow('sse:app_version')
      }),
      subscribeRealtimeEvent('settings', () => {
        void checkNow('sse:settings')
      }),
      subscribeRealtimeEvent('sync', () => {
        void checkNow('sse:sync')
      }),
      subscribeRealtimeEvent('update', () => {
        void checkNow('sse:update')
      }),
    ]

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          onFocus()
        }
      }

      window.addEventListener('focus', onFocus)
      window.addEventListener('pageshow', onFocus)
      document.addEventListener('visibilitychange', onVisibilityChange)

      return () => {
        subscriptions.forEach((unsubscribe) => unsubscribe())
        window.removeEventListener('focus', onFocus)
        window.removeEventListener('pageshow', onFocus)
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [checkNow])

  const controls = useMemo(
    () => ({
      dismiss,
      triggerPrimaryAction,
      forceRecheck: () => checkNow('manual'),
    }),
    [checkNow, dismiss, triggerPrimaryAction],
  )

  return {
    state,
    ...controls,
  }
}
