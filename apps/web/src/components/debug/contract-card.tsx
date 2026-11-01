'use client'

import { useEffect, useState } from 'react'
import { parseEther, type Abi, type AbiFunction, type Address } from 'viem'
import { useConfig } from 'wagmi'
import { readContract } from 'wagmi/actions'
import { TxStatus } from '@/components/tx-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { describeError, useTransaction } from '@/hooks/use-transaction'
import { formatAbiResult, parseAbiArg } from '@/lib/abi-args'
import { targetChain } from '@/lib/env'

export function ContractCard({
  name,
  abi,
  address,
  explorerUrl,
}: {
  name: string
  abi: Abi
  address: Address
  explorerUrl?: string
}) {
  const fns = abi.filter((item): item is AbiFunction => item.type === 'function')
  const reads = fns.filter((f) => f.stateMutability === 'view' || f.stateMutability === 'pure')
  const writes = fns.filter((f) => !reads.includes(f))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {name}
          <code className="text-muted-foreground text-xs font-normal break-all">
            {explorerUrl ? (
              <a href={explorerUrl} target="_blank" rel="noreferrer" className="underline">
                {address}
              </a>
            ) : (
              address
            )}
          </code>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Read</h3>
          {reads.map((fn) => (
            <FunctionForm key={signature(fn)} fn={fn} abi={abi} address={address} />
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Write</h3>
          {writes.map((fn) => (
            <FunctionForm key={signature(fn)} fn={fn} abi={abi} address={address} />
          ))}
        </section>
      </CardContent>
    </Card>
  )
}

function signature(fn: AbiFunction) {
  return `${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`
}

function FunctionForm({ fn, abi, address }: { fn: AbiFunction; abi: Abi; address: Address }) {
  const config = useConfig()
  const isRead = fn.stateMutability === 'view' || fn.stateMutability === 'pure'
  const [values, setValues] = useState<string[]>(() => fn.inputs.map(() => ''))
  const [ethValue, setEthValue] = useState('')
  const [result, setResult] = useState<string>()
  const { state, send, isBusy } = useTransaction()

  async function run() {
    setResult(undefined)
    let args: unknown[]
    try {
      args = fn.inputs.map((input, i) => parseAbiArg(input, values[i] ?? ''))
    } catch (error) {
      setResult(`Bad input: ${describeError(error)}`)
      return
    }
    if (isRead) {
      try {
        const value = await readContract(config, {
          address,
          abi,
          functionName: fn.name,
          args,
          chainId: targetChain.id,
        })
        setResult(formatAbiResult(value))
      } catch (error) {
        setResult(`Error: ${describeError(error)}`)
      }
    } else {
      await send({
        address,
        abi,
        functionName: fn.name,
        args,
        ...(fn.stateMutability === 'payable' && ethValue ? { value: parseEther(ethValue) } : {}),
      })
    }
  }

  // Zero-argument reads load automatically.
  useEffect(() => {
    if (isRead && fn.inputs.length === 0) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <code className="text-sm font-medium">{fn.name}</code>
        {fn.stateMutability === 'payable' && <Badge variant="secondary">payable</Badge>}
      </div>
      {fn.inputs.map((input, i) => (
        <Input
          key={i}
          placeholder={`${input.name || `arg${i}`} (${input.type})`}
          value={values[i]}
          onChange={(e) => setValues((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
        />
      ))}
      {fn.stateMutability === 'payable' && (
        <Input
          placeholder="value (ETH)"
          value={ethValue}
          onChange={(e) => setEthValue(e.target.value)}
        />
      )}
      <Button size="sm" variant={isRead ? 'secondary' : 'default'} disabled={isBusy} onClick={run}>
        {isRead ? 'Read' : 'Send'}
      </Button>
      {result !== undefined && (
        <pre className="bg-muted overflow-x-auto rounded p-2 text-xs whitespace-pre-wrap">
          {result}
        </pre>
      )}
      {!isRead && <TxStatus state={state} />}
    </div>
  )
}
