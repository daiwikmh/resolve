const stats = [
  {
    value: "$16.1T",
    label: "Global RWA market — real estate, bonds, commodities",
    source: "World Bank, 2024 estimate",
  },
  {
    value: "$20B+",
    label: "Tokenized RWAs on-chain as of 2024",
    source: "Boston Consulting Group",
  },
  {
    value: "~0%",
    label: "RWA trading volume routed through AMM DEXes",
    source: "AMM curves break peg on illiquid RWAs",
  },
  {
    value: "100%",
    label: "Of Inari swaps settle at exact oracle price — zero slippage",
    source: "beforeSwap intercepts, AMM never runs",
  },
];

export function RugStats() {
  return (
    <div className="relative h-full w-full bg-background">
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-6 sm:px-10">
        <div className="font-mono text-xs uppercase tracking-widest text-accent">
          The RWA liquidity problem
        </div>
        <h2 className="mt-4 max-w-3xl font-serif text-4xl tracking-tight text-foreground sm:text-6xl">
          Trillions in real assets.
          <br />
          Zero DEX liquidity.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-foreground/70">
          AMM curves are built for volatile assets. Tokenized real estate, bonds, and
          commodities need to trade at a price — not at whatever the curve produces.
          Inari uses the oracle as the settlement layer; the pool is just the pipe.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-2 bg-surface p-6 sm:p-8">
              <div className="font-serif text-4xl tracking-tight text-foreground sm:text-5xl">
                {s.value}
              </div>
              <div className="text-sm leading-6 text-foreground/85">{s.label}</div>
              <div className="mt-auto font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                {s.source}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
