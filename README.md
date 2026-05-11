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

Set `VITE_DEFAULT_STREAM_URL` to a valid `.m3u8` stream and provide the two API
base URLs before testing live integration.

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
- a browser-focused HLS playback layer
- autoplay and fullscreen handling
- dedicated API clients for `osmani-tv` and `osmani-admin-api`
- environment-driven configuration for safe rollout
