import { env } from '../../config/env'
import { createApiClient } from '../../lib/apiClient'

export const osmaniAdminPaymentClient = createApiClient({
  baseUrl: env.osmaniAdminPaymentProxyUrl,
  serviceName: 'osmani-admin-payment-proxy',
})
