import { verifySignatureRequestSchema, type HealthResponse } from '@starter/shared/schemas'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { verifyMessage } from 'viem'
import { chain, publicClient } from './chain'
import { env } from './env'

export const app = new Hono()

app.use('*', requestId())
app.use('*', cors({ origin: env.CORS_ORIGIN }))

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

app.onError((err, c) => {
  console.error(`[server] ${c.req.method} ${c.req.path} failed:`, err)
  return c.json({ error: 'Internal error', requestId: c.get('requestId') }, 500)
})
