import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalogOutlet } from '../../app/catalogOutlet'
import { ChannelCard } from '../channels/ChannelCard'
import { HeroCarousel } from '../home/HeroCarousel'
import { OtaDebugTitleTap } from '../modals/OtaDebugOverlay'
import type { ChannelViewModel } from '../../types/osmani'
import {
  categoryRouteMatches,
  homeFilters,
  matchesHomeFilter,
  type HomeFilter,
} from '../../lib/channelUi'

const MAINTENANCE_USER_MESSAGE =
  'Habari, kuna marekebisho yanaendelea ndani ya app kwa muda mfupi. Tafadhali subiri.'

function MaintenanceIcon() {
  return (
    <svg
      className="maintenance-home__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M14.7 6.3a4.6 4.6 0 0 0 3.9 6.7c.4 0 .8-.1 1.2-.2l-6.5 6.5a1.6 1.6 0 1 1-2.3-2.3l6.5-6.5c-.1.4-.2.8-.2 1.2a4.6 4.6 0 0 1-6.7-3.9l2.6 1 1.4-1.4-1-2.6a4.6 4.6 0 0 1 1.1-4.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MaintenanceHomeCentered() {
  return (
    <div className="maintenance-home" role="status" aria-live="polite">
      <MaintenanceIcon />
      <p className="maintenance-home__message">{MAINTENANCE_USER_MESSAGE}</p>
    </div>
  )
}

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
  const {
    data,
    loading,
    error,
    selectChannel,
    reload,
    isSubscribed,
    gateForPlayback,
    requestEmergencyModal,
  } = useCatalogOutlet()
  const [selectedFilter, setSelectedFilter] = useState<HomeFilter>('Zote')
  const maintenanceMode = data?.settings.maintenanceMode ?? false
  const emergencyMode = data?.settings.emergencyMode ?? false
  const freeMode = data?.settings.freeMode ?? false

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

  const openChannel = async (channel: ChannelViewModel) => {
    if (maintenanceMode) {
      return
    }

    if (emergencyMode) {
      requestEmergencyModal()
      return
    }

    if (!freeMode && channel.accessType === 'premium' && !isSubscribed) {
      navigate('/account', { state: { openPremiumModal: true } })
      return
    }

    const allowed = await gateForPlayback(channel, `catalog:${channel.id}`)
    if (!allowed) {
      return
    }

    selectChannel(channel)
    navigate(`/player/${channel.id}`)
  }

  return (
    <section className="catalog-screen">
      <header className="catalog-screen__header">
        <div className="catalog-screen__brand-row">
          <div>
            {mode === 'home' ? (
              <OtaDebugTitleTap>
                <h1>{title}</h1>
              </OtaDebugTitleTap>
            ) : (
              <h1>{title}</h1>
            )}
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

      {maintenanceMode ? (
        <div className="maintenance-home__wrap">
          <MaintenanceHomeCentered />
        </div>
      ) : loading && channels.length === 0 ? (
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
