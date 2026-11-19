import { classifyHost, extractTextParts, wireLog } from '../core/wire'

let installed = false

function resolveUrl(input: RequestInfo | URL): URL | null {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return new URL(raw, location.href)
  } catch {
    return null
  }
}

/**
 * Records every cross-origin `fetch` this tab makes, at the network layer, so the UI can show what
 * really left the browser. It never reads headers or query strings (they carry API keys and App
 * Check tokens), never touches the response body, and passes every call through unchanged.
 * On-device Gemini Nano steps make no network request, so they simply never appear here.
 */
export function installWireTap(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  installed = true
  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const body = typeof init?.body === 'string' ? init.body : undefined
    let status = 0
    try {
      const res = await original(input, init)
      status = res.status
      return res
    } finally {
      if (url && url.origin !== location.origin) {
        const kind = classifyHost(url.host, url.pathname)
        wireLog.add({
          method,
          host: url.host,
          path: url.pathname,
          bytes: body ? new TextEncoder().encode(body).length : 0,
          status,
          kind,
          texts: kind === 'ai' ? extractTextParts(body) : [],
        })
      }
    }
  }
}
