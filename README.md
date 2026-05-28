# Inari

**Oracle-priced RWA DEX on X Layer · Uniswap v4 hook**

Inari intercepts every swap inside `beforeSwap`, reads a validator oracle price, and settles the trade at exactly that price — bypassing the AMM curve entirely. Zero slippage for tokenized real-world assets.

---

## How it works

```
User
 |
 |  swap(zeroForOne, amountIn, hookData)
 v
InariSwapRouter
 |
 |  poolManager.unlock(...)
 v
IPoolManager ──────────────────────────────────────────┐
                                                        │ beforeSwap()
                                                        v
                                              InariPegHook
                                                   |
                                   ┌───────────────┼────────────────┐
                                   v               v                v
                         isAlertActive?    getPrice(token)   LP fill check
                         (registry)        (registry)        (lpRegistry)
                                   |
                             alert? → revert OracleAlertActive
                             else  → amountOut = amountIn * 1e18 / priceUsd
                                     settle at oracle price
                                     return delta → AMM never executes
```

---

## Repository layout

```
Inari/
├── contracts/                     Foundry project
│   ├── src/
│   │   ├── InariPegHook.sol        Main hook (flags 0x2888)
│   │   ├── InariValidatorRegistry.sol  Oracle + alert system
│   │   ├── InariRwaVault.sol       Mint/burn dobRWA against collateral
│   │   ├── InariLPRegistry.sol     LP filler queue (liquidation fills)
│   │   ├── InariSwapRouter.sol     Minimal router for USDC <-> dobRWA
│   │   ├── InariTokenFactory.sol   Deploys new RWA tokens
│   │   └── RWAFaucet.sol           MockUSDC + MockRWA (demo tokens)
│   ├── script/
│   │   ├── DeployXLayer.s.sol      Production deploy to X Layer mainnet
│   │   └── Demo.s.sol              Full lifecycle demo (12 steps)
│   └── test/                       176 tests, all passing
├── inari/                          Next.js frontend
│   ├── app/
│   │   ├── page.tsx                Landing page
│   │   └── app/
│   │       ├── page.tsx            /app  → Swap panel
│   │       ├── status/page.tsx     /app/status → Oracle panel
│   │       ├── brakes/page.tsx     /app/brakes → Vault panel
│   │       └── docs/page.tsx       /app/docs   → Docs
│   ├── components/
│   │   ├── app/
│   │   │   ├── VestingBuilder.tsx  SwapPanel — USDC <-> DCT swap + chart
│   │   │   ├── StatusPanel.tsx     OraclePanel — live price + alert status
│   │   │   ├── BrakesPanel.tsx     VaultPanel — mint/redeem dobRWA
│   │   │   └── PriceChart.tsx      TradingView lightweight-charts component
│   │   └── landing/                Hero, Features, RugStats
│   └── lib/evm/
│       ├── abi.ts                  Contract ABIs
│       ├── contracts.ts            Deployed addresses (fill after deploy)
│       └── chains.ts               X Layer chain definition
```

---

## Contracts

| Contract | Purpose |
|---|---|
| `InariPegHook` | Uniswap v4 hook (0x2888). Intercepts swaps, prices via oracle. |
| `InariValidatorRegistry` | Owner-callable price feed. 1-hour alert windows on drops. |
| `InariRwaVault` | Deposit RWA → mint dobRWA. Burn dobRWA → redeem RWA. |
| `InariLPRegistry` | USDC filler queue for discounted liquidation buys. |
| `InariSwapRouter` | Thin wrapper calling `PoolManager.unlock()` for swaps. |

### Hook permission flags (0x2888)

| Flag | Bit | Purpose |
|---|---|---|
| `beforeInitialize` | 13 | Gate pool initialization to deployer |
| `beforeAddLiquidity` | 11 | Route LP additions through LPRegistry |
| `beforeSwap` | 7 | Intercept and re-price at oracle |
| `beforeSwapReturnDelta` | 3 | Return custom delta, skip AMM output |

### Oracle alert flow

```
owner calls setPrice(token, newPrice)
       |
       |  _maybeTriggerAlert(token, newPrice)
       v
newPrice < alertThreshold?
    yes → alertActiveUntil = block.timestamp + 1 hour
          emit PriceAlertTriggered(token, price, threshold, until)
     no → no-op

During any swap:
beforeSwap() → registry.isAlertActive(rwaToken)
             → active? revert OracleAlertActive(token, until)
             → quiet?  proceed with oracle settlement
```

---

## Deploying

### Requirements

- Foundry (`forge` ≥ 0.2)
- OKB on X Layer mainnet for gas ([faucet](https://www.okx.com/xlayer/faucet))
- `PRIVATE_KEY` env var (deployer wallet)

### Add X Layer to Foundry

In `contracts/foundry.toml` the `x_layer` profile is already configured:

```toml
[rpc_endpoints]
x_layer = "https://rpc.xlayer.tech"
```

### Deploy to X Layer mainnet

```bash
cd contracts

PRIVATE_KEY=0x<your-key> \
  forge script script/DeployXLayer.s.sol \
  --rpc-url x_layer \
  --broadcast -vvv
```

Optional env vars:

| Variable | Default | Description |
|---|---|---|
| `USDC` | _(deploys MockUSDC)_ | Existing USDC address on X Layer |
| `RWA_PRICE` | `100000e18` | Initial DCT oracle price |
| `ALERT_PCT` | `70` | Alert fires when price drops below this % |

After deploying, copy the printed addresses into `inari/lib/evm/contracts.ts`.

---

## Running the demo

The demo deploys a fresh instance and walks through the full lifecycle:

```bash
# Option A — Anvil fork (free, no real gas)
anvil --fork-url https://rpc.xlayer.tech

# In a second terminal:
cd contracts
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Demo.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast -vvv
```

```bash
# Option B — against X Layer mainnet (costs real OKB)
cd contracts
PRIVATE_KEY=0x<your-key> \
  forge script script/Demo.s.sol \
  --rpc-url https://rpc.xlayer.tech \
  --broadcast -vvv
```

### Demo steps

```
 1  Deploy MockUSDC + DCT (RWA token)
 2  Deploy ValidatorRegistry, RwaVault, LPRegistry
 3  Mine CREATE2 salt → deploy InariPegHook at correct address
 4  Wire setHook on registry + vault
 5  Set oracle price ($100,000) + alert threshold ($70,000)
 6  Deploy SwapRouter + configure pool key
 7  Initialize Uniswap v4 pool
 8  Vault: approve DCT → deposit → receive dobRWA
 9  Swap:  approve USDC → router.swap() → receive DCT at oracle price
10  Oracle: push price to $68,000 → alert fires
11  Swap:  attempt swap during alert → revert OracleAlertActive  ✓
12  Oracle: emergency price recovery to $102,000
```

---

## Running the tests

```bash
cd contracts
forge test -vv
```

176 tests, all passing. Run time ~5ms (no forks).

---

## Frontend

```bash
cd inari
npm install
npm run dev
# open http://localhost:3000
```

| Page | Route | Description |
|---|---|---|
| Swap | `/app` | Trade USDC ↔ DCT at oracle price. TradingView chart. |
| Oracle | `/app/status` | Live price feed, alert status, 90-day price chart. |
| Vault | `/app/brakes` | Mint dobRWA against DCT collateral. Redeem to reclaim. |
| Docs | `/app/docs` | Contract architecture + ASCII flow diagrams. |

---

## Chain info — X Layer mainnet (chain ID 196)

| Contract | Address |
|---|---|
| PoolManager | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xcF1EAFC6928dC385A342E7C6491d371d2871458b` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| CREATE2 factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |

---

Built for **Hook the Future** — Uniswap × X Layer × Flap hackathon.
