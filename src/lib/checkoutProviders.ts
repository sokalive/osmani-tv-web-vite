import type {
  CheckoutPaymentProvider,
  CheckoutProvidersState,
} from '../services/api/subscriptionService'

export type CheckoutProcessorBrand = {
  id: CheckoutPaymentProvider
  label: string
  color: string
  blurb: string
}

export const CHECKOUT_PROCESSOR_BRANDS: Record<
  CheckoutPaymentProvider,
  CheckoutProcessorBrand
> = {
  sonicpesa: {
    id: 'sonicpesa',
    label: 'SonicPesa',
    color: '#22C55E',
    blurb: 'Malipo ya haraka kupitia SonicPesa',
  },
  zenopay: {
    id: 'zenopay',
    label: 'ZenoPay',
    color: '#3B82F6',
    blurb: 'Malipo salama kupitia ZenoPay',
  },
  auraxpay: {
    id: 'auraxpay',
    label: 'Aurax Pay',
    color: '#A855F7',
    blurb: 'Malipo ya kisasa kupitia Aurax Pay',
  },
}

export function listEnabledCheckoutProcessors(
  state: CheckoutProvidersState | null,
): CheckoutProcessorBrand[] {
  if (!state) {
    return [CHECKOUT_PROCESSOR_BRANDS.sonicpesa]
  }

  const enabled: CheckoutProcessorBrand[] = []

  if (state.sonicpesa) {
    enabled.push(CHECKOUT_PROCESSOR_BRANDS.sonicpesa)
  }

  if (state.zenopay) {
    enabled.push(CHECKOUT_PROCESSOR_BRANDS.zenopay)
  }

  if (state.auraxpay) {
    enabled.push(CHECKOUT_PROCESSOR_BRANDS.auraxpay)
  }

  if (enabled.length > 0) {
    return enabled
  }

  return [CHECKOUT_PROCESSOR_BRANDS[state.provider]]
}

export function activeCheckoutProcessorBrand(
  state: CheckoutProvidersState | null,
): CheckoutProcessorBrand {
  if (!state) {
    return CHECKOUT_PROCESSOR_BRANDS.sonicpesa
  }

  return CHECKOUT_PROCESSOR_BRANDS[state.provider]
}
