import { serverUrl } from './env'

/** POST JSON to apps/server and return the parsed body; throws with the server's error text. */
export async function postJson<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: unknown }
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
  return json as T
}
