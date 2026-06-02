const enabled = import.meta.env.DEV

export function logPlayback(event: string, detail: Record<string, unknown> = {}) {
  if (!enabled) {
    return
  }

  console.info(`[osmani-playback] ${event}`, {
    ts: new Date().toISOString(),
    ...detail,
  })
}
