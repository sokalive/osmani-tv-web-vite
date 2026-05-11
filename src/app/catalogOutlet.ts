import { useOutletContext } from 'react-router-dom'
import type { ChannelViewModel, CatalogBootstrap } from '../types/osmani'

export type CatalogOutletContext = {
  data: CatalogBootstrap | null
  selectedChannel: ChannelViewModel | null
  loading: boolean
  error: string | null
  reload: () => void
  selectChannel: (channel: ChannelViewModel) => void
}

export function useCatalogOutlet() {
  return useOutletContext<CatalogOutletContext>()
}
