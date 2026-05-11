import { env } from '../config/env'
import type {
  BannerRecord,
  ChannelCategory,
  ChannelRow,
  ChannelViewModel,
  PlaybackCandidate,
  PlaybackReadiness,
  PopupSettings,
  WhatsappSettings,
} from '../types/osmani'

type RawChannelRecord = Record<string, unknown>

const directManifestPattern = /\.m3u8($|[?#])/i

function normalizePlayerType(raw: unknown): ChannelRow['playerType'] {
  const value = String(raw ?? 'exo')
    .trim()
    .toLowerCase()

  if (
    value === 'webview' ||
    value === 'vlc' ||
    value === 'native' ||
    value === 'ijk'
  ) {
    return value
  }

  return 'exo'
}

function asBoolean(raw: unknown, fallback = false) {
  if (typeof raw === 'boolean') {
    return raw
  }

  return fallback
}

function asString(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function toProxyUrl(
  url: string,
  headers: { origin: string; referer: string; userAgent: string },
) {
  const params = new URLSearchParams()
  params.set('url', url)

  if (headers.referer) {
    params.set('referer', headers.referer)
  }

  if (headers.origin) {
    params.set('origin', headers.origin)
  }

  if (headers.userAgent) {
    params.set('userAgent', headers.userAgent)
  }

  return `${env.streamProxyBaseUrl}?${params.toString()}`
}

export function normalizeChannel(raw: RawChannelRecord): ChannelRow {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: asString(raw.name) || 'Untitled channel',
    category: asString(raw.category) || 'General',
    bottomTab:
      asString(raw.bottomTabsDisplay) || asString(raw.bottomTab) || 'General',
    thumbnailUrl:
      asString(raw.thumbnailUrl) || asString(raw.thumbnail) || null,
    isLive: asBoolean(raw.isLive, asBoolean(raw.live, true)),
    isHD: asBoolean(raw.isHD, asBoolean(raw.hd, false)),
    isActive: asBoolean(raw.isActive, asBoolean(raw.active, true)),
    showInApp: asBoolean(raw.showInApp, asBoolean(raw.show_in_app, true)),
    accessType:
      asString(raw.accessType).toLowerCase() === 'premium'
        ? 'premium'
        : 'free',
    accessPremium: asBoolean(raw.accessPremium, asBoolean(raw.access_premium)),
    playerType: normalizePlayerType(raw.playerType ?? raw.player_type),
    url: asString(raw.url),
    backupStream1: asString(raw.backupStream1 ?? raw.backup_stream_1),
    backupStream2: asString(raw.backupStream2 ?? raw.backup_stream_2),
    origin: asString(raw.origin),
    referer: asString(raw.referer ?? raw.referrer),
    userAgent: asString(raw.userAgent ?? raw.user_agent),
  }
}

function createPlaybackCandidates(channel: ChannelRow) {
  const headers = {
    origin: channel.origin,
    referer: channel.referer,
    userAgent: channel.userAgent,
  }

  return [
    { id: 'primary', label: 'Primary', url: channel.url },
    { id: 'backup-1', label: 'Backup 1', url: channel.backupStream1 },
    { id: 'backup-2', label: 'Backup 2', url: channel.backupStream2 },
  ].reduce<PlaybackCandidate[]>((list, source) => {
    if (!source.url) {
      return list
    }

    list.push({
      id: source.id,
      label: source.label,
      url: source.url,
      proxiedUrl: toProxyUrl(source.url, headers),
      isDirectManifest: directManifestPattern.test(source.url),
    })

    return list
  }, [])
}

function getPlaybackState(channel: ChannelRow, candidates: PlaybackCandidate[]) {
  if (candidates.length === 0) {
    return {
      readiness: 'missing-url' as PlaybackReadiness,
      message: 'This channel does not currently expose a stream URL.',
    }
  }

  if (channel.playerType === 'webview') {
    return {
      readiness: 'unsupported' as PlaybackReadiness,
      message:
        'This channel is configured for an embedded webview in the mobile app, so it is not yet browser-player ready here.',
    }
  }

  if (!candidates.some((candidate) => candidate.isDirectManifest)) {
    return {
      readiness: 'headers-required' as PlaybackReadiness,
      message:
        'This channel uses a non-manifest source or custom gateway flow. Keep it visible, but prefer direct .m3u8 channels for stable Chrome playback.',
    }
  }

  return {
    readiness: 'ready' as PlaybackReadiness,
    message:
      'This channel is routed through the production stream proxy for browser-safe HLS playback.',
  }
}

export function toChannelViewModel(raw: RawChannelRecord): ChannelViewModel {
  const channel = normalizeChannel(raw)
  const playbackCandidates = createPlaybackCandidates(channel)
  const playbackState = getPlaybackState(channel, playbackCandidates)

  return {
    id: channel.id,
    name: channel.name,
    category: channel.category,
    thumbnailUrl: channel.thumbnailUrl,
    isLive: channel.isLive,
    isHD: channel.isHD,
    isActive: channel.isActive,
    showInApp: channel.showInApp,
    accessType: channel.accessType,
    playerType: channel.playerType,
    playbackCandidates,
    playbackReadiness: playbackState.readiness,
    playbackMessage: playbackState.message,
    streamHeaders: {
      origin: channel.origin,
      referer: channel.referer,
      userAgent: channel.userAgent,
    },
  }
}

export function deriveCategories(channels: ChannelViewModel[]) {
  const counts = new Map<string, number>()

  channels.forEach((channel) => {
    const current = counts.get(channel.category) ?? 0
    counts.set(channel.category, current + 1)
  })

  const items = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map<ChannelCategory>(([label, count]) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      count,
    }))

  return [{ id: 'all', label: 'All channels', count: channels.length }, ...items]
}

export function pickDefaultChannel(
  channels: ChannelViewModel[],
  preferredId: string,
) {
  if (preferredId) {
    const exact = channels.find((channel) => channel.id === preferredId)
    if (exact) {
      return exact
    }
  }

  return (
    channels.find((channel) => channel.playbackReadiness === 'ready') ||
    channels[0] ||
    null
  )
}

export function normalizeBanners(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [] as BannerRecord[]
  }

  return raw
    .map((item) => {
      const record = item as Record<string, unknown>
      return {
        id: Number(record.id ?? 0),
        title: asString(record.title) || 'Featured',
        description: asString(record.description),
        imageUrl: asString(record.imageUrl ?? record.image_url) || null,
        isActive: asBoolean(record.isActive, asBoolean(record.is_active, true)),
        badge: asString(record.badge),
        redirectChannelId: asString(
          record.redirectChannelId ?? record.redirect_channel_id,
        ) || null,
        sortOrder: Number(record.sortOrder ?? record.sort_order ?? 0),
      }
    })
    .filter((banner) => banner.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

export function normalizePopupSettings(raw: unknown): PopupSettings | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>

  return {
    mode: asString(record.mode) || 'disabled',
    title: asString(record.title) || env.brandName,
    greeting: asString(record.greeting),
    bulletPoints: Array.isArray(record.bullet_points)
      ? record.bullet_points.map((item) => asString(item)).filter(Boolean)
      : [],
    disclaimer: asString(record.disclaimer),
  }
}

export function normalizeWhatsappSettings(raw: unknown): WhatsappSettings | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>

  return {
    enabled: asBoolean(record.enabled),
    url: asString(record.url),
  }
}
