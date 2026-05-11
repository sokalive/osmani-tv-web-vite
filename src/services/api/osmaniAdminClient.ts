import { env } from '../../config/env'
import { createApiClient } from '../../lib/apiClient'

export const osmaniAdminClient = createApiClient({
  baseUrl: env.osmaniAdminApiUrl,
  serviceName: 'osmani-admin-api',
})
