/**
 * Stablecoin / ERC-20 helpers on plain viem clients, usable from scripts, the server, or the
 * browser (pass wagmi's wallet client). Amounts are always converted with the token's own
 * decimals: USDC-style tokens use 6, most others 18.
 */
import {
  erc20Abi,
  formatUnits,
  parseAbi,
  parseSignature,
  parseUnits,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem'

type Reader = PublicClient<Transport, Chain>
type Signer = WalletClient<Transport, Chain, Account>

// EIP-2612 permit + EIP-5267 domain discovery (OpenZeppelin ERC20Permit implements both).
export const erc20PermitAbi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
])

export type TokenInfo = { address: Address; name: string; symbol: string; decimals: number }

export async function getTokenInfo(client: Reader, token: Address): Promise<TokenInfo> {
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'name' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
  ])
  return { address: token, name, symbol, decimals }
}

/** "12.5" → 12_500_000n for a 6-decimal token. */
export function toTokenUnits(amount: string, token: Pick<TokenInfo, 'decimals'>): bigint {
  return parseUnits(amount, token.decimals)
}

/** 12_500_000n → "12.5" for a 6-decimal token. */
export function fromTokenUnits(amount: bigint, token: Pick<TokenInfo, 'decimals'>): string {
  return formatUnits(amount, token.decimals)
}

export async function getTokenBalance(client: Reader, token: Address, owner: Address) {
  const [info, raw] = await Promise.all([
    getTokenInfo(client, token),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    }),
  ])
  return { raw, formatted: fromTokenUnits(raw, info), token: info }
}

export async function getAllowance(
  client: Reader,
  token: Address,
  owner: Address,
  spender: Address,
) {
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  })
}

/** Simulate, send and wait. Throws with the revert reason if the call would fail. */
async function write(
  client: Reader,
  wallet: Signer,
  token: Address,
  functionName: 'approve' | 'transfer',
  args: readonly [Address, bigint],
) {
  const { request } = await client.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName,
    args,
    account: wallet.account,
  })
  const hash = await wallet.writeContract(request)
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted (${hash})`)
  return receipt
}

export function approveToken(
  client: Reader,
  wallet: Signer,
  token: Address,
  spender: Address,
  amount: bigint,
) {
  return write(client, wallet, token, 'approve', [spender, amount])
}

export function transferToken(
  client: Reader,
  wallet: Signer,
  token: Address,
  to: Address,
  amount: bigint,
) {
  return write(client, wallet, token, 'transfer', [to, amount])
}

/** Approve only if the current allowance is too low. Returns the receipt, or undefined if skipped. */
export async function ensureAllowance(
  client: Reader,
  wallet: Signer,
  token: Address,
  spender: Address,
  amount: bigint,
) {
  const current = await getAllowance(client, token, wallet.account.address, spender)
  if (current >= amount) return undefined
  return approveToken(client, wallet, token, spender, amount)
}

export type PermitSignature = {
  owner: Address
  spender: Address
  value: bigint
  deadline: bigint
  v: number
  r: Hex
  s: Hex
  signature: Hex
}

/**
 * Sign an EIP-2612 permit (gasless approval). Anyone can then submit it with `token.permit(...)`
 * or a contract can consume it in the same tx as the transfer.
 * The EIP-712 domain is read from the token (EIP-5267) so name/version are never guessed.
 */
export async function signPermit(
  client: Reader,
  wallet: Signer,
  {
    token,
    spender,
    value,
    deadline,
  }: { token: Address; spender: Address; value: bigint; deadline: bigint },
): Promise<PermitSignature> {
  const owner = wallet.account.address
  const [domain, nonce] = await Promise.all([
    client.readContract({ address: token, abi: erc20PermitAbi, functionName: 'eip712Domain' }),
    client.readContract({
      address: token,
      abi: erc20PermitAbi,
      functionName: 'nonces',
      args: [owner],
    }),
  ])
  const [, name, version, chainId, verifyingContract] = domain

  const signature = await wallet.signTypedData({
    account: wallet.account,
    domain: { name, version, chainId: Number(chainId), verifyingContract },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: { owner, spender, value, nonce, deadline },
  })
  const { v, r, s, yParity } = parseSignature(signature)
  return { owner, spender, value, deadline, v: Number(v ?? BigInt(yParity + 27)), r, s, signature }
}

/** Submit a signed permit onchain (from any account that pays gas). */
export async function submitPermit(
  client: Reader,
  wallet: Signer,
  token: Address,
  permit: PermitSignature,
) {
  const { request } = await client.simulateContract({
    address: token,
    abi: erc20PermitAbi,
    functionName: 'permit',
    args: [
      permit.owner,
      permit.spender,
      permit.value,
      permit.deadline,
      permit.v,
      permit.r,
      permit.s,
    ],
    account: wallet.account,
  })
  const hash = await wallet.writeContract(request)
  return client.waitForTransactionReceipt({ hash })
}
