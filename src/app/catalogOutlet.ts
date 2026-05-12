import { useOutletContext } from 'react-router-dom'
import type {
  ChannelViewModel,
  CatalogBootstrap,
  PlaybackGateResult,
  SubscriptionStatus,
} from '../types/osmani'

export type CatalogOutletContext = {
  data: CatalogBootstrap | null
  selectedChannel: ChannelViewModel | null
  loading: boolean
  error: string | null
  reload: () => void
  selectChannel: (channel: ChannelViewModel) => void
  subscription: SubscriptionStatus | null
  isSubscribed: boolean
  subscriptionVersion: number
  refreshSubscription: (
    reason?: string,
    options?: { recover?: boolean },
  ) => Promise<SubscriptionStatus | null>
  gateForPlayback: (
    channel: Pick<ChannelViewModel, 'accessType'> | null,
    reason?: string,
  ) => Promise<PlaybackGateResult>
  requestEmergencyModal: () => void
}

export function useCatalogOutlet() {
  return useOutletContext<CatalogOutletContext>()
}
