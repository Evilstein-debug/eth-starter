/**
 * `pnpm e2e:happy`: the source of truth that the stack works, before touching UI.
 * Runs the full path the way the web app does (simulate → send → wait for receipt):
 *   deploy → mint → approve → escrow.create → server calls → verify state → release → permit
 *
 * Local (default): starts anvil, deploys and starts the server if they are not already running.
 * Testnet: set CHAIN_ID/RPC_URL/SERVER_URL and DEMO_ALICE/BOB keys in the root .env, deploy
 * first, and run the server against the same chain.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import {
  signPermit,
  submitPermit,
  ensureAllowance,
  getTokenInfo,
  toTokenUnits,
  getAllowance,
} from '@starter/shared/erc20'
import { mockErc20Abi, simpleEscrowAbi } from '@starter/shared/generated'
import {
  activityResponseSchema,
  healthResponseSchema,
  verifySignatureResponseSchema,
} from '@starter/shared/schemas'
import { parseEventLogs, type Address, type Hash, type Log } from 'viem'
import { deployLocal, ensureAnvil, LOCAL_RPC_URL, ROOT, waitFor } from './lib/local'
import {
  chain,
  demoWallet,
  isDeployed,
  isLocal,
  publicClient,
  requireAddress,
  serverUrl,
  step,
  type Wallet,
} from './lib/target'

const started: ChildProcess[] = []
const AMOUNT = '25'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

async function health() {
  try {
    const res = await fetch(`${serverUrl}/health`)
    return healthResponseSchema.parse(await res.json())
  } catch {
    return undefined
  }
}

/** Same sequence as the web app's useTransaction hook. */
async function send(
  wallet: Wallet,
  request: Parameters<typeof publicClient.simulateContract>[0],
): Promise<{ hash: Hash; logs: Log[] }> {
  const { request: simulated } = await publicClient.simulateContract({
    ...request,
    account: wallet.account,
  })
  const hash = await wallet.writeContract(simulated as Parameters<Wallet['writeContract']>[0])
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  assert(receipt.status === 'success', `tx ${hash} reverted`)
  return { hash, logs: receipt.logs }
}

async function setup() {
  console.log(`e2e:happy on ${chain.name} (${chain.id}) · server ${serverUrl}\n`)
  if (isLocal) {
    let done = step('anvil')
    const anvil = await ensureAnvil()
    if (anvil) started.push(anvil)
    done()

    const contracts = [requireAddress('MockERC20'), requireAddress('SimpleEscrow')]
    if (!(await isDeployed(contracts))) {
      done = step('deploy (fresh chain)')
      await deployLocal()
      done()
    }

    if (!(await health())) {
      done = step('start server')
      const server = spawn('pnpm', ['--filter', '@starter/server', 'start'], {
        cwd: ROOT,
        env: { ...process.env, CHAIN_ID: '31337', RPC_URL: LOCAL_RPC_URL },
        stdio: 'ignore',
      })
      started.push(server)
      await waitFor(async () => Boolean(await health()), 'server', 30_000)
      done()
    }
  }

  const status = await health()
  assert(status, `server not reachable at ${serverUrl}`)
  assert(status.chainId === chain.id, `server is on chain ${status.chainId}, expected ${chain.id}`)
}

async function run() {
  await setup()
  const token = requireAddress('MockERC20')
  const escrow = requireAddress('SimpleEscrow')
  assert(await isDeployed([token, escrow]), 'contracts are not deployed at the generated addresses')

  const alice = demoWallet('alice')
  const bob = demoWallet('bob')
  const info = await getTokenInfo(publicClient, token)
  const amount = toTokenUnits(AMOUNT, info)
  const balanceOf = (who: Address) =>
    publicClient.readContract({
      address: token,
      abi: mockErc20Abi,
      functionName: 'balanceOf',
      args: [who],
    })

  let done = step(`mint ${AMOUNT} ${info.symbol} to alice`)
  const aliceBefore = await balanceOf(alice.account.address)
  await send(alice, {
    address: token,
    abi: mockErc20Abi,
    functionName: 'mint',
    args: [alice.account.address, amount],
  })
  assert(
    (await balanceOf(alice.account.address)) === aliceBefore + amount,
    'alice balance after mint',
  )
  done()

  // Like the UI's ApproveGate: approve only when the allowance is too low.
  done = step('approve escrow')
  const approval = await ensureAllowance(publicClient, alice, token, escrow, amount)
  assert(
    (await getAllowance(publicClient, token, alice.account.address, escrow)) >= amount,
    'allowance',
  )
  done(approval ? '' : '(already approved)')

  done = step('escrow.create (alice → bob)')
  const escrowBefore = await balanceOf(escrow)
  const deadline = (await publicClient.getBlock()).timestamp + 3600n
  const created = await send(alice, {
    address: escrow,
    abi: simpleEscrowAbi,
    functionName: 'create',
    args: [bob.account.address, amount, deadline],
  })
  const [event] = parseEventLogs({
    abi: simpleEscrowAbi,
    eventName: 'DealCreated',
    logs: created.logs,
  })
  assert(event, 'DealCreated event emitted')
  const dealId = event.args.id
  done(`deal #${dealId} ${created.hash}`)

  done = step('server: verify wallet signature')
  const message = `e2e:happy ${Date.now()}`
  const signature = await alice.signMessage({ message })
  const res = await fetch(`${serverUrl}/api/verify-signature`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: alice.account.address, message, signature }),
  })
  const verified = verifySignatureResponseSchema.parse(await res.json())
  assert(verified.valid, 'server accepted the signature')
  done(`request ${verified.requestId}`)

  done = step('server: activity feed saw DealCreated')
  await waitFor(
    async () => {
      const feed = activityResponseSchema.parse(
        await (await fetch(`${serverUrl}/api/activity?limit=200`)).json(),
      )
      return feed.entries.some(
        (e) => e.txHash === created.hash && e.message.includes('DealCreated'),
      )
    },
    'DealCreated in activity feed',
    20_000,
  )
  done()

  done = step('verify onchain state')
  const [payer, payee, locked, , status] = await publicClient.readContract({
    address: escrow,
    abi: simpleEscrowAbi,
    functionName: 'deals',
    args: [dealId],
  })
  assert(payer === alice.account.address && payee === bob.account.address, 'deal parties')
  assert(locked === amount && status === 1, 'deal amount and Open status')
  assert((await balanceOf(escrow)) === escrowBefore + amount, 'escrow holds the tokens')
  done()

  done = step('escrow.release → bob')
  const bobBefore = await balanceOf(bob.account.address)
  await send(alice, {
    address: escrow,
    abi: simpleEscrowAbi,
    functionName: 'release',
    args: [dealId],
  })
  assert((await balanceOf(bob.account.address)) === bobBefore + amount, 'bob received the tokens')
  done()

  done = step('EIP-2612 permit (alice signs, bob submits)')
  const permitValue = toTokenUnits('1', info)
  const permit = await signPermit(publicClient, alice, {
    token,
    spender: bob.account.address,
    value: permitValue,
    deadline: deadline + 3600n,
  })
  await submitPermit(publicClient, bob, token, permit)
  assert(
    (await getAllowance(publicClient, token, alice.account.address, bob.account.address)) ===
      permitValue,
    'permit allowance',
  )
  done()

  console.log('\n✅ e2e:happy passed')
}

function cleanup() {
  for (const child of started) child.kill('SIGTERM')
}

run()
  .then(() => {
    cleanup()
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n\n❌ e2e:happy failed:', error instanceof Error ? error.message : error)
    cleanup()
    process.exit(1)
  })
