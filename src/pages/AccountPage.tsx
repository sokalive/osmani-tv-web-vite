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

  const bulletPoints = data?.popupSettings?.bulletPoints ?? []

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
              Taarifa za kifurushi, msaada, na hali ya mfumo kwa muonekano wa APK.
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
          <h2>Fungua msaada wa akaunti na maelekezo ya kifurushi</h2>
          <p>
            Frontend ya web inatumia backend ile ile ya production. Muundo huu
            unafuata mwonekano wa akaunti wa app bila kugusa logic ya mobile au
            admin.
          </p>
          <div className="account-panel__actions">
            {data?.whatsappSettings?.enabled && data.whatsappSettings.url ? (
              <a
                className="account-action"
                href={data.whatsappSettings.url}
                target="_blank"
                rel="noreferrer"
              >
                Fungua WhatsApp
              </a>
            ) : null}
            <button type="button" className="account-action account-action--secondary">
              Tazama Maelezo
            </button>
          </div>
        </section>

        {bulletPoints.length ? (
          <section className="account-panel">
            <p className="account-panel__label">Faida za kifurushi</p>
            <ul className="account-list">
              {bulletPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="account-panel">
          <p className="account-panel__label">Vifaa & mfumo</p>
          <div className="account-device-list">
            <article className="account-device">
              <strong>Browser Player</strong>
              <span>Chrome / Edge optimized</span>
            </article>
            <article className="account-device">
              <strong>Playback</strong>
              <span>HLS + fullscreen stable</span>
            </article>
            <article className="account-device">
              <strong>Catalog</strong>
              <span>{data?.channels.length ?? 0} live channels ready</span>
            </article>
          </div>
        </section>
      </section>
    </div>
  )
}
