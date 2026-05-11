import type { ChannelViewModel } from '../types/osmani'

export const homeFilters = ['Zote', 'Trending', 'Sports', 'Movies'] as const

export type HomeFilter = (typeof homeFilters)[number]

export function effectiveCatalogSection(
  channel: Pick<ChannelViewModel, 'displaySection' | 'category' | 'bottomTab'>,
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

export function matchCatalogSection(
  channel: ChannelViewModel,
  section: 'sports' | 'movies' | 'general',
) {
  return effectiveCatalogSection(channel) === section
}

export function matchesHomeFilter(channel: ChannelViewModel, filter: HomeFilter) {
  if (filter === 'Zote') {
    return true
  }

  if (filter === 'Trending') {
    return channel.isLive
  }

  if (filter === 'Sports') {
    return matchCatalogSection(channel, 'sports')
  }

  return matchCatalogSection(channel, 'movies')
}

export function accessBadge(channel: ChannelViewModel) {
  return channel.accessType === 'premium' ? 'KULIPIA' : 'BURE'
}

export function categoryRouteMatches(
  channel: ChannelViewModel,
  route: 'sports' | 'movies',
) {
  return matchCatalogSection(channel, route)
}
