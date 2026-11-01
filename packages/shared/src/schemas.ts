/** Zod schemas shared by web and server (API payloads, primitives). */
import { getAddress, isAddress, isHex } from 'viem'
import { z } from 'zod'

export const addressSchema = z
  .string()
  .refine((v) => isAddress(v), 'Invalid address')
  .transform((v) => getAddress(v))

export const hexSchema = z.string().refine((v) => isHex(v), 'Expected 0x-prefixed hex')

export const txHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid transaction hash')
  .transform((v) => v as `0x${string}`)

/** Integer amounts travel as decimal strings in JSON (bigint is not JSON-safe). */
export const bigintStringSchema = z
  .string()
  .regex(/^\d+$/, 'Expected a non-negative integer string')
  .transform((v) => BigInt(v))

/** POST /api/verify-signature: prove wallet ownership to the server (EIP-191). */
export const verifySignatureRequestSchema = z.object({
  address: addressSchema,
  message: z.string().min(1).max(2000),
  signature: hexSchema,
})
export type VerifySignatureRequest = z.input<typeof verifySignatureRequestSchema>

export const verifySignatureResponseSchema = z.object({
  valid: z.boolean(),
  address: addressSchema,
  requestId: z.string(),
})
export type VerifySignatureResponse = z.infer<typeof verifySignatureResponseSchema>

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  chainId: z.number(),
  blockNumber: z.string(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>

/** Activity feed: human-readable server log of chain events and API requests. */
export const activityEntrySchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  kind: z.enum(['chain', 'request', 'admin']),
  message: z.string(),
  txHash: z.string().optional(),
  requestId: z.string().optional(),
  blockNumber: z.string().optional(),
})
export type ActivityEntry = z.infer<typeof activityEntrySchema>

export const activityResponseSchema = z.object({ entries: z.array(activityEntrySchema) })
export type ActivityResponse = z.infer<typeof activityResponseSchema>

/** A decimal amount typed by a human, e.g. "12.5". Converted with the token's decimals. */
export const decimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Expected a decimal number')

// Admin endpoints (local anvil only).
export const adminOraclePriceSchema = z.object({ price: decimalStringSchema })
export const adminMintSchema = z.object({ to: addressSchema, amount: decimalStringSchema })
export const adminFundEthSchema = z.object({ to: addressSchema, eth: decimalStringSchema })
export const adminTimeTravelSchema = z.object({
  seconds: z
    .number()
    .int()
    .positive()
    .max(10 * 365 * 24 * 3600),
})
