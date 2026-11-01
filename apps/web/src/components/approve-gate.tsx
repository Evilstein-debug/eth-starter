'use client'

import type { ReactNode } from 'react'
import { erc20Abi, formatUnits, maxUint256, type Address } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'
import { TxButton } from '@/components/tx-button'

/**
 * Approve-before-transfer flow. Renders an "Approve" button until `spender` may move `amount`
 * of `token` for the connected account, then renders `children` (the real action).
 */
export function ApproveGate({
  token,
  spender,
  amount,
  exact = true,
  children,
}: {
  token: Address
  spender: Address
  amount: bigint
  /** Approve exactly `amount` (safer) or unlimited. */
  exact?: boolean
  children: ReactNode
}) {
  const { address: owner } = useAccount()
  const { data, refetch } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: token, abi: erc20Abi, functionName: 'allowance', args: [owner!, spender] },
      { address: token, abi: erc20Abi, functionName: 'decimals' },
      { address: token, abi: erc20Abi, functionName: 'symbol' },
    ],
    query: { enabled: Boolean(owner) },
  })

  const [allowance, decimals, symbol] = data ?? []
  if (!owner || allowance === undefined || allowance >= amount) return <>{children}</>

  return (
    <TxButton
      variant="secondary"
      run={(send) =>
        send({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, exact ? amount : maxUint256],
        })
      }
      onConfirmed={() => refetch()}
    >
      Approve {formatUnits(amount, decimals ?? 18)} {symbol}
    </TxButton>
  )
}
