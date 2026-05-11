export type AppModeSettings = {
  freeMode: boolean
  emergencyMode: boolean
  maintenanceMode: boolean
}

export type BannerRecord = {
  id: number
  title: string
  description: string
  imageUrl: string | null
  isActive: boolean
  badge: string
  badgeEnabled: boolean
  badgeBlink: boolean
  badgeColor: string
  enableCountdown: boolean
  eventStart: string | null
  eventEnd: string | null
  redirectChannelId: string | null
  sortOrder: number
}

export type PopupSettings = {
  mode: string
  title: string
  greeting: string
  bulletPoints: string[]
  disclaimer: string
}

export type WhatsappSettings = {
  enabled: boolean
  url: string
}

export type SubscriptionPlan = {
  id: string
  name: string
  price: number
  duration: string
  isActive: boolean
}

export type PaymentProvider = {
  id: string
  name: string
  logoUrl: string | null
  active: boolean
}

export type SubscriptionStatus = {
  active: boolean
  expiresAt: string | null
  startedAt: string | null
  serverTime: string | null
  serverTimeFetchedAt: number | null
  amount: number | null
  currency: string | null
  planName: string | null
  planDurationDays: number | null
  plans: SubscriptionPlan[]
  deviceId: string | null
  manualGiftAckKey: string | null
  raw: unknown
}

export type LegacyApiStatus = {
  message: string
  online: boolean
}

export type ChannelRow = {
  id: string
  name: string
  category: string
  bottomTab: string
  thumbnailUrl: string | null
  isLive: boolean
  isHD: boolean
  isActive: boolean
  showInApp: boolean
  accessType: 'free' | 'premium'
  accessPremium: boolean
  playerType: 'exo' | 'webview' | 'vlc' | 'native' | 'ijk'
  url: string
  backupStream1: string
  backupStream2: string
  origin: string
  referer: string
  userAgent: string
}

export type PlaybackCandidate = {
  id: string
  label: string
  url: string
  proxiedUrl: string
  isDirectManifest: boolean
}

export type PlaybackReadiness =
  | 'ready'
  | 'unsupported'
  | 'headers-required'
  | 'missing-url'

export type ChannelViewModel = {
  id: string
  name: string
  category: string
  thumbnailUrl: string | null
  isLive: boolean
  isHD: boolean
  isActive: boolean
  showInApp: boolean
  accessType: 'free' | 'premium'
  playerType: ChannelRow['playerType']
  playbackReadiness: PlaybackReadiness
  playbackMessage: string
  playbackCandidates: PlaybackCandidate[]
  streamHeaders: {
    origin: string
    referer: string
    userAgent: string
  }
}

export type ChannelCategory = {
  id: string
  label: string
  count: number
}

export type CatalogBootstrap = {
  channels: ChannelViewModel[]
  categories: ChannelCategory[]
  banners: BannerRecord[]
  settings: AppModeSettings
  popupSettings: PopupSettings | null
  whatsappSettings: WhatsappSettings | null
  legacyApiStatus: LegacyApiStatus | null
}
