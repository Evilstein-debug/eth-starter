'use client'

import { useAccount, useSwitchChain } from 'wagmi'
import { Button } from '@/components/ui/button'
import { targetChain } from '@/lib/env'

export function WrongNetworkBanner() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  if (!isConnected || chainId === targetChain.id) return null

  return (
    <div className="bg-destructive/10 text-destructive border-destructive/30 border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span>
          Wrong network. This app runs on <strong>{targetChain.name}</strong> (chain{' '}
          {targetChain.id}).
        </span>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => switchChain({ chainId: targetChain.id })}
        >
          Switch to {targetChain.name}
        </Button>
      </div>
    </div>
  )
}
