import { env } from '../../config/env'
import type { LegacyApiStatus } from '../../types/osmani'
import { osmaniTvClient } from './osmaniTvClient'

type LegacyStatusResponse = {
  message?: string
}

export async function fetchLegacyApiStatus() {
  const payload = await osmaniTvClient.get<LegacyStatusResponse>(
    env.legacyApiHealthPath,
  )

  return {
    message: payload.message || 'Legacy app runtime online',
    online: true,
  } satisfies LegacyApiStatus
}
