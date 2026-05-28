"use client";

import { useEffect, useState } from "react";
import { type Hex } from "viem";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEvm } from "@/components/providers/EvmProvider";
import { INARI_HOOK_ABI } from "@/lib/evm/abi";
import { INARI_HOOK } from "@/lib/evm/contracts";

type Snapshot = {
  poolId: Hex;
  peakTvl: bigint;
  lastTvl: bigint;
  crashUntil: bigint;
  drawdownUntil: bigint;
};

export function BrakesPanel() {
  const { wallet, publicClient } = useEvm();
  const [queryAddr, setQueryAddr] = useState("");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [now, setNow] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractsDeployed = INARI_HOOK !== "0x0000000000000000000000000000000000000000";

  // Live-tick the "now" reference so the time-remaining displays count down.
  useEffect(() => {
    const t = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (wallet.status === "connected" && !queryAddr) setQueryAddr(wallet.address);
  }, [wallet, queryAddr]);

  async function refresh(addr: string) {
    if (!contractsDeployed) {
      setError("Contracts not deployed");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const team = addr as Hex;
      const poolId = (await publicClient.readContract({
        address: INARI_HOOK,
        abi: INARI_HOOK_ABI,
        functionName: "teamToPool",
        args: [team],
      })) as Hex;

      if (poolId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        setSnap(null);
        setError("Team not registered");
        return;
      }

      const [peakTvl, lastTvl, crashUntil, drawdownUntil] = await Promise.all([
        publicClient.readContract({ address: INARI_HOOK, abi: INARI_HOOK_ABI, functionName: "peakTvl", args: [poolId] }),
        publicClient.readContract({ address: INARI_HOOK, abi: INARI_HOOK_ABI, functionName: "lastTvl", args: [poolId] }),
        publicClient.readContract({ address: INARI_HOOK, abi: INARI_HOOK_ABI, functionName: "crashPauseUntil", args: [poolId] }),
        publicClient.readContract({ address: INARI_HOOK, abi: INARI_HOOK_ABI, functionName: "drawdownPauseUntil", args: [poolId] }),
      ]);

      setSnap({
        poolId,
        peakTvl: peakTvl as bigint,
        lastTvl: lastTvl as bigint,
        crashUntil: crashUntil as bigint,
        drawdownUntil: drawdownUntil as bigint,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read");
    } finally {
      setLoading(false);
    }
  }

  function formatRemaining(until: bigint): string {
    if (until <= now) return "—";
    const seconds = Number(until - now);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  }

  const crashActive = snap !== null && snap.crashUntil > now;
  const drawdownActive = snap !== null && snap.drawdownUntil > now;

  const drawdown =
    snap && snap.peakTvl > 0n && snap.lastTvl < snap.peakTvl
      ? Number(((snap.peakTvl - snap.lastTvl) * 100n) / snap.peakTvl)
      : 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-widest text-accent">Brakes</div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">Auto-pause status.</h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          The hook watches its own pool. A ≥30% single-swap price drop activates
          the <span className="font-mono">crash brake</span> for 1 hour; a ≥50%
          TVL fall from peak activates the <span className="font-mono">drawdown brake</span> for
          24 hours. Both pause team withdrawals. No external trigger, no human input.
        </p>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-foreground/60">Team address</div>
            <input
              value={queryAddr}
              onChange={(e) => setQueryAddr(e.target.value)}
              placeholder="0x…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground/30 focus:border-accent focus:outline-none"
            />
          </div>
          <Button onClick={() => refresh(queryAddr)} disabled={loading || !queryAddr}>
            {loading ? "Loading…" : "Load"}
          </Button>
        </CardBody>
      </Card>

      {error && (
        <Card className="border-accent/30 bg-accent/8">
          <CardBody>
            <div className="font-mono text-xs text-accent">{error}</div>
          </CardBody>
        </Card>
      )}

      {snap && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className={crashActive ? "border-accent/40" : ""}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">
                      Crash brake
                    </div>
                    <div className="mt-1 font-serif text-2xl">≥30% single-swap drop</div>
                    <div className="mt-1 text-sm text-foreground/65">1-hour pause when triggered</div>
                  </div>
                  <div
                    className={`inline-flex h-6 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-widest ${
                      crashActive ? "bg-accent text-white" : "bg-surface-2 text-foreground/50"
                    }`}
                  >
                    {crashActive ? "Active" : "Quiet"}
                  </div>
                </div>
                {crashActive && (
                  <div className="font-mono text-xs text-accent">Expires in {formatRemaining(snap.crashUntil)}</div>
                )}
              </CardBody>
            </Card>

            <Card className={drawdownActive ? "border-accent/40" : ""}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">
                      Drawdown brake
                    </div>
                    <div className="mt-1 font-serif text-2xl">≥50% TVL below peak</div>
                    <div className="mt-1 text-sm text-foreground/65">24-hour pause; re-armed each swap</div>
                  </div>
                  <div
                    className={`inline-flex h-6 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-widest ${
                      drawdownActive ? "bg-accent text-white" : "bg-surface-2 text-foreground/50"
                    }`}
                  >
                    {drawdownActive ? "Active" : "Quiet"}
                  </div>
                </div>
                {drawdownActive && (
                  <div className="font-mono text-xs text-accent">Expires in {formatRemaining(snap.drawdownUntil)}</div>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody className="flex flex-col gap-2 text-sm leading-7 text-foreground/80">
              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/60">TVL snapshot</div>
              <div className="flex items-center justify-between">
                <span>Peak TVL</span>
                <span className="font-mono">{snap.peakTvl.toString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Current TVL</span>
                <span className="font-mono">{snap.lastTvl.toString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Drawdown</span>
                <span className={`font-mono ${drawdown >= 50 ? "text-accent" : "text-foreground/60"}`}>
                  {drawdown}%
                </span>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
