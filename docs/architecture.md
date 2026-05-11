# Web Frontend Architecture

## Goal

Build a separate browser-focused frontend for stable Chrome playback without
changing the existing Expo / React Native APK architecture or any backend
contracts.

## Boundaries

- This repository is web-only.
- The Android player remains untouched.
- Existing `osmani-tv` and `osmani-admin-api` endpoints remain the source of
  truth.
- Auth, admin workflows, and backend ownership stay where they already live.

## Frontend Layers

### 1. UI Shell

- React + Vite for fast local development and a lightweight browser bundle.
- Global theme tokens in `src/index.css` keep the dark branded shell isolated to
  this repo.
- The initial route structure lives under `src/app` and `src/pages`.

### 2. Playback Layer

- `src/components/player/HlsPlayer.tsx` owns the browser playback UI.
- `src/hooks/useHlsPlayback.ts` owns HLS attachment, autoplay handling,
  fullscreen access, and fatal error recovery.
- Browser-specific playback tuning stays here so API code and page layout remain
  simple.

### 3. API Layer

- `src/lib/apiClient.ts` provides a generic JSON client.
- `src/services/api/osmaniTvClient.ts` is reserved for playback, live channel,
  EPG, or catalog endpoints exposed by `osmani-tv`.
- `src/services/api/osmaniAdminClient.ts` is reserved for admin-managed
  configuration and existing auth-aware endpoints exposed by `osmani-admin-api`.
- Environment variables provide the base URLs so deployment targets can change
  without code changes.

## Data Flow

1. Page shell requests stream metadata from the existing backend APIs.
2. Playback page resolves a stream URL or signed manifest URL.
3. `HlsPlayer` mounts the `video` element.
4. `useHlsPlayback` attaches hls.js in Chrome-class browsers.
5. Native HLS is used only when the browser already supports it.
6. Playback errors recover locally before bubbling up to the page shell.

## Why This Is Safe

- No shared runtime with Expo or React Native.
- No backend route changes are required.
- Browser playback decisions are contained in one layer.
- The initial scaffold can evolve independently into its own GitHub repo and CI.
