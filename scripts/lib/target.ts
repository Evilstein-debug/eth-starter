/**
 * Which chain the scripts talk to, plus clients and demo wallets for it.
 * Configured from the root .env (see .env.example). Defaults to local anvil.
 */
import { getChain, isLocalChain, parseChainId, resolveRpcUrl } from '@starter/shared/chains'
import { findDeployedAddress } from '@starter/shared/contracts'
import {
  createPublicClient,
  createWalletClient,
  http,
  isHex,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvilAccount } from './local'

export const chainId = parseChainId(process.env.CHAIN_ID)
export const chain = getChain(chainId)
export const isLocal = isLocalChain(chainId)
export const rpcUrl = resolveRpcUrl(chain, process.env.RPC_URL)
export const serverUrl = process.env.SERVER_URL || 'http://localhost:8787'

// Local anvil mines instantly, so poll receipts fast; public chains keep viem's default.
const pollingInterval = isLocal ? 200 : undefined

export const publicClient: PublicClient<Transport, Chain> = createPublicClient({
  chain,
  transport: http(rpcUrl),
  pollingInterval,
})

export type Wallet = WalletClient<Transport, Chain, Account>

export function walletFor(account: Account): Wallet {
  return createWalletClient({ account, chain, transport: http(rpcUrl), pollingInterval })
}

export const DEMO_WALLETS = [
  { name: 'alice', envVar: 'DEMO_ALICE_PRIVATE_KEY', anvilIndex: 1 },
  { name: 'bob', envVar: 'DEMO_BOB_PRIVATE_KEY', anvilIndex: 2 },
  { name: 'carol', envVar: 'DEMO_CAROL_PRIVATE_KEY', anvilIndex: 3 },
] as const

export type DemoName = (typeof DEMO_WALLETS)[number]['name']

/**
 * Demo wallet by name. Uses the key from env if set. On local anvil it falls back to anvil's
 * public dev accounts #1-#3; on any other chain a missing key is an error.
 */
export function demoWallet(name: DemoName): Wallet {
  const spec = DEMO_WALLETS.find((w) => w.name === name)!
  const key = process.env[spec.envVar]
  if (key) {
    if (!isHex(key) || key.length !== 66)
      throw new Error(`${spec.envVar} must be a 0x-prefixed 32-byte hex key`)
    return walletFor(privateKeyToAccount(key as Hex))
  }
  if (isLocal) return walletFor(anvilAccount(spec.anvilIndex).account)
  throw new Error(
    `${spec.envVar} is not set. On ${chain.name} the demo wallets need throwaway testnet keys in the root .env ` +
      '(generate with `cast wallet new`). Never use a key that holds real funds.',
  )
}

export function requireAddress(name: string): Address {
  const address = findDeployedAddress(name, chainId)
  if (!address) {
    throw new Error(
      `${name} has no address for chain ${chainId}. Deploy (pnpm deploy:${isLocal ? 'local' : 'sepolia'}) and run pnpm codegen.`,
    )
  }
  return address
}

/** True if every given address has bytecode (i.e. the deployment exists on this chain right now). */
export async function isDeployed(addresses: Address[]) {
  const codes = await Promise.all(addresses.map((address) => publicClient.getCode({ address })))
  return codes.every((code) => code !== undefined && code !== '0x')
}

export function step(label: string) {
  const start = Date.now()
  process.stdout.write(`• ${label}… `)
  return (detail = '') => console.log(`✓ ${detail ? `${detail} ` : ''}(${Date.now() - start}ms)`)
}
