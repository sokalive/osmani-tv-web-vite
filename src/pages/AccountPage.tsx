import { useCatalogOutlet } from '../app/catalogOutlet'

export function AccountPage() {
  const { data } = useCatalogOutlet()

  const infoCards = [
    {
      label: 'Hali ya mfumo',
      value: data?.legacyApiStatus?.online ? 'ACTIVE' : 'PENDING',
    },
    {
      label: 'Channels',
      value: String(data?.channels.length ?? 0),
    },
    {
      label: 'Categories',
      value: String(data?.categories.length ?? 0),
    },
    {
      label: 'Support',
      value: data?.whatsappSettings?.enabled ? 'WhatsApp' : 'Offline',
    },
  ]

  return (
    <div className="screen-page">
      <section className="account-screen">
        <header className="account-screen__header">
          <div className="account-screen__avatar">
            <span>OT</span>
            <i />
          </div>
          <div>
            <p className="catalog-screen__eyebrow">Akaunti Yangu</p>
            <h1>{data?.popupSettings?.title || 'Osmani TV'}</h1>
            <p className="catalog-screen__subtitle">
              Browser account center with the same dark-card feel as the APK app.
            </p>
          </div>
        </header>

        <div className="account-grid">
          {infoCards.map((card) => (
            <article className="account-stat" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>

        <section className="account-panel account-panel--accent">
          <p className="account-panel__label">Hamisha Kifurushi</p>
          <h2>Support & subscription flow stay on the same backend</h2>
          <p>
            The web project keeps using the connected production APIs only. This
            screen mirrors the APK account presentation style without modifying
            backend or mobile logic.
          </p>
        </section>

        {data?.popupSettings?.bulletPoints.length ? (
          <section className="account-panel">
            <p className="account-panel__label">Maelezo</p>
            <ul className="account-list">
              {data.popupSettings.bulletPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {data?.whatsappSettings?.enabled && data.whatsappSettings.url ? (
          <a
            className="account-action"
            href={data.whatsappSettings.url}
            target="_blank"
            rel="noreferrer"
          >
            Fungua WhatsApp support
          </a>
        ) : null}
      </section>
    </div>
  )
}
