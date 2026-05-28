"use client";

import { useState, useEffect, useMemo } from "react";
import { type Hex, parseUnits, formatUnits, encodeFunctionData } from "viem";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEvm } from "@/components/providers/EvmProvider";
import { ERC20_ABI, VALIDATOR_REGISTRY_ABI, SWAP_ROUTER_ABI } from "@/lib/evm/abi";
import {
  MOCK_USDC,
  DCT_TOKEN,
  SWAP_ROUTER,
  VALIDATOR_REGISTRY,
  isDeployed,
} from "@/lib/evm/contracts";
import { PriceChart, generateDctPriceHistory, type PricePoint } from "@/components/app/PriceChart";

type Direction = "usdc_to_dct" | "dct_to_usdc";
type TxStatus =
  | { kind: "idle" }
  | { kind: "approving" }
  | { kind: "swapping" }
  | { kind: "success"; hash: string }
  | { kind: "error"; message: string };

export function SwapPanel() {
  const { wallet, publicClient } = useEvm();
  const [direction, setDirection] = useState<Direction>("usdc_to_dct");
  const [amountIn, setAmountIn] = useState("");
  const [oraclePrice, setOraclePrice] = useState<bigint | null>(null);
  const [alertActive, setAlertActive] = useState(false);
  const [alertUntil, setAlertUntil] = useState<bigint>(0n);
  const [status, setStatus] = useState<TxStatus>({ kind: "idle" });
  const [chartData] = useState<PricePoint[]>(() => generateDctPriceHistory());

  const deployed = isDeployed(SWAP_ROUTER) && isDeployed(VALIDATOR_REGISTRY);

  useEffect(() => {
    if (!deployed) return;
    async function load() {
      try {
        const [priceResult, alertResult, alertUntilResult] = await Promise.all([
          publicClient.readContract({
            address: VALIDATOR_REGISTRY as Hex,
            abi: VALIDATOR_REGISTRY_ABI,
            functionName: "getPrice",
            args: [DCT_TOKEN as Hex],
          }),
          publicClient.readContract({
            address: VALIDATOR_REGISTRY as Hex,
            abi: VALIDATOR_REGISTRY_ABI,
            functionName: "isAlertActive",
            args: [DCT_TOKEN as Hex],
          }),
          publicClient.readContract({
            address: VALIDATOR_REGISTRY as Hex,
            abi: VALIDATOR_REGISTRY_ABI,
            functionName: "alertActiveUntil",
            args: [DCT_TOKEN as Hex],
          }),
        ]);
        const [priceUsd] = priceResult as unknown as [bigint, number];
        setOraclePrice(priceUsd);
        setAlertActive(alertResult as boolean);
        setAlertUntil(alertUntilResult as bigint);
      } catch { /* RPC error — leave defaults */ }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [deployed, publicClient]);

  const amountInParsed = useMemo(() => {
    try { return parseUnits(amountIn || "0", 18); }
    catch { return 0n; }
  }, [amountIn]);

  const amountOut = useMemo(() => {
    if (!oraclePrice || oraclePrice === 0n || amountInParsed === 0n) return null;
    if (direction === "usdc_to_dct") {
      return (amountInParsed * 10n ** 18n) / oraclePrice;
    }
    return (amountInParsed * oraclePrice) / 10n ** 18n;
  }, [amountInParsed, oraclePrice, direction]);

  const inputToken = direction === "usdc_to_dct" ? MOCK_USDC : DCT_TOKEN;
  const inputSymbol = direction === "usdc_to_dct" ? "USDC" : "DCT";
  const outputSymbol = direction === "usdc_to_dct" ? "DCT" : "USDC";

  async function approveAndSwap() {
    if (wallet.status !== "connected" || amountInParsed === 0n || !deployed || alertActive) return;
    setStatus({ kind: "approving" });
    try {
      const allowance = (await publicClient.readContract({
        address: inputToken as Hex,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [wallet.address, SWAP_ROUTER as Hex],
      })) as bigint;

      if (allowance < amountInParsed) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SWAP_ROUTER as Hex, amountInParsed],
        });
        const ah = await wallet.walletClient.sendTransaction({
          account: wallet.address,
          chain: wallet.walletClient.chain,
          to: inputToken as Hex,
          data: approveData,
        });
        await publicClient.waitForTransactionReceipt({ hash: ah });
      }

      setStatus({ kind: "swapping" });
      const zeroForOne =
        direction === "usdc_to_dct"
          ? MOCK_USDC.toLowerCase() < DCT_TOKEN.toLowerCase()
          : MOCK_USDC.toLowerCase() > DCT_TOKEN.toLowerCase();

      const swapData = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: "swap",
        args: [zeroForOne, amountInParsed, "0x" as Hex],
      });
      const hash = await wallet.walletClient.sendTransaction({
        account: wallet.address,
        chain: wallet.walletClient.chain,
        to: SWAP_ROUTER as Hex,
        data: swapData,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ kind: "success", hash });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Transaction failed" });
    }
  }

  const priceDisplay = oraclePrice
    ? `$${(Number(oraclePrice) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : "$100,000.00";

  const amountOutDisplay =
    amountOut !== null
      ? Number(formatUnits(amountOut, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "—";

  const busy = status.kind === "approving" || status.kind === "swapping";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-widest text-accent">Swap</div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">Trade RWA tokens at oracle price.</h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          Zero slippage. Every swap settles at the validator oracle price — the AMM curve is bypassed
          entirely inside <code className="font-mono text-sm">beforeSwap</code>.
        </p>
      </header>

      {alertActive && (
        <Card className="border-accent/40 bg-accent/8">
          <CardBody>
            <div className="font-mono text-xs uppercase tracking-widest text-accent">
              Oracle alert active
            </div>
            <p className="mt-1 text-sm text-foreground/80">
              Price dropped below alert threshold. Swaps are paused until{" "}
              {new Date(Number(alertUntil) * 1000).toLocaleTimeString()}.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">
                DCT / USDC · Oracle price
              </div>
              <div className="mt-0.5 font-serif text-3xl text-foreground">{priceDisplay}</div>
            </div>
            <div className="font-mono text-xs text-foreground/40">90d</div>
          </div>
          <Card className="overflow-hidden p-0">
            <PriceChart data={chartData} height={310} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="flex flex-col gap-5">
              <div className="flex gap-1.5">
                {(["usdc_to_dct", "dct_to_usdc"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`flex-1 rounded-md border py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
                      direction === d
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-foreground/50 hover:text-foreground"
                    }`}
                  >
                    {d === "usdc_to_dct" ? "USDC → DCT" : "DCT → USDC"}
                  </button>
                ))}
              </div>

              <div>
                <Label>You pay ({inputSymbol})</Label>
                <input
                  type="number"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  placeholder="0.0"
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-foreground/30 focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <Label>You receive ({outputSymbol})</Label>
                <div className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm text-foreground/70">
                  {amountOutDisplay}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 font-mono text-xs">
                <span className="text-foreground/50">Oracle rate</span>
                <span className="text-foreground/80">1 DCT = {priceDisplay}</span>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={approveAndSwap}
                disabled={
                  wallet.status !== "connected" ||
                  alertActive ||
                  !deployed ||
                  amountInParsed === 0n ||
                  busy
                }
              >
                {wallet.status !== "connected"
                  ? "Connect wallet"
                  : alertActive
                  ? "Oracle alert — swaps paused"
                  : !deployed
                  ? "Contracts not deployed"
                  : status.kind === "approving"
                  ? "Approving…"
                  : status.kind === "swapping"
                  ? "Swapping…"
                  : "Swap"}
              </Button>

              {status.kind === "success" && (
                <div className="font-mono text-xs text-success">
                  ✓ Swapped · tx {status.hash.slice(0, 10)}…
                </div>
              )}
              {status.kind === "error" && (
                <div className="font-mono text-xs text-accent">✗ {status.message}</div>
              )}
            </CardBody>
          </Card>

          {!deployed && (
            <Card className="border-accent/30 bg-accent/8">
              <CardBody>
                <div className="font-mono text-xs uppercase tracking-widest text-accent">
                  Contracts not deployed
                </div>
                <p className="mt-2 text-sm text-foreground/80">
                  Run{" "}
                  <code className="font-mono text-xs">
                    forge script script/DeployXLayer.s.sol --broadcast
                  </code>{" "}
                  then paste the addresses into{" "}
                  <code className="font-mono text-xs">lib/evm/contracts.ts</code>.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-foreground/60">
      {children}
    </div>
  );
}
