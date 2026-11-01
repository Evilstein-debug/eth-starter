'use client'

import { explorerTxUrl, getChain, isSupportedChainId } from '@starter/shared/chains'
import { ExternalLink, Loader2 } from 'lucide-react'
import type { TxState } from '@/hooks/use-transaction'

const LABELS: Record<TxState['status'], string> = {
  idle: '',
  simulating: 'Simulating…',
  signing: 'Confirm in your wallet…',
  pending: 'Pending…',
  confirmed: 'Confirmed',
  failed: 'Failed',
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.status === 'idle') return null

  const hash = 'hash' in state ? state.hash : undefined
  const chainId = 'chainId' in state ? state.chainId : undefined
  const url =
    hash && chainId && isSupportedChainId(chainId)
      ? explorerTxUrl(getChain(chainId), hash)
      : undefined
  const busy = ['simulating', 'signing', 'pending'].includes(state.status)
  const color =
    state.status === 'confirmed'
      ? 'text-green-600'
      : state.status === 'failed'
        ? 'text-destructive'
        : 'text-muted-foreground'

  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${color}`} role="status">
      {busy && <Loader2 className="size-4 animate-spin" />}
      <span>{LABELS[state.status]}</span>
      {state.status === 'failed' && <span className="break-all">{state.error}</span>}
      {hash &&
        (url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
          >
            View on explorer <ExternalLink className="size-3" />
          </a>
        ) : (
          <code className="text-xs break-all">{hash}</code>
        ))}
    </div>
  )
}
