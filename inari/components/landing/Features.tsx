const pillars = [
  {
    tag: "01 · Register",
    title: "Commit to milestones, not timestamps",
    body: "Teams declare three on-chain milestones — TVL, cumulative volume, unique users — and the percent of LP each unlocks. The contract validates that unlock percentages sum to exactly 100. There&rsquo;s no admin key, no escape hatch.",
    detail: "Three milestones. One commitment.",
  },
  {
    tag: "02 · Lock",
    title: "Liquidity routes through the hook",
    body: "When the team adds liquidity to the v4 pool, `afterAddLiquidity` records the position in the Vault Manager. The LP is now custody-locked: removal is blocked until milestones unlock it, and the cumulative-withdrawal cap is enforced across calls.",
    detail: "Vault custody. No team override.",
  },
  {
    tag: "03 · Earn",
    title: "Milestones unlock as the protocol delivers",
    body: "Every swap updates the hook&rsquo;s own metrics: TVL, cumulative volume, unique swappers. When the on-chain number meets the registered threshold, anyone can call `claimMilestoneUnlock` — the hook validates the metric live and bumps the team&rsquo;s unlocked share.",
    detail: "Hit the number, unlock the share.",
  },
  {
    tag: "04 · Defend",
    title: "Rug signals trigger autonomous defenses",
    body: "The hook auto-pauses team withdrawals inside `afterSwap` whenever its own pool fires: a ≥30% single-swap price drop activates a 1-hour crash brake; a ≥50% TVL fall from peak activates a 24-hour drawdown brake. No external trigger, no caller, no oracle.",
    detail: "Brakes inside the hook. Nothing else.",
  },
] as const;

export function Features() {
  return (
    <div className="relative h-full w-full" style={{ background: "#1a0f0c", color: "#f5ede0" }}>
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6 py-16 sm:px-10 sm:py-20">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "rgba(196, 74, 60, 0.85)" }}>
              The Inari flow
            </div>
            <h2 className="mt-3 max-w-2xl font-serif text-4xl tracking-tight sm:text-6xl" style={{ color: "#f5ede0" }}>
              Register. Lock. Earn. Defend.
              <br />
              <span style={{ color: "rgba(245, 237, 224, 0.55)" }}>Four phases, every step on chain.</span>
            </h2>
          </div>
          <p className="hidden max-w-xs text-sm leading-6 sm:block" style={{ color: "rgba(245, 237, 224, 0.65)" }}>
            The hook is its own oracle. It reads pool state from PoolManager via
            <code className="mx-1 font-mono">afterSwap</code>, scores its own
            risk, and lets anyone validate a milestone against ground truth.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden rounded-2xl sm:grid-cols-2" style={{ background: "rgba(245, 237, 224, 0.18)" }}>
          {pillars.map((p) => (
            <article
              key={p.tag}
              className="group relative flex flex-col justify-between gap-6 p-7 transition-colors sm:p-9"
              style={{ background: "#241410" }}
            >
              <div>
                <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#c44a3c" }}>
                  {p.tag}
                </div>
                <h3 className="mt-3 font-serif text-2xl tracking-tight" style={{ color: "#faf2e5" }}>
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
          style={{ background: "rgba(245, 237, 224, 0.08)", border: "1px solid rgba(245, 237, 224, 0.16)" }}
        >
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#c44a3c" }}>
              Plus · No keeper required
            </div>
            <p className="mt-1 max-w-2xl text-[15px] leading-6" style={{ color: "rgba(250, 242, 229, 0.85)" }}>
              Milestone unlocks are permissionless; the brakes are autonomous.
              The protocol runs without a bot.
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
