/** Uniswap v4 protocol on X Layer mainnet (chain ID 196). */
export const POOL_MANAGER = "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32" as const;
export const POSITION_MANAGER = "0xcF1EAFC6928dC385A342E7C6491d371d2871458b" as const;
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

/**
 * Inari contracts — deployed by `forge script script/DeployXLayer.s.sol --broadcast`.
 * Fill in after deployment.
 */
export const VALIDATOR_REGISTRY = "0x0000000000000000000000000000000000000000" as const;
export const RWA_VAULT = "0x0000000000000000000000000000000000000000" as const;
export const LP_REGISTRY = "0x0000000000000000000000000000000000000000" as const;
export const SWAP_ROUTER = "0x0000000000000000000000000000000000000000" as const;
export const INARI_HOOK = "0x0000000000000000000000000000000000000000" as const;
export const MOCK_USDC = "0x0000000000000000000000000000000000000000" as const;
export const DCT_TOKEN = "0x0000000000000000000000000000000000000000" as const;

export const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;
export const isDeployed = (addr: string): boolean => addr !== ZERO_ADDR;
