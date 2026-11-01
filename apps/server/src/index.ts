import { serve } from '@hono/node-server'
import { app } from './app'
import { chain, rpcUrl } from './chain'
import { env } from './env'

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `[server] http://localhost:${info.port} · chain ${chain.id} (${chain.name}) · rpc ${rpcUrl}`,
  )
})
