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
  WhatsappSettings,
} from '../../types/osmani'
import { osmaniAdminClient } from './osmaniAdminClient'

type RawChannelRecord = Record<string, unknown>

export async function fetchChannels() {
  const payload = await osmaniAdminClient.get<RawChannelRecord[]>(env.channelsPath)
  const channels = Array.isArray(payload)
    ? payload.map(toChannelViewModel).filter((channel) => channel.isActive)
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
