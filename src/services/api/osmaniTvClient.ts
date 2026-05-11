import { env } from '../../config/env'
import { createApiClient } from '../../lib/apiClient'

export const osmaniTvClient = createApiClient({
  baseUrl: env.osmaniTvApiUrl,
  serviceName: 'osmani-tv',
})
