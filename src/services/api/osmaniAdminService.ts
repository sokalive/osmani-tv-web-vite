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
  return osmaniAdminClient.get<AppModeSettings>(env.settingsPath)
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
