"use client";

import { useState } from "react";
import { type Hex, parseUnits, encodeFunctionData } from "viem";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEvm } from "@/components/providers/EvmProvider";
import { ERC20_ABI, RWA_VAULT_ABI } from "@/lib/evm/abi";
import { RWA_VAULT, DCT_TOKEN, isDeployed } from "@/lib/evm/contracts";

type Tab = "deposit" | "redeem";
type TxStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; hash: string }
  | { kind: "error"; message: string };

export function VaultPanel() {
  const { wallet, publicClient } = useEvm();
  const [tab, setTab] = useState<Tab>("deposit");
  const [rwaToken, setRwaToken] = useState<string>(DCT_TOKEN);
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>({ kind: "idle" });
  const deployed = isDeployed(RWA_VAULT);

  async function handleDeposit() {
    if (wallet.status !== "connected" || !deployed) return;
    setTxStatus({ kind: "pending" });
    try {
      const amtIn = parseUnits(amount || "0", 18);
      if (amtIn === 0n) throw new Error("Enter an amount");

      const allowance = (await publicClient.readContract({
        address: rwaToken as Hex,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [wallet.address, RWA_VAULT as Hex],
      })) as bigint;

      if (allowance < amtIn) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [RWA_VAULT as Hex, amtIn],
        });
        const ah = await wallet.walletClient.sendTransaction({
          account: wallet.address,
          chain: wallet.walletClient.chain,
          to: rwaToken as Hex,
          data: approveData,
        });
        await publicClient.waitForTransactionReceipt({ hash: ah });
      }

      const depositData = encodeFunctionData({
        abi: RWA_VAULT_ABI,
        functionName: "deposit",
        args: [rwaToken as Hex, amtIn],
      });
      const hash = await wallet.walletClient.sendTransaction({
        account: wallet.address,
        chain: wallet.walletClient.chain,
        to: RWA_VAULT as Hex,
        data: depositData,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus({ kind: "success", hash });
    } catch (e) {
      setTxStatus({ kind: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  }

  async function handleRedeem() {
    if (wallet.status !== "connected" || !deployed) return;
    setTxStatus({ kind: "pending" });
    try {
      const amtIn = parseUnits(amount || "0", 18);
      if (amtIn === 0n) throw new Error("Enter an amount");

      const redeemData = encodeFunctionData({
        abi: RWA_VAULT_ABI,
        functionName: "withdraw",
        args: [rwaToken as Hex, amtIn, wallet.address],
      });
      const hash = await wallet.walletClient.sendTransaction({
        account: wallet.address,
        chain: wallet.walletClient.chain,
        to: RWA_VAULT as Hex,
        data: redeemData,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus({ kind: "success", hash });
    } catch (e) {
      setTxStatus({ kind: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-widest text-accent">Vault</div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">Mint &amp; redeem dobRWA.</h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          Deposit tokenized real-world assets to mint <strong>dobRWA</strong> — the oracle-pegged
          instrument traded inside the Inari pool. Redeem at any time to reclaim the underlying.
        </p>
      </header>

      <Card className="border-border bg-surface-2">
        <CardBody>
          <pre className="font-mono text-[11px] leading-5 text-foreground/60 overflow-x-auto">{`
  Deposit flow                    Redeem flow
  ────────────────────────        ────────────────────────
  User                            User
    │                               │
    │  approve(RWA_VAULT, amt)       │  withdraw(rwaToken,
    ▼                               │    dobRwaAmt, to)
  RWA Token ──────────────┐         ▼
                          │       dobRWA ──────────────┐
    ┌───────────────────────────────────────────────┐  │
    │               InariRwaVault                   │  │
    │  deposit(rwaToken, amount)                    │  │
    │    → oracle price check                       │  │
    │    → mint dobRWA to user                      │◄─┘
    └───────────────────────────────────────────────┘
                          │
                          ▼
                       dobRWA (ERC20, 18 dec)
          `}</pre>
        </CardBody>
      </Card>

      {!deployed && (
        <Card className="border-accent/30 bg-accent/8">
          <CardBody>
            <div className="font-mono text-xs uppercase tracking-widest text-accent">
              Contracts not deployed
            </div>
            <p className="mt-2 text-sm text-foreground/80">
              Deploy InariRwaVault on X Layer mainnet to use this panel.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex flex-col gap-6">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {(["deposit", "redeem"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setTxStatus({ kind: "idle" }); }}
                className={`flex-1 rounded-md py-2 font-mono text-[13px] capitalize transition-colors ${
                  tab === t ? "bg-accent text-white" : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-foreground/60">
              RWA token address
            </div>
            <input
              value={rwaToken}
              onChange={(e) => setRwaToken(e.target.value)}
              placeholder="0x…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground/30 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-foreground/60">
              {tab === "deposit" ? "RWA amount to deposit" : "dobRWA amount to redeem"}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground/30 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="rounded-md bg-surface-2 px-4 py-3 font-mono text-xs text-foreground/60">
            {tab === "deposit"
              ? "RWA tokens are locked; equivalent dobRWA is minted at oracle price to your address."
              : "dobRWA is burned; underlying RWA collateral is returned to your address."}
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={tab === "deposit" ? handleDeposit : handleRedeem}
            disabled={
              wallet.status !== "connected" ||
              !deployed ||
              txStatus.kind === "pending"
            }
          >
            {wallet.status !== "connected"
              ? "Connect wallet"
              : txStatus.kind === "pending"
              ? "Processing…"
              : tab === "deposit"
              ? "Deposit & mint dobRWA"
              : "Redeem dobRWA"}
          </Button>

          {txStatus.kind === "success" && (
            <div className="font-mono text-xs text-success">
              ✓ Done · tx {txStatus.hash.slice(0, 10)}…
            </div>
          )}
          {txStatus.kind === "error" && (
            <div className="font-mono text-xs text-accent">✗ {txStatus.message}</div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <InfoCard title="Oracle-priced" body="Mint and redeem ratios follow the InariValidatorRegistry price feed in real time." />
        <InfoCard title="No slippage" body="Vault operations are at the exact oracle price — no AMM curve, no spread." />
        <InfoCard title="Approved assets" body="Only assets whitelisted by the vault owner can be deposited as collateral." />
      </div>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-surface p-6">
      <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">{title}</div>
      <div className="mt-2 text-sm leading-6 text-foreground/80">{body}</div>
    </div>
  );
}
