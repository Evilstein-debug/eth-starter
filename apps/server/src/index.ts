import { serve } from '@hono/node-server'
import { isLocalChain } from '@starter/shared/chains'
import { initAdmin } from './admin'
import { app } from './app'
import { chain, rpcUrl } from './chain'
import { env } from './env'
import { startWatcher } from './watcher'

if (isLocalChain(chain.id)) await initAdmin()
startWatcher()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `[server] http://localhost:${info.port} · chain ${chain.id} (${chain.name}) · rpc ${rpcUrl}`,
  )
})
