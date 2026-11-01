'use client'

import { deployedContracts } from '@starter/shared/contracts'
import { explorerAddressUrl } from '@starter/shared/chains'
import { ContractCard } from '@/components/debug/contract-card'
import { targetChain } from '@/lib/env'

/** Lists every deployed contract on the active chain with its read/write functions. */
export default function DebugPage() {
  const contracts = deployedContracts(targetChain.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Debug contracts</h1>
        <p className="text-muted-foreground text-sm">
          {targetChain.name} (chain {targetChain.id}). Generated from the ABIs by{' '}
          <code>pnpm codegen</code>.
        </p>
      </div>
      {contracts.length === 0 && <p>No contracts deployed on this chain yet.</p>}
      {contracts.map((c) => (
        <ContractCard
          key={c.name}
          name={c.name}
          abi={c.abi}
          address={c.address}
          explorerUrl={explorerAddressUrl(targetChain, c.address)}
        />
      ))}
    </div>
  )
}
