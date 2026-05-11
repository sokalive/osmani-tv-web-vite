import type { ChannelViewModel } from '../types/osmani'

export const homeFilters = ['Zote', 'Trending', 'Sports', 'Movies'] as const

export type HomeFilter = (typeof homeFilters)[number]

export function matchCatalogSection(
  channel: ChannelViewModel,
  section: 'sports' | 'movies' | 'general',
) {
  const category = channel.category.trim().toLowerCase()

  if (section === 'sports') {
    return category === 'sports' || category === 'sport'
  }

  if (section === 'movies') {
    return (
      category === 'movies' ||
      category === 'movie' ||
      category === 'tamthilia'
    )
  }

  return category === 'general' || category === 'zote'
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
