import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalogOutlet } from '../../app/catalogOutlet'
import { ChannelCard } from '../channels/ChannelCard'
import { HeroCarousel } from '../home/HeroCarousel'
import type { ChannelViewModel } from '../../types/osmani'
import {
  categoryRouteMatches,
  homeFilters,
  matchesHomeFilter,
  type HomeFilter,
} from '../../lib/channelUi'

type CatalogScreenProps = {
  title: string
  subtitle: string
  showHero?: boolean
  mode?: 'home' | 'sports' | 'movies'
}

export function CatalogScreen({
  title,
  subtitle,
  showHero = false,
  mode = 'home',
}: CatalogScreenProps) {
  const navigate = useNavigate()
  const { data, loading, error, selectChannel, reload } = useCatalogOutlet()
  const [selectedFilter, setSelectedFilter] = useState<HomeFilter>('Zote')

  const channels = useMemo(() => {
    const rows = data?.channels ?? []

    if (mode === 'sports') {
      return rows.filter((channel) => categoryRouteMatches(channel, 'sports'))
    }

    if (mode === 'movies') {
      return rows.filter((channel) => categoryRouteMatches(channel, 'movies'))
    }

    return rows.filter((channel) => matchesHomeFilter(channel, selectedFilter))
  }, [data?.channels, mode, selectedFilter])

  const sectionTitle =
    mode === 'movies' || selectedFilter === 'Movies'
      ? 'Tamthilia na Movies'
      : 'Michezo na Soka'

  const openChannel = (channel: ChannelViewModel) => {
    selectChannel(channel)
    navigate(`/player/${channel.id}`)
  }

  return (
    <section className="catalog-screen">
      <header className="catalog-screen__header">
        <div className="catalog-screen__brand-row">
          <div>
            <h1>{title}</h1>
            <p className="catalog-screen__subtitle">{subtitle}</p>
          </div>

          <button
            type="button"
            className="catalog-screen__refresh"
            onClick={reload}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.35-5.65" />
              <path d="M20 4v5h-5" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {showHero && data?.banners.length ? (
          <HeroCarousel
            slides={data.banners}
            channels={data.channels}
            onSelectChannel={openChannel}
          />
        ) : showHero && loading ? (
          <HeroCarousel slides={[]} channels={[]} onSelectChannel={openChannel} />
        ) : null}

        {mode === 'home' ? (
          <div className="catalog-screen__filters">
            {homeFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`catalog-filter${
                  selectedFilter === filter ? ' catalog-filter--active' : ''
                }`}
                onClick={() => setSelectedFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        ) : null}

        <div className="catalog-screen__section-row">
          <div className="catalog-screen__section-title">
            <h2>{sectionTitle}</h2>
            <span className="catalog-screen__count">{channels.length}</span>
          </div>
          {loading ? (
            <p className="catalog-screen__meta">Inapakia chaneli...</p>
          ) : error ? (
            <p className="catalog-screen__meta catalog-screen__meta--error">{error}</p>
          ) : null}
        </div>
      </header>

      {loading && channels.length === 0 ? (
        <div className="catalog-grid catalog-grid--loading">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="catalog-card catalog-card--skeleton" key={index}>
              <div className="catalog-card__poster" />
            </div>
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="catalog-empty">Hakuna chaneli bado.</div>
      ) : (
        <div className="catalog-grid">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onSelect={openChannel}
            />
          ))}
        </div>
      )}
    </section>
  )
}
