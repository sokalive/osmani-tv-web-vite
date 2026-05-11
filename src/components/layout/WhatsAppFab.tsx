type WhatsAppFabProps = {
  url: string
}

export function WhatsAppFab({ url }: WhatsAppFabProps) {
  if (!url) {
    return null
  }

  return (
    <a
      className="whatsapp-fab"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Open WhatsApp support"
    >
      WA
    </a>
  )
}
