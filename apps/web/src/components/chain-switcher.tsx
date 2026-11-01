'use client'

import { useAccount, useSwitchChain } from 'wagmi'

export function ChainSwitcher() {
  const { chainId, isConnected } = useAccount()
  const { chains, switchChain, isPending } = useSwitchChain()
  if (!isConnected) return null

  return (
    <select
      aria-label="Network"
      className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
      value={chainId}
      disabled={isPending}
      onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
    >
      {!chains.some((c) => c.id === chainId) && <option value={chainId}>Unsupported</option>}
      {chains.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
