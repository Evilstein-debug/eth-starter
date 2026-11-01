'use client'

import type { ComponentProps } from 'react'
import type { TransactionReceipt } from 'viem'
import { useAccount } from 'wagmi'
import { TxStatus } from '@/components/tx-status'
import { Button } from '@/components/ui/button'
import { useTransaction } from '@/hooks/use-transaction'

type Send = ReturnType<typeof useTransaction>['send']

/**
 * A button that runs one contract write with simulate → sign → confirm and shows the status.
 * `run` receives `send` so the call stays fully typed against the ABI at the call site:
 *   <TxButton run={(send) => send({ abi, address, functionName: 'mint', args: [to, 1n] })} />
 */
export function TxButton({
  run,
  onConfirmed,
  children,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Button>, 'onClick'> & {
  run: (send: Send) => Promise<TransactionReceipt | undefined>
  onConfirmed?: (receipt: TransactionReceipt) => void
}) {
  const { isConnected } = useAccount()
  const { state, send, isBusy } = useTransaction()

  return (
    <div className="flex flex-col gap-2">
      <Button
        {...props}
        disabled={disabled || isBusy || !isConnected}
        onClick={async () => {
          const receipt = await run(send)
          if (receipt) onConfirmed?.(receipt)
        }}
      >
        {isConnected ? children : 'Connect a wallet'}
      </Button>
      <TxStatus state={state} />
    </div>
  )
}
