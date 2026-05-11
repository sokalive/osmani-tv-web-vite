# Osmani TV Web Vite

Separate React + Vite + hls.js frontend for browser playback stability.

## Scope

- Web-only project
- Chrome-focused HLS playback
- Reuse existing `osmani-tv` and `osmani-admin-api` backends
- Keep Expo / React Native / APK architecture untouched

## Stack

- React
- Vite
- hls.js
- TypeScript

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

The repository now ships with production-oriented defaults:

- `VITE_OSMANI_ADMIN_API_URL=/osmani-admin-proxy`
- `VITE_OSMANI_TV_API_URL=/osmani-tv-proxy`
- `VITE_STREAM_PROXY_BASE_URL=/osmani-admin-proxy/stream-proxy`

The browser player fetches the live channel catalog from `osmani-admin-api`,
derives categories from the real response, and sends playback through the
configured stream proxy for browser-safe HLS delivery.

To avoid browser-origin failures against the Render backends, the repo also
includes:

- Vite dev proxies in `vite.config.ts`
- Vercel rewrites in `vercel.json`

## Project Structure

```text
src/
  app/                router + app shell
  components/player/  browser playback UI
  config/             env configuration
  hooks/              hls.js playback hook
  lib/                generic API client
  pages/              route-level screens
  services/api/       backend-specific clients
```

## Docs

- `docs/architecture.md`
- `docs/api-integration-plan.md`

## Current Status

The initial scaffold includes:

- an isolated dark-themed web shell
- production channel/category/settings integration
- proxied HLS playback with autoplay and fullscreen handling
- dedicated API clients for `osmani-tv` and `osmani-admin-api`
- environment-driven configuration for safe rollout
