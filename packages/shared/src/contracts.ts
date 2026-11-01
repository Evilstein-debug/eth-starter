/**
 * Runtime view of the generated `contractRegistry`, so tools like the web Debug page can list
 * every contract without hand-maintained lists. For typed calls, import the specific
 * `xxxAbi` / `xxxAddress` exports from './generated' instead.
 */
import type { Abi, Address } from 'viem'
import { contractRegistry } from './generated'

export type ContractEntry = {
  /** Contract name as written in Solidity, e.g. "MockERC20". */
  name: string
  abi: Abi
  /** chainId → deployed address (empty if never deployed). */
  addresses: Partial<Record<number, Address>>
}

export const contracts: readonly ContractEntry[] = contractRegistry

export function deployedContracts(chainId: number) {
  return contracts.flatMap((c) => {
    const address = c.addresses[chainId]
    return address ? [{ ...c, address }] : []
  })
}

/** Address of `name` on `chainId`, or undefined if it is not deployed there. */
export function findDeployedAddress(name: string, chainId: number): Address | undefined {
  return contracts.find((c) => c.name === name)?.addresses[chainId]
}

export function getDeployedAddress(name: string, chainId: number): Address {
  const address = findDeployedAddress(name, chainId)
  if (!address) {
    throw new Error(
      `${name} is not deployed on chain ${chainId}. Run the deploy, then \`pnpm codegen\`.`,
    )
  }
  return address
}
