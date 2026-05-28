import { Button } from "@/components/ui/Button";

export function Hero() {
  return (
    <div className="relative h-full w-full bg-background">
      <div className="absolute inset-0 grid-bg" aria-hidden />
      <div className="absolute inset-0 radial-fade" aria-hidden />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6 sm:px-10">
        <header className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 rotate-45 border-2 border-accent" />
            <span className="font-serif text-xl text-foreground">Inari</span>
          </div>
          <nav className="hidden gap-8 text-sm text-foreground/80 sm:flex">
            <a href="#features" className="hover:text-foreground">How it works</a>
            <a href="#stats" className="hover:text-foreground">The problem</a>
            <a href="/app" className="hover:text-foreground">Console</a>
          </nav>
          <Button href="/app" size="sm">Launch app</Button>
        </header>

        <div className="grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-accent">
              Uniswap v4 · X Layer
            </div>
            <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight text-foreground sm:text-7xl">
              LP unlocks
              <br />
              earned,
              <br />
              not waited.
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-foreground/75">
              Time-locks delay rugs, they don&rsquo;t prevent them. Inari ties LP release
              to on-chain milestones — TVL, volume, real users. Hit the numbers,
              unlock your liquidity. Don&rsquo;t, and it stays locked.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button href="/app" size="lg">Open the console</Button>
              <Button href="#features" size="lg" variant="ghost">See the flow &rarr;</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-3 border-t border-foreground/15 pb-10 pt-6 text-sm text-foreground/70 sm:grid-cols-4">
          <Pillar tag="Performance-gated" text="Milestones unlock liquidity" />
          <Pillar tag="Permissionless" text="No oracle, no admin, no keeper" />
          <Pillar tag="Auto-braked" text="Crash & drawdown pause" />
          <Pillar tag="Single chain" text="X Layer mainnet only" />
        </div>
      </div>
    </div>
  );
}

function Pillar({ tag, text }: { tag: string; text: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/50">
        {tag}
      </div>
      <div className="mt-1 text-foreground/85">{text}</div>
    </div>
  );
}
