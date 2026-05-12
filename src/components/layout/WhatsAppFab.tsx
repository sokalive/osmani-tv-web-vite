type WhatsAppFabProps = {
  enabled: boolean
  url: string
}

function WhatsAppIcon() {
  return (
    <svg
      className="whatsapp-fab__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M19.1 4.9A10 10 0 0 0 3.4 17.3L2 22l4.9-1.3a10 10 0 1 0 12.2-15.8Zm-7.1 15.4c-1.4 0-2.8-.4-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3a8.3 8.3 0 1 1 6.8 3.6Zm4.6-6.2c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.3-1.4-1.4-1.7-.1-.2 0-.4.1-.5l.4-.4c.1-.2.2-.3.2-.4.1-.2 0-.3 0-.5-.1-.1-.6-1.4-.8-1.9-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.6.1.1 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"
      />
    </svg>
  )
}

export function WhatsAppFab({ enabled, url }: WhatsAppFabProps) {
  if (enabled !== true || !url) {
    return null
  }

  return (
    <a
      className="whatsapp-fab"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Open WhatsApp"
      title="Open WhatsApp"
    >
      <WhatsAppIcon />
    </a>
  )
}
