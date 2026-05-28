import { Card, CardBody } from "@/components/ui/Card";

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-widest text-accent">Docs</div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">How Inari works.</h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          A Uniswap v4 hook that intercepts every swap and settles it at the oracle price — bypassing
          the AMM curve entirely.
        </p>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">
            System overview
          </div>
          <pre className="font-mono text-xs leading-5 text-foreground/70 overflow-x-auto">{`
  User
   │
   │  swap(zeroForOne, amountIn, hookData)
   ▼
  InariSwapRouter
   │
   │  poolManager.unlock(...)
   ▼
  IPoolManager  ──────────────────────────────────────────┐
                                                           │
                                      beforeSwap() called  │
                                                           ▼
                                               InariPegHook
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                          isAlertActive?    getPrice(token)   LP fill check
                          (registry)        (registry)       (lpRegistry)
                                    │
                              alert? → revert OracleAlertActive
                              else  → settle at oracle price
                                      return delta to PoolManager
  `}</pre>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">
            Hook permissions · <span className="text-foreground/80">0x2888</span>
          </div>
          <pre className="font-mono text-xs leading-5 text-foreground/70 overflow-x-auto">{`
  Flag          Hex     Purpose
  ──────────────────────────────────────────────────────────
  beforeInit    0x2000  Revert if pool not initialized by deployer
  beforeAddLiq  0x0800  Gate LP additions through InariLPRegistry
  beforeSwap    0x0080  Intercept and re-price at oracle
  beforeSwapRD  0x0008  Return custom delta (bypass AMM output)
  `}</pre>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">
            Oracle alert flow
          </div>
          <pre className="font-mono text-xs leading-5 text-foreground/70 overflow-x-auto">{`
  owner calls setPrice(token, newPrice)
         │
         │  _maybeTriggerAlert(token, newPrice)
         ▼
  newPrice < alertThreshold?
      yes → alertActiveUntil = block.timestamp + 1 hours
            emit PriceAlertTriggered(...)
       no → no-op

  During swap:
  _beforeSwap() → registry.isAlertActive(rwaToken)
               → true? revert OracleAlertActive(token, until)
               → false? proceed with oracle settlement
  `}</pre>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ContractCard
          name="InariPegHook"
          flags="0x2888"
          desc="Main hook. Intercepts swaps and settles at oracle price via beforeSwap + custom accounting."
        />
        <ContractCard
          name="InariValidatorRegistry"
          flags="oracle"
          desc="Owner-callable price feed. Stores per-token prices and fires 1-hour alert windows on drops."
        />
        <ContractCard
          name="InariRwaVault"
          flags="vault"
          desc="Mint dobRWA against approved RWA collateral. Burn to redeem underlying at oracle price."
        />
      </div>
    </div>
  );
}

function ContractCard({ name, flags, desc }: { name: string; flags: string; desc: string }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-2">
        <div className="font-mono text-[11px] uppercase tracking-widest text-accent">{flags}</div>
        <div className="font-serif text-lg text-foreground">{name}</div>
        <div className="text-sm leading-6 text-foreground/70">{desc}</div>
      </CardBody>
    </Card>
  );
}
