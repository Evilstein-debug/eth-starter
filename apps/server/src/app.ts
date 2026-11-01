import { isLocalChain } from '@starter/shared/chains'
import {
  verifySignatureRequestSchema,
  type ActivityResponse,
  type HealthResponse,
} from '@starter/shared/schemas'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { verifyMessage } from 'viem'
import { listActivity, logActivity } from './activity'
import { admin } from './admin'
import { chain, publicClient } from './chain'
import { env } from './env'

export const app = new Hono()

app.use('*', requestId())
app.use('*', cors({ origin: env.CORS_ORIGIN }))

// Log mutating API requests to the activity feed (reads and polling are too noisy).
app.use('/api/*', async (c, next) => {
  await next()
  if (c.req.method !== 'GET') {
    logActivity({
      kind: 'request',
      message: `${c.req.method} ${c.req.path} → ${c.res.status}`,
      requestId: c.get('requestId'),
    })
  }
})

app.get('/health', async (c) => {
  const blockNumber = await publicClient.getBlockNumber()
  return c.json({
    ok: true,
    chainId: chain.id,
    blockNumber: blockNumber.toString(),
  } satisfies HealthResponse)
})

// Example of logic that belongs on a server: verify that a request really comes from a wallet.
app.post('/api/verify-signature', async (c) => {
  const parsed = verifySignatureRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)

  const { address, message, signature } = parsed.data
  const valid = await verifyMessage({ address, message, signature: signature as `0x${string}` })
  return c.json({ valid, address, requestId: c.get('requestId') })
})

app.get('/api/activity', (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  return c.json({ entries: listActivity(limit) } satisfies ActivityResponse)
})

// Local-only test controls. On any other chain these routes do not exist.
if (isLocalChain(chain.id)) app.route('/admin', admin)

app.onError((err, c) => {
  const status = (err as { status?: number }).status
  if (status === 400) return c.json({ error: err.message, requestId: c.get('requestId') }, 400)
  console.error(`[server] ${c.req.method} ${c.req.path} failed:`, err)
  return c.json({ error: 'Internal error', requestId: c.get('requestId') }, 500)
})
