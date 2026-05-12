import { env } from '../../config/env'
import {
  deriveCategories,
  normalizeBanners,
  normalizePopupSettings,
  normalizeWhatsappSettings,
  toChannelViewModel,
} from '../../lib/catalog'
import type {
  AppModeSettings,
  BannerRecord,
  ChannelViewModel,
  PopupSettings,
  ServerHealthSnapshot,
  WhatsappSettings,
} from '../../types/osmani'
import { osmaniAdminClient } from './osmaniAdminClient'

type RawChannelRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
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
      if (['true', '1', 'yes', 'on', 'enabled', 'active'].includes(normalized)) {
        return true
      }
      if (['false', '0', 'no', 'off', 'disabled', 'inactive'].includes(normalized)) {
        return false
      }
    }
  }

  return false
}

function normalizeAppSettings(payload: unknown): AppModeSettings {
  const body = isPlainObject(payload) ? payload : {}
  const appModes = isPlainObject(body.app_modes)
    ? body.app_modes
    : isPlainObject(body.appModes)
      ? body.appModes
      : null

  return {
    freeMode: pickBoolean(
      appModes?.free_mode,
      appModes?.freeMode,
      body.free_mode,
      body.freeMode,
    ),
    emergencyMode: pickBoolean(
      appModes?.emergency_mode,
      appModes?.emergencyMode,
      body.emergency_mode,
      body.emergencyMode,
    ),
    maintenanceMode: pickBoolean(
      appModes?.maintenance_mode,
      appModes?.maintenanceMode,
      body.maintenance_mode,
      body.maintenanceMode,
    ),
  }
}

export async function fetchServerHealth() {
  try {
    const payload = await osmaniAdminClient.get<unknown>('/api/server-health')
    if (!isPlainObject(payload)) {
      return null
    }

    return {
      totalChannels: Number(payload.total_channels ?? payload.totalChannels ?? 0),
      onlineChannels: Number(payload.online_channels ?? payload.onlineChannels ?? 0),
      offlineChannels: Number(payload.offline_channels ?? payload.offlineChannels ?? 0),
      serverTime:
        typeof payload.server_time === 'string'
          ? payload.server_time
          : typeof payload.serverTime === 'string'
            ? payload.serverTime
            : null,
      channels: Array.isArray(payload.channels)
        ? payload.channels
            .map((row) => {
              if (!isPlainObject(row)) {
                return null
              }

              return {
                name: typeof row.name === 'string' ? row.name : '',
                status: typeof row.status === 'string' ? row.status : '',
                responseMs:
                  typeof row.response_ms === 'number'
                    ? row.response_ms
                    : typeof row.responseMs === 'number'
                      ? row.responseMs
                      : null,
                error: typeof row.error === 'string' ? row.error : null,
              }
            })
            .filter(
              (row): row is ServerHealthSnapshot['channels'][number] => Boolean(row && row.name),
            )
        : [],
    } satisfies ServerHealthSnapshot
  } catch {
    return null
  }
}

export async function fetchChannels(serverHealthOverride?: ServerHealthSnapshot | null) {
  const payload = await osmaniAdminClient.get<RawChannelRecord[]>(env.channelsPath)
  const serverHealth =
    serverHealthOverride === undefined
      ? await fetchServerHealth()
      : serverHealthOverride
  const channels = Array.isArray(payload)
    ? payload
        .map((row) => toChannelViewModel(row, serverHealth))
        .filter((channel) => channel.isActive)
    : []

  return channels.filter((channel) => channel.showInApp)
}

export async function fetchCategories(channels?: ChannelViewModel[]) {
  const catalog = channels ?? (await fetchChannels())
  return deriveCategories(catalog)
}

export async function fetchAppSettings() {
  const payload = await osmaniAdminClient.get<unknown>(env.settingsPath)
  return normalizeAppSettings(payload)
}

export async function fetchBanners() {
  const payload = await osmaniAdminClient.get<BannerRecord[]>(env.bannersPath)
  return normalizeBanners(payload)
}

export async function fetchPopupSettings() {
  const payload = await osmaniAdminClient.get<PopupSettings | null>(
    env.popupSettingsPath,
  )
  return normalizePopupSettings(payload)
}

export async function fetchWhatsappSettings() {
  const payload = await osmaniAdminClient.get<WhatsappSettings | null>(
    env.whatsappSettingsPath,
  )
  return normalizeWhatsappSettings(payload)
}
