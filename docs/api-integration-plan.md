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

## Immediate Next Mapping Tasks

- identify the existing playback bootstrap endpoint
- identify the current manifest or stream URL response shape
- identify any admin-managed branding/config payloads needed by the navbar or
  home page
- wire those concrete calls into the two service clients

## Environment Variables

- `VITE_OSMANI_TV_API_URL`
- `VITE_OSMANI_ADMIN_API_URL`
- `VITE_DEFAULT_STREAM_URL`
- `VITE_BRAND_NAME`
