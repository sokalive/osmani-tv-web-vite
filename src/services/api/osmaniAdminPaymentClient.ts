import { env } from '../../config/env'
import { createApiClient } from '../../lib/apiClient'

/** @deprecated Use `osmaniAdminClient` — payment routes share the admin API proxy. */
export const osmaniAdminPaymentClient = createApiClient({
  baseUrl: env.osmaniAdminApiUrl,
  serviceName: 'osmani-admin-api',
})
