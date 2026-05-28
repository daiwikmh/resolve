"use client";

import { useEvm } from "@/components/providers/EvmProvider";

export function WalletButton() {
  const { wallet, connect, disconnect } = useEvm();

  if (wallet.status === "idle" || wallet.status === "error") {
    return (
      <button
        onClick={connect}
        className="rounded-full border border-accent/40 bg-accent/8 px-4 py-2 font-mono text-xs text-accent transition-colors hover:bg-accent/15"
      >
        Connect wallet
      </button>
    );
  }

  if (wallet.status === "connecting") {
    return (
      <div className="rounded-full border border-border px-4 py-2 font-mono text-xs text-foreground/40 animate-pulse">
        Connecting...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        <span className="font-mono text-xs text-foreground/70">
          {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
        </span>
        <span className="font-mono text-[10px] text-foreground/35">·</span>
        <span className="font-mono text-[10px] text-foreground/50">{wallet.chain.label}</span>
      </div>
      <button
        onClick={disconnect}
        className="rounded-full border border-border px-3 py-2 font-mono text-[10px] text-foreground/40 transition-colors hover:text-foreground hover:border-foreground/20"
      >
        Disconnect
      </button>
    </div>
  );
}
