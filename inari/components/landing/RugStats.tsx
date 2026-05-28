const stats = [
  { value: "$3.8B", label: "Lost to rugs in 2023", source: "Chainalysis 'Crypto Crime Report'" },
  { value: "$2.1M", label: "Drained from SQUID token in 7 days", source: "After timelock expiry" },
  { value: "40,000+", label: "SQUID investors left with worthless tokens", source: "Single rug event" },
  { value: "100%", label: "Of timelocks expire, then LP is removable", source: "By definition" },
];

export function RugStats() {
  return (
    <div className="relative h-full w-full bg-background">
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-6 sm:px-10">
        <div className="font-mono text-xs uppercase tracking-widest text-accent">
          The cost of time-based locks
        </div>
        <h2 className="mt-4 max-w-3xl font-serif text-4xl tracking-tight text-foreground sm:text-6xl">
          A lock that always expires
          <br />
          isn&rsquo;t a lock.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-foreground/70">
          Every rug pull in 2021–2024 used &ldquo;locked liquidity&rdquo; as a trust
          signal. Then the lock expired and the LP came out. Inari makes the
          unlock contingent on performance — if the protocol delivers, the
          team gets paid. If not, the LP stays where it is.
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
