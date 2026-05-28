import { Button } from "@/components/ui/Button";

export function CTAFooter() {
  return (
    <div className="relative h-full w-full bg-accent-strong text-background">
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-between px-6 py-16 sm:px-10 sm:py-20">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-background/70">
            Ship something that doesn&rsquo;t rug
          </div>
          <h2 className="mt-4 max-w-3xl font-serif text-5xl tracking-tight sm:text-7xl">
            Lock liquidity to your roadmap.
            <br />
            Not to a clock.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-background/85">
            Inari is live on X Layer mainnet. Register a vesting position, hook
            it to your Uniswap v4 pool, and let your numbers do the talking.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button href="/app" size="lg" variant="secondary" className="!bg-background !text-foreground">
              Open the console
            </Button>
            <Button href="/app/docs" size="lg" variant="ghost" className="!text-background hover:!bg-background/10">
              Read the contracts &rarr;
            </Button>
          </div>
        </div>

        <footer className="flex flex-col gap-4 border-t border-background/20 pt-6 text-xs text-background/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 rotate-45 border-2 border-background" />
            <span className="font-serif text-base text-background">Inari</span>
          </div>
          <div className="font-mono uppercase tracking-widest">
            Hook the Future · X Layer · Uniswap v4
          </div>
        </footer>
      </div>
    </div>
  );
}
