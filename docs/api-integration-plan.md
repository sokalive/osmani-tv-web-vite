# API Integration Plan

## Objective

Reuse the existing backend APIs from the current Osmani TV ecosystem while
keeping this new web frontend isolated from the stable mobile app.

## Services

### `osmani-tv`

Use this service for the user-facing playback experience:

- channel listing / live catalog
- stream resolution or manifest lookup
- EPG / schedule data
- playback metadata needed by the web UI

### `osmani-admin-api`

Use this service only where the current platform already depends on it:

- branding or configuration that is already backend-managed
- existing auth-aware endpoints
- admin-managed metadata already exposed for clients

## Implementation Approach

1. Audit the current mobile/web consumer calls without modifying their backend
   behavior.
2. Copy the exact request URLs, headers, and response shapes into typed service
   modules in this repo.
3. Keep the generic HTTP client in `src/lib/apiClient.ts`.
4. Keep per-service mapping in `src/services/api`.
5. Keep playback manifest retrieval separate from the HLS rendering logic.

## Authentication Handling

- Do not redesign auth.
- Reuse whatever token, cookie, or header model the current backend already
  expects.
- Keep auth attachment inside the API layer rather than in React components.

## Current Production Mapping

- `osmani-admin-api.onrender.com/api/channels` is the live channel catalog used
  by the mobile app and now by this web frontend
- categories are derived from the live channel `category` field
- `osmani-admin-api.onrender.com/api/settings` exposes app mode flags
- `osmani-admin-api.onrender.com/api/banners`,
  `osmani-admin-api.onrender.com/api/popup-settings`, and
  `osmani-admin-api.onrender.com/api/whatsapp-settings` provide supporting UI
  data already used in the platform
- `osmani-admin-api.onrender.com/stream-proxy` is the preferred browser HLS
  bootstrap endpoint for manifest rewriting and upstream header forwarding
- `osmani-tv.onrender.com/api` remains a separately configurable legacy runtime
  health endpoint, while its `/api/channels` is intentionally not the primary
  catalog source

## Environment Variables

- `VITE_OSMANI_TV_API_URL`
- `VITE_OSMANI_ADMIN_API_URL`
- `VITE_STREAM_PROXY_BASE_URL`
- `VITE_BRAND_NAME`

## Deployment Note

The production Render APIs currently behave differently when a browser `Origin`
header is present. This web repo therefore uses same-origin proxy paths plus
deployment rewrites so the frontend can stay static while the live APIs remain
unchanged.
