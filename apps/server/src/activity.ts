/**
 * In-memory activity feed: a ring buffer of human-readable events (chain logs, API requests,
 * admin actions). Restarting the server clears it. Swap for a database if you need history.
 */
import type { ActivityEntry } from '@starter/shared/schemas'

const MAX_ENTRIES = 200
const entries: ActivityEntry[] = []
let nextId = 1

export function logActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>): ActivityEntry {
  const full = { id: nextId++, timestamp: new Date().toISOString(), ...entry }
  entries.push(full)
  if (entries.length > MAX_ENTRIES) entries.shift()
  const ref = full.txHash ?? full.requestId
  console.log(`[activity] ${full.kind}: ${full.message}${ref ? ` (${ref})` : ''}`)
  return full
}

/** Newest first. */
export function listActivity(limit = 50): ActivityEntry[] {
  return entries.slice(-limit).reverse()
}

export function clearActivity() {
  entries.length = 0
}
