/**
 * Local-only admin endpoints (mounted only when CHAIN_ID=31337): set the mock oracle price,
 * mint test tokens, give ETH, fast-forward time, reset state. They use anvil's test RPC
 * methods and account impersonation, so no private keys are involved.
 */
import { findDeployedAddress } from '@starter/shared/contracts'
import { mockErc20Abi, mockOracleAbi } from '@starter/shared/generated'
import {
  adminFundEthSchema,
  adminMintSchema,
  adminOraclePriceSchema,
  adminTimeTravelSchema,
} from '@starter/shared/schemas'
import { Hono, type Context } from 'hono'
import {
  createTestClient,
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  type Address,
  type Hash,
} from 'viem'
import { z } from 'zod'
import { clearActivity, logActivity } from './activity'
import { chain, publicClient, rpcUrl } from './chain'
import { env } from './env'
import { resetWatcher } from './watcher'

const testClient = createTestClient({ mode: 'anvil', chain, transport: http(rpcUrl) })
const walletClient = createWalletClient({ chain, transport: http(rpcUrl) })

// Baseline for "reset". `pnpm dev` passes the snapshot it took right after deploy + seed;
// otherwise we take one when the server starts.
let snapshotId: `0x${string}` | undefined = env.ANVIL_SNAPSHOT_ID as `0x${string}` | undefined

export async function initAdmin() {
  snapshotId ??= await testClient.snapshot()
  console.log(`[admin] local admin enabled · reset snapshot ${snapshotId}`)
}

function required(name: string): Address {
  const address = findDeployedAddress(name, chain.id)
  if (!address) throw new Error(`${name} is not deployed on chain ${chain.id}`)
  return address
}

/** Send a tx as `from` without its key (anvil impersonation), wait for it, return the hash. */
async function sendAs(from: Address, write: (account: Address) => Promise<Hash>) {
  await testClient.impersonateAccount({ address: from })
  try {
    if ((await publicClient.getBalance({ address: from })) < parseEther('1')) {
      await testClient.setBalance({ address: from, value: parseEther('10') })
    }
    const hash = await write(from)
    await publicClient.waitForTransactionReceipt({ hash })
    return hash
  } finally {
    await testClient.stopImpersonatingAccount({ address: from })
  }
}

async function parse<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  const result = schema.safeParse(await c.req.json().catch(() => null))
  if (!result.success)
    throw Object.assign(new Error(z.prettifyError(result.error)), { status: 400 })
  return result.data
}

export const admin = new Hono()

admin.post('/oracle-price', async (c) => {
  const { price } = await parse(c, adminOraclePriceSchema)
  const oracle = required('MockOracle')
  const [owner, decimals] = await Promise.all([
    publicClient.readContract({ address: oracle, abi: mockOracleAbi, functionName: 'owner' }),
    publicClient.readContract({ address: oracle, abi: mockOracleAbi, functionName: 'decimals' }),
  ])
  const hash = await sendAs(owner, (account) =>
    walletClient.writeContract({
      account,
      address: oracle,
      abi: mockOracleAbi,
      functionName: 'setPrice',
      args: [parseUnits(price, decimals)],
    }),
  )
  logActivity({ kind: 'admin', message: `Oracle price set to ${price}`, txHash: hash })
  return c.json({ txHash: hash })
})

admin.post('/mint', async (c) => {
  const { to, amount } = await parse(c, adminMintSchema)
  const token = required('MockERC20')
  const decimals = await publicClient.readContract({
    address: token,
    abi: mockErc20Abi,
    functionName: 'decimals',
  })
  const hash = await sendAs(to, (account) =>
    walletClient.writeContract({
      account,
      address: token,
      abi: mockErc20Abi,
      functionName: 'mint',
      args: [to, parseUnits(amount, decimals)],
    }),
  )
  logActivity({ kind: 'admin', message: `Minted ${amount} test tokens to ${to}`, txHash: hash })
  return c.json({ txHash: hash })
})

admin.post('/fund-eth', async (c) => {
  const { to, eth } = await parse(c, adminFundEthSchema)
  await testClient.setBalance({ address: to, value: parseEther(eth) })
  logActivity({ kind: 'admin', message: `Set ETH balance of ${to} to ${eth}` })
  return c.json({ ok: true })
})

admin.post('/time-travel', async (c) => {
  const { seconds } = await parse(c, adminTimeTravelSchema)
  await testClient.increaseTime({ seconds })
  await testClient.mine({ blocks: 1 })
  const block = await publicClient.getBlock()
  const now = new Date(Number(block.timestamp) * 1000).toISOString()
  logActivity({ kind: 'admin', message: `Fast-forwarded ${seconds}s · chain time ${now}` })
  return c.json({ timestamp: block.timestamp.toString() })
})

admin.post('/reset', async (c) => {
  if (!snapshotId) return c.json({ error: 'No snapshot to revert to' }, 409)
  await testClient.revert({ id: snapshotId })
  snapshotId = await testClient.snapshot() // a snapshot is consumed by revert; take a fresh one
  resetWatcher()
  clearActivity()
  logActivity({ kind: 'admin', message: 'Chain reset to the post-deploy snapshot' })
  return c.json({ ok: true })
})
