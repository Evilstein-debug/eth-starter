import { getChain, isLocalChain, resolveRpcUrl } from '@starter/shared/chains'
import { createPublicClient, http } from 'viem'
import { env } from './env'

export const chain = getChain(env.CHAIN_ID)
export const rpcUrl = resolveRpcUrl(chain, env.RPC_URL)
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
  pollingInterval: isLocalChain(chain.id) ? 200 : undefined,
})
