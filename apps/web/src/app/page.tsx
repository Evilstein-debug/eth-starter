'use client'

import { mockErc20Abi, simpleEscrowAbi } from '@starter/shared/generated'
import { useState } from 'react'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'
import { ApproveGate } from '@/components/approve-gate'
import { TxButton } from '@/components/tx-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addresses } from '@/lib/contracts'
import { targetChain } from '@/lib/env'

// Example screens that exercise the stack. Replace this page with your product.
export default function Home() {
  const { address } = useAccount()
  const { token, escrow } = addresses
  const [payee, setPayee] = useState('')
  const [amountText, setAmountText] = useState('10')

  const { data, refetch } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: token, abi: mockErc20Abi, functionName: 'balanceOf', args: [address!] },
      { address: token, abi: mockErc20Abi, functionName: 'decimals' },
      { address: token, abi: mockErc20Abi, functionName: 'symbol' },
      { address: escrow, abi: simpleEscrowAbi, functionName: 'nextId' },
    ],
    query: { enabled: Boolean(address && token && escrow) },
  })
  const [balance, decimals = 6, symbol = '', dealCount] = data ?? []

  if (!token || !escrow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No contracts on {targetChain.name}</CardTitle>
          <CardDescription>
            Deploy (<code>pnpm dev</code> locally, or <code>pnpm deploy:sepolia</code>), then run{' '}
            <code>pnpm codegen</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const amount = safeParseUnits(amountText, decimals)
  const validPayee = isAddress(payee)

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Test token</CardTitle>
          <CardDescription>
            Balance: {balance === undefined ? '—' : `${formatUnits(balance, decimals)} ${symbol}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TxButton
            run={(send) =>
              send({
                address: token,
                abi: mockErc20Abi,
                functionName: 'mint',
                args: [address!, parseUnits('1000', decimals)],
              })
            }
            onConfirmed={() => refetch()}
          >
            Mint 1,000 {symbol}
          </TxButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Example: escrow</CardTitle>
          <CardDescription>
            Approve, then lock tokens for a payee for 24h. Deals created:{' '}
            {dealCount?.toString() ?? '—'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="payee">Payee</Label>
            <Input
              id="payee"
              placeholder="0x…"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="amount">Amount ({symbol})</Label>
            <Input id="amount" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </div>
          {amount && validPayee ? (
            <ApproveGate token={token} spender={escrow} amount={amount}>
              <TxButton
                run={(send) =>
                  send({
                    address: escrow,
                    abi: simpleEscrowAbi,
                    functionName: 'create',
                    args: [payee, amount, BigInt(Math.floor(Date.now() / 1000) + 86_400)],
                  })
                }
                onConfirmed={() => refetch()}
              >
                Lock {amountText} {symbol}
              </TxButton>
            </ApproveGate>
          ) : (
            <p className="text-muted-foreground text-sm">Enter a payee address and an amount.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function safeParseUnits(value: string, decimals: number) {
  try {
    const parsed = parseUnits(value, decimals)
    return parsed > 0n ? parsed : undefined
  } catch {
    return undefined
  }
}
