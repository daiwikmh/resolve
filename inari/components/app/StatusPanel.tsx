"use client";

import { useState } from "react";
import { type Hex } from "viem";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEvm } from "@/components/providers/EvmProvider";
import { VALIDATOR_REGISTRY_ABI } from "@/lib/evm/abi";
import { VALIDATOR_REGISTRY, DCT_TOKEN, isDeployed } from "@/lib/evm/contracts";
import { PriceChart, generateDctPriceHistory, type PricePoint } from "@/components/app/PriceChart";

type OracleState = {
  priceUsd: bigint;
  updatedAt: bigint;
  alertActive: boolean;
  alertUntil: bigint;
  alertThreshold: bigint;
};

export function OraclePanel() {
  const { publicClient } = useEvm();
  const [tokenAddr, setTokenAddr] = useState(DCT_TOKEN);
  const [state, setState] = useState<OracleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData] = useState<PricePoint[]>(() => generateDctPriceHistory());
  const deployed = isDeployed(VALIDATOR_REGISTRY);

  async function load(addr: string) {
    if (!deployed) { setError("Contracts not deployed — deploy first"); return; }
    setLoading(true);
    setError(null);
    try {
      const [priceResult, alertActive, alertUntil, alertThreshold] = await Promise.all([
        publicClient.readContract({
          address: VALIDATOR_REGISTRY as Hex,
          abi: VALIDATOR_REGISTRY_ABI,
          functionName: "getPrice",
          args: [addr as Hex],
        }),
        publicClient.readContract({
          address: VALIDATOR_REGISTRY as Hex,
          abi: VALIDATOR_REGISTRY_ABI,
          functionName: "isAlertActive",
          args: [addr as Hex],
        }),
        publicClient.readContract({
          address: VALIDATOR_REGISTRY as Hex,
          abi: VALIDATOR_REGISTRY_ABI,
          functionName: "alertActiveUntil",
          args: [addr as Hex],
        }),
        publicClient.readContract({
          address: VALIDATOR_REGISTRY as Hex,
          abi: VALIDATOR_REGISTRY_ABI,
          functionName: "alertThreshold",
          args: [addr as Hex],
        }),
      ]);
      const [priceUsd, updatedAt] = priceResult as [bigint, bigint];
      setState({
        priceUsd,
        updatedAt,
        alertActive: alertActive as boolean,
        alertUntil: alertUntil as bigint,
        alertThreshold: alertThreshold as bigint,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read oracle");
    } finally {
      setLoading(false);
    }
  }

  const fmt = (p: bigint) =>
    `$${(Number(p) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtTime = (ts: bigint) =>
    ts > 0n ? new Date(Number(ts) * 1000).toLocaleString() : "—";

  const livePrice = state ? fmt(state.priceUsd) : "$100,000.00";
  const liveAlert = state?.alertActive ?? false;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-widest text-accent">Oracle</div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">Live price feed.</h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          Validator-sourced prices power every Inari swap. An automatic alert
          suspends trading when price drops below the configured threshold.
        </p>
      </header>

      <Card className="overflow-hidden p-0">
        <div className="flex items-start justify-between px-6 pb-3 pt-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">
              DCT · Digital Commodity Token
            </div>
            <div className="mt-1 font-serif text-3xl text-foreground">{livePrice}</div>
          </div>
          <div
            className={`mt-1 inline-flex h-6 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-widest ${
              liveAlert ? "bg-accent text-white" : "bg-surface-2 text-foreground/50"
            }`}
          >
            {liveAlert ? "Alert active" : "Nominal"}
          </div>
        </div>
        <PriceChart data={chartData} height={320} />
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-foreground/60">
              Token address
            </div>
            <input
              value={tokenAddr}
              onChange={(e) => setTokenAddr(e.target.value)}
              placeholder="0x…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground/30 focus:border-accent focus:outline-none"
            />
          </div>
          <Button onClick={() => load(tokenAddr)} disabled={loading || !tokenAddr}>
            {loading ? "Loading…" : "Query oracle"}
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

      {state && (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Oracle price" value={fmt(state.priceUsd)} />
          <Stat label="Last update" value={fmtTime(state.updatedAt)} mono />
          <Stat label="Alert threshold" value={fmt(state.alertThreshold)} />
          <Stat
            label="Alert status"
            value={state.alertActive ? "Active" : "Quiet"}
            accent={state.alertActive}
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface p-6">
      <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">{label}</div>
      <div
        className={`mt-2 ${mono ? "font-mono text-sm break-all" : "font-serif text-2xl"} ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
