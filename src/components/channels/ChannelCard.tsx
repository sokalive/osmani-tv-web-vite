import type { ChannelViewModel } from '../../types/osmani'
import { accessBadge } from '../../lib/channelUi'

type ChannelCardProps = {
  channel: ChannelViewModel
  onSelect: (channel: ChannelViewModel) => void
}

export function ChannelCard({ channel, onSelect }: ChannelCardProps) {
  const premium = channel.accessType === 'premium'

  return (
    <button
      type="button"
      className="catalog-card"
      onClick={() => onSelect(channel)}
      aria-label={`Open ${channel.name}`}
    >
      <div className="catalog-card__poster protected-media">
        {channel.thumbnailUrl ? (
          <img
            className="protected-media__asset"
            src={channel.thumbnailUrl}
            alt={channel.name}
            draggable={false}
          />
        ) : (
          <div className="catalog-card__placeholder">
            {channel.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="catalog-card__badges">
          <div className="catalog-card__badges-left">
            {channel.isHD ? <span className="badge badge--hd">HD</span> : <span className="badge badge--ghost" />}
            <span className={`badge ${channel.isLive ? 'badge--live' : 'badge--offline'}`}>
              {channel.isLive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div className="catalog-card__badges-right">
            <span className={`badge ${premium ? 'badge--premium' : 'badge--free'}`}>
              {accessBadge(channel)}
            </span>
          </div>
        </div>

        <div className="catalog-card__glow" aria-hidden="true" />
        <div className="catalog-card__title-pill">
          <span>{channel.name}</span>
        </div>
      </div>
    </button>
  )
}
