"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPublicClient, createWalletClient, custom, http, type WalletClient } from "viem";
import { xLayer, SUPPORTED_CHAIN_ID } from "@/lib/evm/chains";

type Wallet =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "error"; message: string }
  | {
      status: "connected";
      address: `0x${string}`;
      chain: { id: number; label: string };
      walletClient: WalletClient;
    };

type Ctx = {
  wallet: Wallet;
  connect: () => Promise<void>;
  disconnect: () => void;
  publicClient: ReturnType<typeof createPublicClient>;
};

const EvmContext = createContext<Ctx | null>(null);

export function useEvm(): Ctx {
  const ctx = useContext(EvmContext);
  if (!ctx) throw new Error("useEvm must be used inside <EvmProvider>");
  return ctx;
}

export function EvmProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet>({ status: "idle" });

  const publicClient = useMemo(
    () => createPublicClient({ chain: xLayer, transport: http() }),
    [],
  );

  const connect = useCallback(async () => {
    setWallet({ status: "connecting" });
    try {
      const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) {
        setWallet({ status: "error", message: "No injected wallet found" });
        return;
      }

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
      const address = accounts[0];
      if (!address) {
        setWallet({ status: "error", message: "No account returned" });
        return;
      }

      // Check current chain; prompt switch if not X Layer.
      const currentHex = (await eth.request({ method: "eth_chainId" })) as string;
      const currentId = parseInt(currentHex, 16);
      if (currentId !== SUPPORTED_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${SUPPORTED_CHAIN_ID.toString(16)}` }],
          });
        } catch {
          // Chain not added — request adding it.
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${SUPPORTED_CHAIN_ID.toString(16)}`,
                chainName: "X Layer",
                nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
                rpcUrls: ["https://rpc.xlayer.tech"],
                blockExplorerUrls: ["https://www.oklink.com/xlayer"],
              },
            ],
          });
        }
      }

      const walletClient = createWalletClient({
        account: address,
        chain: xLayer,
        transport: custom(eth as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }),
      });

      setWallet({
        status: "connected",
        address,
        chain: { id: xLayer.id, label: xLayer.name },
        walletClient,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setWallet({ status: "error", message: msg });
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ status: "idle" });
  }, []);

  // React to account/chain changes after initial connect.
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: { on?: (e: string, cb: (...a: unknown[]) => void) => void; removeListener?: (e: string, cb: (...a: unknown[]) => void) => void } }).ethereum;
    if (!eth?.on) return;

    const onAccounts = (accounts: unknown) => {
      const arr = accounts as string[];
      if (!arr || arr.length === 0) setWallet({ status: "idle" });
    };
    const onChain = () => {
      // Force a fresh connect prompt on chain change.
      setWallet({ status: "idle" });
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({ wallet, connect, disconnect, publicClient }),
    [wallet, connect, disconnect, publicClient],
  );

  return <EvmContext.Provider value={value}>{children}</EvmContext.Provider>;
}
