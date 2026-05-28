const pillars = [
  {
    tag: "01 · Oracle",
    title: "Every swap settles at validated price",
    body: "<code>beforeSwap</code> intercepts the trade before the AMM runs. The hook calls <code>registry.getPrice(rwaToken)</code>, computes the exact output, transfers tokens, and returns a custom delta to PoolManager — AMM math never executes.",
    detail: "Oracle in. AMM out.",
  },
  {
    tag: "02 · Alert",
    title: "Auto-suspend on oracle stress",
    body: "When the validator pushes a new price, <code>_maybeTriggerAlert</code> checks it against the per-token threshold. A drop below threshold sets <code>alertActiveUntil = now + 1h</code> and subsequent <code>beforeSwap</code> calls revert with <code>OracleAlertActive</code>.",
    detail: "No keeper. No external call.",
  },
  {
    tag: "03 · Vault",
    title: "Mint dobRWA against real collateral",
    body: "Users deposit approved RWA tokens into <code>InariRwaVault</code>. The vault mints <code>dobRWA</code> at oracle price — a fungible ERC20 representing the pegged position. Redeem burns dobRWA and returns the underlying.",
    detail: "Collateral in. Peg token out.",
  },
  {
    tag: "04 · LP Registry",
    title: "Fillers earn fees backing liquidations",
    body: "<code>InariLPRegistry</code> manages a queue of USDC fillers willing to buy discounted dobRWA during liquidation events. When a liquidation swap fires, the hook routes through the filler queue at a penalty-adjusted rate before falling to the protocol reserve.",
    detail: "Incentivized liquidity, not passive AMM.",
  },
] as const;

export function Features() {
  return (
    <div className="relative h-full w-full" style={{ background: "#1a0f0c", color: "#f5ede0" }}>
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6 py-16 sm:px-10 sm:py-20">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <div
              className="font-mono text-xs uppercase tracking-widest"
              style={{ color: "rgba(196, 74, 60, 0.85)" }}
            >
              The Inari flow
            </div>
            <h2
              className="mt-3 max-w-2xl font-serif text-4xl tracking-tight sm:text-6xl"
              style={{ color: "#f5ede0" }}
            >
              Price. Alert. Vault. Fill.
              <br />
              <span style={{ color: "rgba(245, 237, 224, 0.55)" }}>
                Four layers, all on-chain.
              </span>
            </h2>
          </div>
          <p
            className="hidden max-w-xs text-sm leading-6 sm:block"
            style={{ color: "rgba(245, 237, 224, 0.65)" }}
          >
            The hook is the settlement layer. It reads a validator oracle,
            applies alert guards, and routes LP fills — without any external
            trigger or keeper bot.
          </p>
        </div>

        <div
          className="grid flex-1 grid-cols-1 gap-px overflow-hidden rounded-2xl sm:grid-cols-2"
          style={{ background: "rgba(245, 237, 224, 0.18)" }}
        >
          {pillars.map((p) => (
            <article
              key={p.tag}
              className="group relative flex flex-col justify-between gap-6 p-7 transition-colors sm:p-9"
              style={{ background: "#241410" }}
            >
              <div>
                <div
                  className="font-mono text-[11px] uppercase tracking-widest"
                  style={{ color: "#c44a3c" }}
                >
                  {p.tag}
                </div>
                <h3
                  className="mt-3 font-serif text-2xl tracking-tight"
                  style={{ color: "#faf2e5" }}
                >
                  {p.title}
                </h3>
                <p
                  className="mt-3 text-[15px] leading-7"
                  style={{ color: "rgba(250, 242, 229, 0.8)" }}
                  dangerouslySetInnerHTML={{ __html: p.body }}
                />
              </div>
              <div className="font-mono text-xs" style={{ color: "rgba(196, 74, 60, 0.85)" }}>
                {p.detail}
              </div>
            </article>
          ))}
        </div>

        <div
          className="mt-6 flex flex-col gap-3 rounded-2xl px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "rgba(245, 237, 224, 0.08)",
            border: "1px solid rgba(245, 237, 224, 0.16)",
          }}
        >
          <div>
            <div
              className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "#c44a3c" }}
            >
              Plus · No keeper required
            </div>
            <p
              className="mt-1 max-w-2xl text-[15px] leading-6"
              style={{ color: "rgba(250, 242, 229, 0.85)" }}
            >
              Alert triggers fire inside <code>setPrice()</code>. LP fills execute inside{" "}
              <code>beforeSwap()</code>. The protocol runs without a bot.
            </p>
          </div>
          <a
            href="/app"
            className="shrink-0 font-mono text-xs uppercase tracking-widest underline-offset-4 hover:underline"
            style={{ color: "#e8b5a8" }}
          >
            Open the console &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
