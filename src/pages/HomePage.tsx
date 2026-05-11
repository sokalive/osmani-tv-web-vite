import { useMemo, useState } from 'react'
import { HlsPlayer } from '../components/player/HlsPlayer'
import { env } from '../config/env'
import { useCatalogBootstrap } from '../hooks/useCatalogBootstrap'

const focusCards = [
  {
    title: 'Chrome playback stability',
    body: 'Catalog data comes from the live production admin API, while actual HLS playback is routed through the production stream proxy for browser-safe manifest rewriting.',
  },
  {
    title: 'APK architecture isolated',
    body: 'This web repo only consumes the existing contracts. No Expo runtime, Android player, or mobile navigation code is shared or modified here.',
  },
  {
    title: 'Responsive browser layout',
    body: 'The web shell prioritizes direct channel selection, mobile-safe controls, fullscreen access, and fast retry paths when a source needs to be retried.',
  },
]

export function HomePage() {
  const { data, selectedChannel, selectChannel, loading, error, reload } =
    useCatalogBootstrap()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sourceIndex, setSourceIndex] = useState(0)

  const filteredChannels = useMemo(() => {
    const channels = data?.channels ?? []

    if (selectedCategory === 'all') {
      return channels
    }

    return channels.filter(
      (channel) => channel.category.toLowerCase() === selectedCategory,
    )
  }, [data?.channels, selectedCategory])

  const activeStream = useMemo(() => {
    if (!selectedChannel) {
      return null
    }

    return selectedChannel.playbackCandidates[sourceIndex] ?? null
  }, [selectedChannel, sourceIndex])

  const featuredBanner = data?.banners[0] ?? null
  const popupLines = data?.popupSettings?.bulletPoints ?? []
  const modeFlags = [
    data?.settings.freeMode ? 'Free mode enabled' : null,
    data?.settings.emergencyMode ? 'Emergency mode active' : null,
    data?.settings.maintenanceMode ? 'Maintenance mode active' : null,
  ].filter(Boolean)

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-section__content">
          <p className="eyebrow">Production-connected web frontend</p>
          <h1>Stable browser playback for {env.brandName}</h1>
          <p className="hero-copy">
            This isolated Vite frontend now loads the real production catalog,
            resolves categories from live channel data, and boots HLS playback
            through the stream proxy flow already used by the wider Osmani TV
            platform.
          </p>

          <div className="hero-actions">
            <a className="button" href="#player">
              Watch live
            </a>
            <a className="button button--ghost" href="#channels">
              Browse channels
            </a>
            {data?.whatsappSettings?.enabled && data.whatsappSettings.url ? (
              <a
                className="button button--ghost"
                href={data.whatsappSettings.url}
                target="_blank"
                rel="noreferrer"
              >
                Contact support
              </a>
            ) : null}
          </div>
        </div>

        <div className="hero-panel">
          <p className="hero-panel__label">Runtime status</p>
          <ul className="hero-panel__list">
            <li>{(data?.channels.length ?? 0).toString()} active app channels loaded</li>
            <li>
              {(data?.categories.length ?? 0).toString()} category groups available
            </li>
            <li>Catalog source: {env.osmaniAdminApiUrl}</li>
            <li>Stream proxy: {env.streamProxyBaseUrl}</li>
            <li>
              Legacy app API:{' '}
              {data?.legacyApiStatus?.online ? 'online' : 'not verified yet'}
            </li>
          </ul>
        </div>
      </section>

      {featuredBanner ? (
        <section className="section-block hero-banner">
          <div className="hero-banner__content">
            <p className="eyebrow">Featured banner</p>
            <h2>{featuredBanner.title}</h2>
            <p>{featuredBanner.description || 'Live promotional banner from production CMS.'}</p>
          </div>
          {featuredBanner.imageUrl ? (
            <img
              className="hero-banner__image"
              src={featuredBanner.imageUrl}
              alt={featuredBanner.title}
            />
          ) : null}
        </section>
      ) : null}

      {modeFlags.length > 0 ? (
        <section className="section-block state-banner">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Platform modes</p>
              <h2>Current production state</h2>
            </div>
          </div>
          <div className="pill-row">
            {modeFlags.map((flag) => (
              <span className="mini-pill" key={flag}>
                {flag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="player-layout">
        <HlsPlayer
          src={
            selectedChannel?.playbackReadiness === 'ready' && activeStream
              ? activeStream.proxiedUrl
              : ''
          }
          title={selectedChannel?.name || `${env.brandName} live stream`}
          streamLabel={activeStream?.label}
          helperText={selectedChannel?.playbackMessage}
          unavailableReason={
            selectedChannel && selectedChannel.playbackReadiness !== 'ready'
              ? selectedChannel.playbackMessage
              : null
          }
          hasNextSource={
            Boolean(selectedChannel) &&
            sourceIndex < (selectedChannel?.playbackCandidates.length ?? 0) - 1
          }
          onNextSource={() => setSourceIndex((value) => value + 1)}
        />

        <aside className="section-block playback-sidebar">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Stream bootstrap</p>
              <h2>Current channel</h2>
            </div>
          </div>

          {selectedChannel ? (
            <div className="channel-summary">
              <div className="channel-summary__header">
                <strong>{selectedChannel.name}</strong>
                <span className="mini-pill">{selectedChannel.category}</span>
              </div>
              <p>{selectedChannel.playbackMessage}</p>
              <div className="channel-meta">
                <span>{selectedChannel.accessType === 'premium' ? 'Premium' : 'Free'}</span>
                <span>{selectedChannel.isHD ? 'HD' : 'SD'}</span>
                <span>{selectedChannel.playerType.toUpperCase()}</span>
              </div>
              <div className="channel-meta channel-meta--stacked">
                <span>Origin: {selectedChannel.streamHeaders.origin || 'None'}</span>
                <span>Referer: {selectedChannel.streamHeaders.referer || 'None'}</span>
              </div>
            </div>
          ) : (
            <p className="player-helper">
              No channel selected yet. Choose a channel from the production
              catalog to start playback.
            </p>
          )}

          <div className="playback-sidebar__actions">
            <button className="button button--ghost" type="button" onClick={reload}>
              Reload production data
            </button>
          </div>
        </aside>
      </div>

      <section className="content-grid">
        {focusCards.map((card) => (
          <article className="info-card" key={card.title}>
            <p className="eyebrow">Focus</p>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className="section-block" id="api">
        <div className="section-heading">
          <div>
            <p className="eyebrow">API wiring</p>
            <h2>Real production contract</h2>
          </div>
          <p>
            `osmani-admin-api` now drives categories, channels, settings, popup
            content, WhatsApp support, and the preferred stream proxy. `osmani-tv`
            remains separately configurable as the legacy app runtime host.
          </p>
        </div>

        <div className="content-grid">
          <article className="info-card">
            <div className="info-card__topline">
              <h3>osmani-admin-api</h3>
              <span className="mini-pill">Live</span>
            </div>
            <p>{env.osmaniAdminApiUrl}</p>
            <p>
              Endpoints in use: `{env.channelsPath}`, `{env.settingsPath}`,
              `{env.bannersPath}`, `{env.popupSettingsPath}`,
              `{env.whatsappSettingsPath}`.
            </p>
          </article>

          <article className="info-card">
            <div className="info-card__topline">
              <h3>stream-proxy</h3>
              <span className="mini-pill">HLS</span>
            </div>
            <p>{env.streamProxyBaseUrl}</p>
            <p>
              The player proxies manifest requests so Chrome receives rewritten
              segment URLs plus the production `Origin`, `Referer`, and
              `User-Agent` headers when needed.
            </p>
          </article>

          <article className="info-card">
            <div className="info-card__topline">
              <h3>osmani-tv</h3>
              <span className="mini-pill">
                {data?.legacyApiStatus?.online ? 'Verified' : 'Configurable'}
              </span>
            </div>
            <p>{env.osmaniTvApiUrl}</p>
            <p>
              Used here as a separately configurable legacy app host reference
              and health source without coupling the browser UI to the Expo APK
              runtime.
            </p>
          </article>
        </div>
      </section>

      <section className="section-block" id="channels">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Categories + channels</p>
            <h2>Live catalog from production</h2>
          </div>
          <p>
            Categories are derived directly from the current production channel
            list so the web app stays aligned with the backend data contract.
          </p>
        </div>

        <div className="pill-row">
          {data?.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`category-pill${
                selectedCategory === category.id ||
                selectedCategory === category.label.toLowerCase()
                  ? ' category-pill--active'
                  : ''
              }`}
              onClick={() =>
                setSelectedCategory(
                  category.id === 'all' ? 'all' : category.label.toLowerCase(),
                )
              }
            >
              {category.label}
              <span>{category.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading production channels...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <p>{error}</p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="empty-state">
            <p>No channels are available in this category yet.</p>
          </div>
        ) : (
          <div className="channel-grid">
            {filteredChannels.map((channel) => {
              const isSelected = selectedChannel?.id === channel.id

              return (
                <button
                  key={channel.id}
                  type="button"
                  className={`channel-card${
                    isSelected ? ' channel-card--selected' : ''
                  }`}
                  onClick={() => {
                    setSourceIndex(0)
                    selectChannel(channel)
                  }}
                >
                  <div className="channel-card__media">
                    {channel.thumbnailUrl ? (
                      <img src={channel.thumbnailUrl} alt={channel.name} />
                    ) : (
                      <div className="channel-card__placeholder">
                        {channel.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="channel-card__body">
                    <div className="channel-card__topline">
                      <strong>{channel.name}</strong>
                      <span className="mini-pill">{channel.category}</span>
                    </div>
                    <p>{channel.playbackMessage}</p>
                    <div className="channel-meta">
                      <span>{channel.accessType}</span>
                      <span>{channel.isHD ? 'HD' : 'SD'}</span>
                      <span>
                        {channel.playbackReadiness === 'ready'
                          ? 'Browser ready'
                          : 'Needs attention'}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {popupLines.length > 0 ? (
        <section className="section-block" id="architecture">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Production messaging</p>
              <h2>{data?.popupSettings?.title || env.brandName}</h2>
            </div>
          </div>

          <div className="info-card">
            <p>{data?.popupSettings?.greeting}</p>
            <ul className="detail-list">
              {popupLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {data?.popupSettings?.disclaimer ? (
              <p>{data.popupSettings.disclaimer}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
