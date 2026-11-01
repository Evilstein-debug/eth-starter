'use client'

import { mockOracleAbi } from '@starter/shared/generated'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { formatUnits } from 'viem'
import { useAccount, useBlock, useReadContracts } from 'wagmi'
import { ActivityFeed } from '@/components/activity-feed'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { addresses } from '@/lib/contracts'
import { postJson } from '@/lib/server'

/** Runs an admin call, shows the result, then refreshes every onchain read on the page. */
function useAdminAction() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<{ busy: boolean; message?: string; error?: boolean }>({
    busy: false,
  })
  async function run(path: string, body?: unknown, okMessage = 'Done') {
    setStatus({ busy: true })
    try {
      await postJson(`/admin${path}`, body)
      setStatus({ busy: false, message: okMessage })
      await queryClient.invalidateQueries()
    } catch (error) {
      setStatus({
        busy: false,
        error: true,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { run, status }
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  )
}

function Result({ status }: { status: ReturnType<typeof useAdminAction>['status'] }) {
  if (!status.message) return null
  return (
    <p
      className={`text-sm whitespace-pre-wrap ${status.error ? 'text-destructive' : 'text-green-600'}`}
    >
      {status.message}
    </p>
  )
}

function OraclePrice() {
  const { run, status } = useAdminAction()
  const [price, setPrice] = useState('2500')
  const oracle = addresses.oracle
  const { data } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: oracle, abi: mockOracleAbi, functionName: 'price' },
      { address: oracle, abi: mockOracleAbi, functionName: 'decimals' },
    ],
    query: { enabled: Boolean(oracle) },
  })
  const current = data ? formatUnits(data[0], data[1]) : '—'
  return (
    <Section title="Oracle price" description={`MockOracle current price: ${current}`}>
      <div className="flex gap-2">
        <Input value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button
          disabled={status.busy}
          onClick={() => run('/oracle-price', { price }, `Price set to ${price}`)}
        >
          Set
        </Button>
      </div>
      <Result status={status} />
    </Section>
  )
}

function Faucet() {
  const { address } = useAccount()
  const mint = useAdminAction()
  const eth = useAdminAction()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('1000')
  const target = to || address || ''
  return (
    <Section
      title="Faucet"
      description="Mint test tokens or set an ETH balance. Defaults to your wallet."
    >
      <Input
        placeholder={address ?? '0x… recipient'}
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex gap-2">
        <Button
          disabled={!target || mint.status.busy}
          onClick={() => mint.run('/mint', { to: target, amount }, `Minted ${amount} mUSD`)}
        >
          Mint {amount} mUSD
        </Button>
        <Button
          variant="secondary"
          disabled={!target || eth.status.busy}
          onClick={() =>
            eth.run('/fund-eth', { to: target, eth: amount }, `ETH balance set to ${amount}`)
          }
        >
          Set ETH balance to {amount}
        </Button>
      </div>
      <Result status={mint.status.message ? mint.status : eth.status} />
    </Section>
  )
}

function TimeTravel() {
  const { run, status } = useAdminAction()
  const { data: block } = useBlock({ watch: true })
  const now = block ? new Date(Number(block.timestamp) * 1000).toLocaleString() : '—'
  const jumps = [
    ['+1 hour', 3_600],
    ['+1 day', 86_400],
    ['+7 days', 604_800],
  ] as const
  return (
    <Section title="Time" description={`Chain time: ${now}`}>
      <div className="flex flex-wrap gap-2">
        {jumps.map(([label, seconds]) => (
          <Button
            key={label}
            variant="secondary"
            disabled={status.busy}
            onClick={() => run('/time-travel', { seconds }, `Fast-forwarded ${label}`)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Result status={status} />
    </Section>
  )
}

function Reset() {
  const { run, status } = useAdminAction()
  const [armed, setArmed] = useState(false)
  return (
    <Section
      title="Reset state"
      description="Revert the chain to right after deploy + seed. Afterwards, clear your wallet's cached activity/nonce for this network (in MetaMask, under Settings → Advanced) or transactions may get stuck."
    >
      <Button
        variant="destructive"
        disabled={status.busy}
        onClick={async () => {
          if (!armed) return setArmed(true)
          setArmed(false)
          await run('/reset', undefined, 'Chain reset')
        }}
      >
        {armed ? 'Click again to confirm reset' : 'Reset chain'}
      </Button>
      <Result status={status} />
    </Section>
  )
}

export function AdminPanel() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin (local only)</h1>
        <p className="text-muted-foreground text-sm">
          Test controls for anvil, served by apps/server. This page does not exist on other chains.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <OraclePrice />
        <Faucet />
        <TimeTravel />
        <Reset />
      </div>
      <ActivityFeed limit={30} />
    </div>
  )
}
