import type { ReactNode } from "react";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { AppShell } from "@/components/app/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <EvmProvider>
      <AppShell>{children}</AppShell>
    </EvmProvider>
  );
}
