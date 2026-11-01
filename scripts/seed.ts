/**
 * `pnpm seed`: fund and pre-approve the demo wallets (alice, bob, carol) so a live demo
 * never stalls on faucets or approvals. Safe to re-run: it only tops up what is missing.
 *
 * Local anvil: wallets get ETH via anvil_setBalance; keys default to anvil's public accounts.
 * Testnet: keys come from the root .env (throwaway keys only) and need faucet ETH for gas.
 * SEED_EXTRA_ADDRESSES (local only) also funds your own browser wallet(s).
 */
import { ensureAllowance, fromTokenUnits, getTokenInfo, toTokenUnits } from '@starter/shared/erc20'
import { mockErc20Abi } from '@starter/shared/generated'
import { addressSchema } from '@starter/shared/schemas'
import { createTestClient, formatEther, http, maxUint256, parseEther, type Address } from 'viem'
import {
  chain,
  demoWallet,
  DEMO_WALLETS,
  isDeployed,
  isLocal,
  publicClient,
  requireAddress,
  rpcUrl,
  step,
  type Wallet,
} from './lib/target'

const TOKEN_TARGET = process.env.SEED_TOKEN_AMOUNT || '10000'
const LOCAL_ETH = parseEther('100')
const MIN_TESTNET_ETH = parseEther('0.005')

const testClient = isLocal
  ? createTestClient({ mode: 'anvil', chain, transport: http(rpcUrl) })
  : undefined

async function topUpTokens(minter: Wallet, token: Address, to: Address, target: bigint) {
  const balance = await publicClient.readContract({
    address: token,
    abi: mockErc20Abi,
    functionName: 'balanceOf',
    args: [to],
  })
  if (balance >= target) return balance
  const { request } = await publicClient.simulateContract({
    address: token,
    abi: mockErc20Abi,
    functionName: 'mint',
    args: [to, target - balance],
    account: minter.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: await minter.writeContract(request) })
  return target
}

export async function seed() {
  const token = requireAddress('MockERC20')
  const escrow = requireAddress('SimpleEscrow')
  if (!(await isDeployed([token, escrow]))) {
    throw new Error(
      `Contracts are not deployed on ${chain.name} at the generated addresses. Deploy first.`,
    )
  }
  const info = await getTokenInfo(publicClient, token)
  const target = toTokenUnits(TOKEN_TARGET, info)
  console.log(
    `Seeding demo wallets on ${chain.name} (${chain.id}) with ${TOKEN_TARGET} ${info.symbol} each`,
  )

  const rows: Record<string, string>[] = []
  for (const { name } of DEMO_WALLETS) {
    const wallet = demoWallet(name)
    const address = wallet.account.address
    const done = step(name)

    let eth = await publicClient.getBalance({ address })
    if (testClient && eth < LOCAL_ETH) {
      await testClient.setBalance({ address, value: LOCAL_ETH })
      eth = LOCAL_ETH
    }
    if (!testClient && eth < MIN_TESTNET_ETH) {
      console.log(
        `needs gas: send ≥${formatEther(MIN_TESTNET_ETH)} ETH to ${address} from a faucet, then re-run`,
      )
      rows.push({ name, address, eth: formatEther(eth), tokens: '-', approved: '-' })
      continue
    }

    const tokens = await topUpTokens(wallet, token, address, target)
    // Pre-approve the escrow so the demo skips the approval step.
    await ensureAllowance(publicClient, wallet, token, escrow, maxUint256)
    done()
    rows.push({
      name,
      address,
      eth: formatEther(eth),
      tokens: fromTokenUnits(tokens, info),
      approved: 'yes',
    })
  }

  const extras = (process.env.SEED_EXTRA_ADDRESSES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (extras.length && !testClient)
    console.warn('SEED_EXTRA_ADDRESSES is only used on local anvil; skipping')
  if (extras.length && testClient) {
    const minter = demoWallet('alice')
    for (const raw of extras) {
      const address = addressSchema.parse(raw)
      const done = step(`extra ${address}`)
      await testClient.setBalance({ address, value: LOCAL_ETH })
      const tokens = await topUpTokens(minter, token, address, target)
      done()
      rows.push({
        name: 'extra',
        address,
        eth: formatEther(LOCAL_ETH),
        tokens: fromTokenUnits(tokens, info),
        approved: 'no',
      })
    }
  }
  console.table(rows)
}

// Run directly (`pnpm seed`), or import `seed` from another script.
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((error) => {
    console.error('\nSeed failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
