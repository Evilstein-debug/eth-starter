import type { AbiParameter } from 'viem'

/**
 * Turn a text-box value into an ABI argument. Integers become bigint, bools accept true/1,
 * arrays and tuples take JSON (e.g. ["0xabc…", "0xdef…"]).
 */
export function parseAbiArg(param: AbiParameter, raw: string): unknown {
  return parseValue(param.type, raw.trim())
}

function parseValue(type: string, raw: string): unknown {
  if (type.endsWith(']')) {
    const inner = type.slice(0, type.lastIndexOf('['))
    const items = JSON.parse(raw) as unknown[]
    return items.map((item) =>
      parseValue(inner, typeof item === 'string' ? item : JSON.stringify(item)),
    )
  }
  if (type.startsWith('tuple')) return JSON.parse(raw)
  if (/^u?int\d*$/.test(type)) return BigInt(raw)
  if (type === 'bool') return raw === 'true' || raw === '1'
  return raw
}

export function formatAbiResult(value: unknown): string {
  return typeof value === 'string'
    ? value
    : JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
}
