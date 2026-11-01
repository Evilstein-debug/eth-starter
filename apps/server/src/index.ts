import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chain, publicClient, rpcUrl } from './chain'
import { env } from './env'
import { listFeed, startFeed } from './feed'

// Put anything here that shouldn't run in the browser (secrets, indexing, webhooks, ...).
const app = new Hono()
app.use('*', cors({ origin: env.corsOrigins }))

app.get('/health', async (c) => {
  const blockNumber = await publicClient.getBlockNumber()
  return c.json({ ok: true, chainId: chain.id, blockNumber: blockNumber.toString() })
})

app.get('/api/feed', (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  return c.json({ entries: listFeed(limit) })
})

startFeed()
serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(
    `[server] http://localhost:${info.port} · chain ${chain.id} (${chain.name}) · rpc ${rpcUrl}`,
  )
})
