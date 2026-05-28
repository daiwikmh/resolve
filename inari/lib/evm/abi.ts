export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

export const VALIDATOR_REGISTRY_ABI = [
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "priceUsd", type: "uint256" }, { name: "updatedAt", type: "uint48" }],
  },
  {
    type: "function",
    name: "isAlertActive",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "alertThreshold",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "alertActiveUntil",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "PriceUpdated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "priceUsd", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint48", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PriceAlertTriggered",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "threshold", type: "uint256", indexed: false },
      { name: "until", type: "uint256", indexed: false },
    ],
  },
] as const;

export const RWA_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "rwaToken", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "mintAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "rwaToken", type: "address" },
      { name: "dobRwaAmount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "rwaAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "approvedAssets",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "inariRwa",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

export const SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "zeroForOne", type: "bool" },
      { name: "amountIn", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "poolKeySet",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;
