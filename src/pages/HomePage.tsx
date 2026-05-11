import { HlsPlayer } from '../components/player/HlsPlayer'
import { apiReadiness, env } from '../config/env'

const deliveryPillars = [
  {
    title: 'Stable Chrome playback',
    body: 'hls.js owns HLS playback in Chromium browsers with explicit recovery paths for network and media errors.',
  },
  {
    title: 'Mobile app stays isolated',
    body: 'This repo does not share runtime architecture with the Expo APK app, so the Android player remains untouched.',
  },
  {
    title: 'Responsive fullscreen UX',
    body: 'The shell is laid out for desktop and tablet widths first, with fullscreen and autoplay controls surfaced clearly.',
  },
]

const integrationCards = [
  {
    title: 'osmani-tv',
    status: apiReadiness.tv ? 'Configured' : 'Pending',
    body: apiReadiness.tv
      ? env.osmaniTvApiUrl
      : 'Hook the existing catalog/playback endpoints here without changing backend contracts.',
  },
  {
    title: 'osmani-admin-api',
    status: apiReadiness.admin ? 'Configured' : 'Pending',
    body: apiReadiness.admin
      ? env.osmaniAdminApiUrl
      : 'Reuse existing admin/auth-managed endpoints only after the current request/response contract is copied over.',
  },
]

const architectureCards = [
  'UI shell and dark theme live in React components and global tokens only for this web repo.',
  'Playback stays in a dedicated HLS layer so browser-specific tuning does not leak into API or layout code.',
  'API access is split into service clients for osmani-tv and osmani-admin-api with env-driven base URLs.',
]

export function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-section__content">
          <p className="eyebrow">New isolated web frontend</p>
          <h1>Chrome-focused streaming for {env.brandName}</h1>
          <p className="hero-copy">
            This Vite app is a separate browser playback project designed to
            reuse the existing backend APIs while keeping the stable Android APK
            architecture untouched.
          </p>

          <div className="hero-actions">
            <a className="button" href="#player">
              Launch player area
            </a>
            <a className="button button--ghost" href="#architecture">
              Review architecture
            </a>
          </div>
        </div>

        <div className="hero-panel">
          <p className="hero-panel__label">Current scaffold guarantees</p>
          <ul className="hero-panel__list">
            <li>Separate React + Vite codebase for web only</li>
            <li>Dedicated hls.js playback component for browser stability</li>
            <li>Explicit integration seam for both existing backend APIs</li>
            <li>No Expo, APK, or Android player changes</li>
          </ul>
        </div>
      </section>

      <HlsPlayer
        src={env.defaultStreamUrl}
        title={`${env.brandName} live stream`}
      />

      <section className="content-grid">
        {deliveryPillars.map((pillar) => (
          <article className="info-card" key={pillar.title}>
            <p className="eyebrow">Focus</p>
            <h3>{pillar.title}</h3>
            <p>{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="section-block" id="api">
        <div className="section-heading">
          <p className="eyebrow">API integration plan</p>
          <h2>Reuse current backend contracts</h2>
          <p>
            The initial scaffold separates the API clients now, then the
            existing request shapes from the current apps can be mapped in
            without changing the backend surface area.
          </p>
        </div>

        <div className="content-grid">
          {integrationCards.map((card) => (
            <article className="info-card" key={card.title}>
              <div className="info-card__topline">
                <h3>{card.title}</h3>
                <span className="mini-pill">{card.status}</span>
              </div>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block" id="architecture">
        <div className="section-heading">
          <p className="eyebrow">Architecture</p>
          <h2>Playback, UI, and APIs stay decoupled</h2>
        </div>

        <div className="architecture-list">
          {architectureCards.map((item) => (
            <article className="info-card" key={item}>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
