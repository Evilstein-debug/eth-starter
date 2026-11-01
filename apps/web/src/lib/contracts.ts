import { findDeployedAddress } from '@starter/shared/contracts'
import { targetChainId } from './env'

// Addresses on the active chain; undefined until you deploy there and run `pnpm codegen`.
export const addresses = {
  token: findDeployedAddress('MockERC20', targetChainId),
  oracle: findDeployedAddress('MockOracle', targetChainId),
  escrow: findDeployedAddress('SimpleEscrow', targetChainId),
}
