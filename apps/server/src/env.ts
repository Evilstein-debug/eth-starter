import { parseChainId } from '@starter/shared/chains'
import { z } from 'zod'

const schema = z.object({
  CHAIN_ID: z.string().optional().transform(parseChainId),
  RPC_URL: z
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Set by `pnpm dev`: anvil snapshot that /admin/reset reverts to. */
  ANVIL_SNAPSHOT_ID: z.string().optional(),
  PORT: z.coerce.number().int().default(8787),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim())),
})

export const env = schema.parse(process.env)
