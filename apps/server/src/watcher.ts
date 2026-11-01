/**
 * Polls every deployed contract's events and writes them to the activity feed.
 * Uses plain eth_getLogs over a block cursor (not filters), so it survives anvil
 * snapshots/reverts and works on any RPC.
 */
import { deployedContracts } from '@starter/shared/contracts'
import { decodeEventLog, type Abi, type Address, type Log } from 'viem'
import { logActivity } from './activity'
import { chain, publicClient } from './chain'

const POLL_MS = chain.id === 31337 ? 1_000 : 4_000
const MAX_RANGE = 1_000n

let cursor: bigint | undefined

/** Call after an anvil revert so the watcher re-reads from the restored head. */
export function resetWatcher() {
  cursor = undefined
}

function formatValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value))
    return `${value.slice(0, 6)}…${value.slice(-4)}`
  return String(value)
}

function describe(name: string, eventName: string, args: unknown) {
  const fields =
    args && typeof args === 'object' && !Array.isArray(args)
      ? Object.entries(args).map(([k, v]) => `${k}=${formatValue(v)}`)
      : []
  return `${name}.${eventName}(${fields.join(', ')})`
}

async function poll(byAddress: Map<string, { name: string; abi: Abi }>) {
  const head = await publicClient.getBlockNumber()
  if (cursor === undefined || cursor > head + 1n) cursor = head + 1n // first run or chain rewound
  if (cursor > head) return

  const toBlock = head - cursor >= MAX_RANGE ? cursor + MAX_RANGE - 1n : head
  const logs: Log[] = await publicClient.getLogs({
    address: [...byAddress.keys()] as Address[],
    fromBlock: cursor,
    toBlock,
  })
  for (const log of logs) {
    const contract = byAddress.get(log.address.toLowerCase())
    if (!contract) continue
    try {
      const { eventName, args } = decodeEventLog({
        abi: contract.abi,
        data: log.data,
        topics: log.topics,
      })
      logActivity({
        kind: 'chain',
        message: describe(contract.name, eventName ?? 'Unknown', args),
        txHash: log.transactionHash ?? undefined,
        blockNumber: log.blockNumber?.toString(),
      })
    } catch {
      // Event not in our ABI (e.g. from a library); ignore.
    }
  }
  cursor = toBlock + 1n
}

export function startWatcher() {
  const contracts = deployedContracts(chain.id)
  if (contracts.length === 0) {
    console.warn(
      `[watcher] no contracts deployed on chain ${chain.id}; activity feed shows requests only`,
    )
    return
  }
  const byAddress = new Map(
    contracts.map((c) => [c.address.toLowerCase(), { name: c.name, abi: c.abi }]),
  )
  console.log(`[watcher] watching ${contracts.map((c) => c.name).join(', ')}`)

  const tick = async () => {
    try {
      await poll(byAddress)
    } catch (error) {
      console.warn('[watcher] poll failed:', error instanceof Error ? error.message : error)
    }
    setTimeout(tick, POLL_MS)
  }
  void tick()
}
