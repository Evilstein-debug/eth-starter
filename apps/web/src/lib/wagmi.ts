import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { SUPPORTED_CHAINS } from '@starter/shared/chains'
import type { Chain, Transport } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { targetChain, targetRpcUrl, walletConnectProjectId } from './env'

// The active chain goes first so it is the default; the rest stay switchable.
const chains = [targetChain, ...SUPPORTED_CHAINS.filter((c) => c.id !== targetChain.id)] as [
  Chain,
  ...Chain[],
]

const transports: Record<number, Transport> = Object.fromEntries(
  chains.map((c) => [c.id, http(c.id === targetChain.id ? targetRpcUrl : undefined)]),
)

function makeConfig() {
  if (walletConnectProjectId) {
    return getDefaultConfig({
      appName: 'eth-starter',
      projectId: walletConnectProjectId,
      chains,
      transports,
      ssr: true,
    })
  }
  if (typeof window !== 'undefined') {
    console.info(
      '[wallet] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set: only browser (injected) wallets ' +
        'are available. Get a free project ID at https://dashboard.reown.com to enable WalletConnect.',
    )
  }
  // Browser wallets announced via EIP-6963 are discovered automatically; injected() is the fallback.
  return createConfig({ chains, transports, connectors: [injected()], ssr: true })
}

export const wagmiConfig = makeConfig()
