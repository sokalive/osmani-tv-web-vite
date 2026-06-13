import { env } from '../config/env'
import { isLikelyHlsManifestUrl, isMpingoNurPlayerGateway } from './playbackMime'
import type {
  BannerRecord,
  ChannelCategory,
  ChannelRow,
  ChannelViewModel,
  PlaybackCandidate,
  PlaybackReadiness,
  PopupSettings,
  ServerHealthSnapshot,
  WhatsappSettings,
} from '../types/osmani'

type RawChannelRecord = Record<string, unknown>

function resolveBaseUrl(rawBaseUrl: string) {
  if (/^https?:\/\//i.test(rawBaseUrl)) {
    return rawBaseUrl
  }

  if (typeof window !== 'undefined') {
    return new URL(rawBaseUrl, window.location.origin).toString()
  }

  return `http://localhost${rawBaseUrl.startsWith('/') ? rawBaseUrl : `/${rawBaseUrl}`}`
}

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

  if (typeof raw === 'number') {
    return raw !== 0
  }

  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase()
    if (['true', '1', 'yes', 'on', 'active', 'live'].includes(value)) {
      return true
    }
    if (['false', '0', 'no', 'off', 'inactive', 'offline'].includes(value)) {
      return false
    }
  }

  return fallback
}

function asString(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function asStringLoose(raw: unknown) {
  if (typeof raw === 'string') {
    return raw.trim()
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw)
  }
  return ''
}

function pickRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function coalesceString(...values: unknown[]) {
  for (const value of values) {
    const next = asStringLoose(value)
    if (next) {
      return next
    }
  }
  return ''
}

function sanitizeHttpOriginOrReferer(raw: unknown) {
  const value = asString(raw)
  if (!value) {
    return ''
  }

  if (!/^https?:\/\//i.test(value)) {
    return ''
  }

  return value
}

function toProxyUrl(
  proxyBaseUrl: string,
  url: string,
  headers: { origin: string; referer: string; userAgent: string },
) {
  const params = new URLSearchParams()
  params.set('url', url)

  const referer = sanitizeHttpOriginOrReferer(headers.referer)
  if (referer) {
    params.set('referer', referer)
  }

  const origin = sanitizeHttpOriginOrReferer(headers.origin)
  if (origin) {
    params.set('origin', origin)
  }

  if (headers.userAgent) {
    params.set('ua', headers.userAgent)
  }

  return `${proxyBaseUrl}?${params.toString()}`
}

function rewriteAdminDeliveryUrlForWebClient(url: string) {
  if (typeof window === 'undefined') {
    return url
  }

  try {
    const parsed = new URL(url)
    const isDelivery =
      /\/stream-direct(?:$|[/?#])/i.test(parsed.pathname) ||
      /\/stream-proxy(?:$|[/?#])/i.test(parsed.pathname)

    if (!isDelivery) {
      return url
    }

    const adminProxyBase = resolveBaseUrl(env.osmaniAdminApiUrl).replace(/\/+$/, '')
    const allowedHosts = new Set([
      new URL(adminProxyBase, window.location.origin).hostname,
      'osmani-admin-api.onrender.com',
    ])

    if (allowedHosts.has(parsed.hostname)) {
      return `${adminProxyBase}${parsed.pathname}${parsed.search}`
    }
  } catch {
    return url
  }

  return url
}

function resolveBackendPlaybackUrl(rawUrl: unknown) {
  const value = asString(rawUrl)
  if (!value) {
    return ''
  }

  if (/^https?:\/\//i.test(value)) {
    return rewriteAdminDeliveryUrlForWebClient(value)
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  if (value.startsWith('/osmani-admin-proxy/') || value.startsWith('/osmani-tv-proxy/')) {
    return value
  }

  const adminBaseUrl = `${resolveBaseUrl(env.osmaniAdminApiUrl).replace(/\/+$/, '')}/`

  if (value.startsWith('/')) {
    return new URL(value.replace(/^\//, ''), adminBaseUrl).toString()
  }

  return new URL(value, adminBaseUrl).toString()
}

function resolveProxyBaseUrl(rawProxyBaseUrl: unknown) {
  const value = asString(rawProxyBaseUrl)
  if (!value) {
    return env.streamProxyBaseUrl
  }

  return /^https?:\/\//i.test(value)
    ? value.replace(/\/+$/, '')
    : resolveBaseUrl(value).replace(/\/+$/, '')
}

function looksLikeUrlOrPath(value: string) {
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.includes('?')
  )
}

function looksLikeProxyEndpoint(value: string) {
  return /(?:^|\/)(?:stream-proxy|stream_proxy)(?:$|[/?#])/i.test(value)
}

/**
 * Browsers block plain http:// media from https:// pages (mixed active content).
 * Exo/Android can play http .m3u8 directly; the web app must route those manifests
 * through stream-proxy on secure origins so fetches originate from https.
 */
function enforceSecureOriginHttpHlsThroughProxy(
  channel: Pick<ChannelRow, 'streamProxy' | 'origin' | 'referer' | 'userAgent'>,
  candidateUrl: string,
): string {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return candidateUrl
  }

  if (!candidateUrl || !/^http:\/\//i.test(candidateUrl)) {
    return candidateUrl
  }

  if (!isLikelyHlsManifestUrl(candidateUrl)) {
    return candidateUrl
  }

  if (looksLikeProxyEndpoint(candidateUrl)) {
    return candidateUrl
  }

  const headers = {
    origin: sanitizeHttpOriginOrReferer(channel.origin),
    referer: sanitizeHttpOriginOrReferer(channel.referer),
    userAgent: channel.userAgent,
  }

  return toProxyUrl(resolveProxyBaseUrl(channel.streamProxy), candidateUrl, headers)
}

function isProxyDeliveryToken(value: string) {
  const token = value.trim().toLowerCase()
  return (
    token === 'proxy' ||
    token === 'stream-proxy' ||
    token === 'stream_proxy' ||
    token === 'proxy_delivery'
  )
}

function isDirectDeliveryToken(value: string) {
  const token = value.trim().toLowerCase()
  return (
    token === 'direct' ||
    token === 'manifest' ||
    token === 'backend' ||
    token === 'canonical'
  )
}

function buildCanonicalPlaybackUrl(
  channel: Pick<
    ChannelRow,
    'deliveryPath' | 'streamProxy' | 'origin' | 'referer' | 'userAgent'
  >,
  sourceUrl: string,
) {
  const normalizedSourceUrl = asString(sourceUrl)
  const resolvedSourceUrl = resolveBackendPlaybackUrl(normalizedSourceUrl)
  if (!resolvedSourceUrl) {
    return ''
  }

  const headers = {
    origin: sanitizeHttpOriginOrReferer(channel.origin),
    referer: sanitizeHttpOriginOrReferer(channel.referer),
    userAgent: channel.userAgent,
  }
  const proxyBaseUrl = resolveProxyBaseUrl(channel.streamProxy)
  const deliveryPath = asString(channel.deliveryPath)

  if (!deliveryPath) {
    return resolvedSourceUrl
  }

  if (isDirectDeliveryToken(deliveryPath)) {
    return resolvedSourceUrl
  }

  if (isProxyDeliveryToken(deliveryPath)) {
    return toProxyUrl(proxyBaseUrl, resolvedSourceUrl, headers)
  }

  if (!looksLikeUrlOrPath(deliveryPath)) {
    return resolvedSourceUrl
  }

  const resolvedDeliveryUrl = /^https?:\/\//i.test(deliveryPath)
    ? deliveryPath
    : new URL(
        deliveryPath.replace(/^\//, ''),
        `${resolveProxyBaseUrl(channel.streamProxy || env.osmaniAdminApiUrl)}/`,
      ).toString()

  if (resolvedDeliveryUrl.includes('{url}')) {
    return resolvedDeliveryUrl.replaceAll('{url}', encodeURIComponent(resolvedSourceUrl))
  }

  try {
    const url = new URL(resolvedDeliveryUrl)
    if (url.searchParams.has('url')) {
      if (!url.searchParams.get('url')) {
        url.searchParams.set('url', resolvedSourceUrl)
      }
      if (headers.referer && !url.searchParams.has('referer')) {
        url.searchParams.set('referer', headers.referer)
      }
      if (headers.origin && !url.searchParams.has('origin')) {
        url.searchParams.set('origin', headers.origin)
      }
      if (headers.userAgent && !url.searchParams.has('ua')) {
        url.searchParams.set('ua', headers.userAgent)
      }
      return url.toString()
    }
  } catch {
    return resolvedSourceUrl
  }

  if (looksLikeProxyEndpoint(resolvedDeliveryUrl)) {
    return toProxyUrl(resolvedDeliveryUrl.replace(/\/+$/, ''), resolvedSourceUrl, headers)
  }

  return resolvedDeliveryUrl
}

export function normalizeChannel(raw: RawChannelRecord): ChannelRow {
  const streamBlock =
    pickRecord(raw.stream) ??
    pickRecord(raw.stream_config) ??
    pickRecord(raw.streamConfig) ??
    pickRecord(raw.streamSettings)
  const playbackBlock =
    pickRecord(raw.playback) ??
    pickRecord(raw.playback_settings) ??
    pickRecord(raw.playbackSettings)
  const headersBlock =
    pickRecord(raw.stream_headers) ??
    pickRecord(raw.streamHeaders) ??
    pickRecord(raw.headers)
  const streamProxyBlock = pickRecord(raw.streamProxy)
  const proxyHeadersBlock = pickRecord(streamProxyBlock?.headers)

  return {
    id: String(
      raw.id ??
        raw._id ??
        raw.channel_id ??
        streamBlock?.id ??
        playbackBlock?.id ??
        '',
    ),
    name: coalesceString(raw.name, streamBlock?.name, playbackBlock?.name) || 'Untitled channel',
    category: coalesceString(raw.category, streamBlock?.category) || 'General',
    displaySection:
      coalesceString(raw.displaySection, raw.display_section, streamBlock?.displaySection) || '',
    bottomTab:
      coalesceString(raw.bottomTabsDisplay, raw.bottomTab, raw.bottom_tab, streamBlock?.bottomTab) ||
      'General',
    thumbnailUrl:
      coalesceString(
        raw.thumbnailUrl,
        raw.thumbnail_url,
        raw.thumbnail,
        streamBlock?.thumbnailUrl,
        streamBlock?.thumbnail_url,
      ) || null,
    isLive: asBoolean(raw.isLive, asBoolean(raw.live, true)),
    isHD:
      raw.isHD !== undefined
        ? asBoolean(raw.isHD, true)
        : raw.hd !== undefined
          ? asBoolean(raw.hd, true)
          : true,
    isActive: asBoolean(raw.isActive, asBoolean(raw.active, true)),
    showInApp: asBoolean(raw.showInApp, asBoolean(raw.show_in_app, true)),
    accessType:
      asString(raw.accessType).toLowerCase() === 'premium' ||
      asBoolean(raw.accessPremium, asBoolean(raw.access_premium))
        ? 'premium'
        : 'free',
    accessPremium: asBoolean(raw.accessPremium, asBoolean(raw.access_premium)),
    playerType: normalizePlayerType(
      raw.playerType ?? raw.player_type ?? streamBlock?.playerType ?? streamBlock?.player_type,
    ),
    url: coalesceString(
      raw.url,
      raw.stream_url,
      raw.streamUrl,
      raw.streamURL,
      raw.primary_stream,
      raw.primaryStream,
      raw.hls_url,
      raw.hlsUrl,
      raw.manifest_url,
      raw.manifestUrl,
      streamBlock?.url,
      streamBlock?.stream_url,
      streamBlock?.streamUrl,
      streamBlock?.hls_url,
      playbackBlock?.url,
      playbackBlock?.stream_url,
    ),
    backupStream1: coalesceString(
      raw.backupStream1,
      raw.backup_stream_1,
      streamBlock?.backupStream1,
      streamBlock?.backup_stream_1,
    ),
    backupStream2: coalesceString(
      raw.backupStream2,
      raw.backup_stream_2,
      streamBlock?.backupStream2,
      streamBlock?.backup_stream_2,
    ),
    playbackUrl: coalesceString(
      raw.playbackUrl,
      raw.playback_url,
      raw.canonicalPlaybackUrl,
      raw.canonical_playback_url,
      raw.backendPlaybackUrl,
      raw.backend_playback_url,
      playbackBlock?.playbackUrl,
      playbackBlock?.playback_url,
      playbackBlock?.url,
    ),
    backupPlayback1: coalesceString(
      raw.backupPlayback1,
      raw.backup_playback_1,
      playbackBlock?.backupPlayback1,
      playbackBlock?.backup_playback_1,
    ),
    backupPlayback2: coalesceString(
      raw.backupPlayback2,
      raw.backup_playback_2,
      playbackBlock?.backupPlayback2,
      playbackBlock?.backup_playback_2,
    ),
    directStreamUrl: coalesceString(
      raw.direct_stream_url,
      raw.directStreamUrl,
      streamProxyBlock?.directPrimaryUrl,
      streamProxyBlock?.direct_primary_url,
      playbackBlock?.direct_stream_url,
      playbackBlock?.directStreamUrl,
    ),
    directStreamBackup1: coalesceString(
      raw.direct_stream_url_backup1,
      raw.directStreamUrlBackup1,
      raw.direct_stream_url_backup_1,
      streamProxyBlock?.directBackup1Url,
      playbackBlock?.direct_stream_url_backup1,
    ),
    directStreamBackup2: coalesceString(
      raw.direct_stream_url_backup2,
      raw.directStreamUrlBackup2,
      raw.direct_stream_url_backup_2,
      streamProxyBlock?.directBackup2Url,
      playbackBlock?.direct_stream_url_backup2,
    ),
    proxyPlaybackUrl: coalesceString(
      raw.proxy_playback_url,
      raw.proxyPlaybackUrl,
      streamProxyBlock?.primaryUrl,
      streamProxyBlock?.primary_url,
      playbackBlock?.proxy_playback_url,
      playbackBlock?.proxyPlaybackUrl,
    ),
    deliveryPath: coalesceString(
      raw.deliveryPath,
      raw.delivery_path,
      raw.deliveryMode,
      raw.delivery_mode,
      streamBlock?.deliveryPath,
      streamBlock?.delivery_path,
      playbackBlock?.deliveryPath,
      playbackBlock?.delivery_path,
      streamProxyBlock?.directRoute,
      streamProxyBlock?.route,
    ),
    streamProxy: coalesceString(
      raw.streamProxy,
      raw.stream_proxy,
      raw.stream_proxy_url,
      raw.streamProxyUrl,
      streamBlock?.streamProxy,
      streamBlock?.stream_proxy,
      playbackBlock?.streamProxy,
      streamProxyBlock?.route,
      streamProxyBlock?.directRoute,
    ),
    origin: coalesceString(
      raw.origin,
      raw.stream_origin,
      headersBlock?.origin,
      streamBlock?.origin,
      playbackBlock?.origin,
      proxyHeadersBlock?.origin,
    ),
    referer: coalesceString(
      raw.referer,
      raw.referrer,
      raw.referer_url,
      raw.referrer_url,
      raw.stream_referer,
      headersBlock?.referer,
      headersBlock?.referrer,
      streamBlock?.referer,
      streamBlock?.referrer,
      playbackBlock?.referer,
      proxyHeadersBlock?.referer,
      proxyHeadersBlock?.referrer,
    ),
    userAgent: coalesceString(
      raw.userAgent,
      raw.user_agent,
      raw.ua,
      headersBlock?.userAgent,
      headersBlock?.user_agent,
      streamBlock?.userAgent,
      streamBlock?.user_agent,
      playbackBlock?.userAgent,
      proxyHeadersBlock?.userAgent,
      proxyHeadersBlock?.user_agent,
    ),
  }
}

export function effectiveCatalogSection(
  channel: Pick<ChannelRow, 'displaySection' | 'category' | 'bottomTab'>,
) {
  const displaySection = channel.displaySection.trim().toLowerCase()
  if (displaySection === 'sports' || displaySection === 'movies') {
    return displaySection
  }
  if (displaySection === 'general') {
    return 'general'
  }

  const category = channel.category.trim().toLowerCase()
  if (category === 'sports' || category === 'sport') {
    return 'sports'
  }
  if (category === 'movies' || category === 'movie' || category === 'tamthilia') {
    return 'movies'
  }
  if (category === 'general' || category === 'zote') {
    return 'general'
  }

  const bottomTab = channel.bottomTab.trim().toLowerCase()
  if (bottomTab === 'sports' || bottomTab === 'sport') {
    return 'sports'
  }
  if (bottomTab === 'movies' || bottomTab === 'movie' || bottomTab === 'tamthilia') {
    return 'movies'
  }
  if (bottomTab === 'general') {
    return 'general'
  }

  return displaySection || 'general'
}

function findServerHealthForChannel(
  serverHealth: ServerHealthSnapshot | null | undefined,
  name: string,
) {
  if (!serverHealth || !Array.isArray(serverHealth.channels)) {
    return null
  }

  const wanted = String(name ?? '').trim().toLowerCase()
  if (!wanted) {
    return null
  }

  return (
    serverHealth.channels.find(
      (row) => String(row.name ?? '').trim().toLowerCase() === wanted,
    ) || null
  )
}

function resolveCanonicalPlaybackCandidateUrl(
  channel: ChannelRow,
  source: { id: string; url: string },
) {
  const sourceUrl = asString(source.url)
  if (!sourceUrl && source.id !== 'primary') {
    return ''
  }

  if (isMpingoNurPlayerGateway(sourceUrl)) {
    return sourceUrl
  }

  if (source.id === 'primary' && channel.proxyPlaybackUrl) {
    return resolveBackendPlaybackUrl(channel.proxyPlaybackUrl)
  }

  if (!sourceUrl) {
    return ''
  }

  return buildCanonicalPlaybackUrl(channel, sourceUrl)
}

function createAppParityMpingoCandidates(channel: ChannelRow) {
  const appStyleSources = [
    { id: 'primary', label: 'Primary', url: channel.url },
    { id: 'backup-1', label: 'Backup 1', url: channel.backupStream1 },
    { id: 'backup-2', label: 'Backup 2', url: channel.backupStream2 },
  ]

  if (!isMpingoNurPlayerGateway(channel.url)) {
    return null
  }

  return appStyleSources.reduce<PlaybackCandidate[]>((list, source) => {
    const playbackUrl = asString(source.url)
    if (!playbackUrl || !isMpingoNurPlayerGateway(playbackUrl)) {
      return list
    }

    list.push({
      id: source.id,
      label: source.label,
      sourceUrl: playbackUrl,
      playbackUrl,
      deliveryPath: '',
      streamProxy: '',
      usesBackendDelivery: false,
      isDirectManifest: false,
      embedPlayback: true,
    })

    return list
  }, [])
}

function createPlaybackCandidates(channel: ChannelRow) {
  const appParityCandidates = createAppParityMpingoCandidates(channel)
  if (appParityCandidates?.length) {
    return appParityCandidates
  }

  const canonicalSources = [
    {
      id: 'primary',
      label: 'Primary',
      url: channel.playbackUrl || channel.proxyPlaybackUrl,
    },
    {
      id: 'backup-1',
      label: 'Backup 1',
      url: channel.backupPlayback1,
    },
    {
      id: 'backup-2',
      label: 'Backup 2',
      url: channel.backupPlayback2,
    },
  ]

  if (
    canonicalSources.some((source) => source.url) ||
    channel.proxyPlaybackUrl
  ) {
    return canonicalSources.reduce<PlaybackCandidate[]>((list, source) => {
      const sourceUrl = asString(source.url)
      if (!sourceUrl && !(source.id === 'primary' && channel.proxyPlaybackUrl)) {
        return list
      }

      const playbackUrl = enforceSecureOriginHttpHlsThroughProxy(
        channel,
        resolveCanonicalPlaybackCandidateUrl(channel, source),
      )
      if (!playbackUrl) {
        return list
      }

      const hlsLike = isLikelyHlsManifestUrl(playbackUrl)
      list.push({
        id: source.id,
        label: source.label,
        sourceUrl: sourceUrl || channel.proxyPlaybackUrl,
        playbackUrl,
        deliveryPath: channel.deliveryPath,
        streamProxy: channel.streamProxy,
        usesBackendDelivery: true,
        isDirectManifest: hlsLike,
        embedPlayback: !hlsLike,
      })

      return list
    }, [])
  }

  const headers = {
    origin: sanitizeHttpOriginOrReferer(channel.origin),
    referer: sanitizeHttpOriginOrReferer(channel.referer),
    userAgent: channel.userAgent,
  }
  const compatibilityProxyBaseUrl = resolveProxyBaseUrl(channel.streamProxy)

  return [
    { id: 'primary', label: 'Primary', url: channel.url },
    { id: 'backup-1', label: 'Backup 1', url: channel.backupStream1 },
    { id: 'backup-2', label: 'Backup 2', url: channel.backupStream2 },
  ].reduce<PlaybackCandidate[]>((list, source) => {
    if (!source.url) {
      return list
    }

    const playbackUrl = enforceSecureOriginHttpHlsThroughProxy(
      channel,
      toProxyUrl(compatibilityProxyBaseUrl, source.url, headers),
    )
    const hlsLike = isLikelyHlsManifestUrl(playbackUrl)
    list.push({
      id: source.id,
      label: source.label,
      sourceUrl: source.url,
      playbackUrl,
      deliveryPath: '',
      streamProxy: compatibilityProxyBaseUrl,
      usesBackendDelivery: false,
      isDirectManifest: hlsLike,
      embedPlayback: !hlsLike,
    })

    return list
  }, [])
}

function getPlaybackState(channel: ChannelRow, candidates: PlaybackCandidate[]) {
  const usesCanonicalPlayback = Boolean(
    channel.playbackUrl ||
      channel.backupPlayback1 ||
      channel.backupPlayback2 ||
      channel.proxyPlaybackUrl,
  )

  if (candidates.length === 0) {
    return {
      readiness: 'missing-url' as PlaybackReadiness,
      message: 'This channel does not currently expose a stream URL.',
    }
  }

  if (usesCanonicalPlayback) {
    return {
      readiness: 'ready' as PlaybackReadiness,
      message: '',
    }
  }

  if (
    channel.playerType === 'webview' &&
    !candidates.some((candidate) => candidate.embedPlayback || candidate.isDirectManifest)
  ) {
    return {
      readiness: 'unsupported' as PlaybackReadiness,
      message:
        'This channel is configured for an embedded webview in the mobile app, so it is not yet browser-player ready here.',
    }
  }

  if (!candidates.some((candidate) => candidate.isDirectManifest || candidate.embedPlayback)) {
    return {
      readiness: 'headers-required' as PlaybackReadiness,
      message:
        'This channel uses a non-manifest source or custom gateway flow. Keep it visible, but prefer direct .m3u8 channels for stable Chrome playback.',
    }
  }

  return {
    readiness: 'ready' as PlaybackReadiness,
    message:
      'This channel is using the guarded compatibility playback fallback while canonical delivery fields are still missing.',
  }
}

export function toChannelViewModel(
  raw: RawChannelRecord,
  serverHealth?: ServerHealthSnapshot | null,
): ChannelViewModel {
  const channel = normalizeChannel(raw)
  const health = findServerHealthForChannel(serverHealth, channel.name)
  const healthStatus = String(health?.status ?? '').trim().toLowerCase()
  const playbackCandidates = createPlaybackCandidates(channel)
  const playbackState = getPlaybackState(channel, playbackCandidates)
  const usesCanonicalPlayback = Boolean(
    channel.playbackUrl ||
      channel.backupPlayback1 ||
      channel.backupPlayback2 ||
      channel.proxyPlaybackUrl,
  )
  const isLive =
    healthStatus === 'online'
      ? true
      : healthStatus === 'offline'
        ? false
        : channel.isLive

  return {
    id: channel.id,
    name: channel.name,
    category: channel.category,
    bottomTab: channel.bottomTab,
    displaySection: channel.displaySection,
    thumbnailUrl: channel.thumbnailUrl,
    isLive,
    isHD: channel.isHD,
    isActive: channel.isActive,
    showInApp: channel.showInApp,
    accessType: channel.accessType,
    playerType: channel.playerType,
    usesCanonicalPlayback,
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

const VOLATILE_PLAYBACK_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'auth',
  'signature',
  'sig',
  'expires',
  'exp',
  'e',
  't',
  'st',
  'hdnea',
  'hdnts',
  'play_token',
  'jwt',
  'session',
])

/** Strip rotating auth query params so catalog refreshes do not look like a new stream. */
export function normalizeUrlForStreamIdentity(url: string) {
  const value = asString(url)
  if (!value) {
    return ''
  }

  try {
    const parsed = new URL(
      value,
      typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
    )

    ;[...parsed.searchParams.keys()].forEach((key) => {
      if (VOLATILE_PLAYBACK_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key)
      }
    })

    const query = parsed.searchParams.toString()
    return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ''}`
  } catch {
    return value
  }
}

/** Stable stream identity — ignores signed URL/token churn on the same channel source. */
export function channelStreamIdentityDigest(
  channel:
    | Pick<
        ChannelViewModel,
        | 'id'
        | 'playerType'
        | 'playbackCandidates'
        | 'streamHeaders'
        | 'usesCanonicalPlayback'
        | 'playbackReadiness'
      >
    | null
    | undefined,
): string {
  if (!channel) {
    return ''
  }

  return JSON.stringify({
    id: channel.id,
    pt: channel.playerType,
    c: channel.playbackCandidates.map((row) => ({
      i: row.id,
      su: normalizeUrlForStreamIdentity(row.sourceUrl),
      dp: row.deliveryPath,
      e: row.embedPlayback,
      m: row.isDirectManifest,
    })),
    sh: channel.streamHeaders,
    uc: channel.usesCanonicalPlayback,
    pr: channel.playbackReadiness,
  })
}

export function channelPlaybackDigest(
  channel:
    | Pick<
        ChannelViewModel,
        | 'id'
        | 'playerType'
        | 'playbackCandidates'
        | 'streamHeaders'
        | 'usesCanonicalPlayback'
        | 'playbackReadiness'
      >
    | null
    | undefined,
): string {
  if (!channel) {
    return ''
  }

  return JSON.stringify({
    id: channel.id,
    pt: channel.playerType,
    c: channel.playbackCandidates.map((row) => ({
      i: row.id,
      pu: normalizeUrlForStreamIdentity(row.playbackUrl),
      su: normalizeUrlForStreamIdentity(row.sourceUrl),
      e: row.embedPlayback,
      m: row.isDirectManifest,
    })),
    sh: channel.streamHeaders,
    uc: channel.usesCanonicalPlayback,
    pr: channel.playbackReadiness,
  })
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
        badgeEnabled: asBoolean(
          record.badgeEnabled,
          asBoolean(record.badge_enabled, true),
        ),
        badgeBlink: asBoolean(record.badgeBlink, asBoolean(record.badge_blink)),
        badgeColor:
          asString(record.badgeColor ?? record.badge_color) || '#DC2626',
        enableCountdown: asBoolean(
          record.enableCountdown,
          asBoolean(record.enable_countdown),
        ),
        eventStart:
          asString(record.eventStart ?? record.event_start) || null,
        eventEnd: asString(record.eventEnd ?? record.event_end) || null,
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
