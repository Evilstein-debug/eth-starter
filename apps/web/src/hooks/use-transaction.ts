'use client'

import { useCallback, useState } from 'react'
import {
  BaseError,
  UserRejectedRequestError,
  type Abi,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import { useConfig } from 'wagmi'
import {
  getAccount,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  type SimulateContractParameters,
} from 'wagmi/actions'
import type { Config } from 'wagmi'

export type TxState =
  | { status: 'idle' }
  | { status: 'simulating' }
  | { status: 'signing' }
  | { status: 'pending'; hash: Hash; chainId: number }
  | { status: 'confirmed'; hash: Hash; chainId: number; receipt: TransactionReceipt }
  | { status: 'failed'; error: string; hash?: Hash; chainId?: number }

type WriteFunctionName<abi extends Abi> = ContractFunctionName<abi, 'nonpayable' | 'payable'>

/** Human-readable error: contract revert reason, wallet rejection, or viem's short message. */
export function describeError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) return 'Rejected in wallet'
    return error.shortMessage
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Send a contract write the safe way: simulate first (surfaces revert reasons before the
 * wallet prompt), then sign, then wait for the receipt. Exposes the state for <TxStatus />.
 */
export function useTransaction() {
  const config = useConfig()
  const [state, setState] = useState<TxState>({ status: 'idle' })

  const send = useCallback(
    async <
      const abi extends Abi,
      functionName extends WriteFunctionName<abi>,
      args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>,
    >(
      params: SimulateContractParameters<abi, functionName, args, Config>,
    ): Promise<TransactionReceipt | undefined> => {
      const { address: account, chainId } = getAccount(config)
      if (!account || !chainId) {
        setState({ status: 'failed', error: 'Connect a wallet first' })
        return
      }
      let hash: Hash | undefined
      try {
        setState({ status: 'simulating' })
        const { request } = await simulateContract(config, {
          ...(params as SimulateContractParameters),
          account,
        })
        setState({ status: 'signing' })
        hash = await writeContract(config, request)
        setState({ status: 'pending', hash, chainId })
        const receipt = await waitForTransactionReceipt(config, { hash, chainId })
        if (receipt.status === 'reverted') throw new Error('Transaction reverted onchain')
        setState({ status: 'confirmed', hash, chainId, receipt })
        return receipt
      } catch (error) {
        setState({ status: 'failed', error: describeError(error), hash, chainId })
      }
    },
    [config],
  )

  const reset = useCallback(() => setState({ status: 'idle' }), [])
  const isBusy = ['simulating', 'signing', 'pending'].includes(state.status)

  return { state, send, reset, isBusy }
}
