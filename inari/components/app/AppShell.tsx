"use client";

import { type ReactNode } from "react";
import { Sidebar, SidebarProvider, useSidebar } from "@/components/app/Sidebar";

function Content({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const padLeft = collapsed ? "md:pl-14" : "md:pl-60";
  return (
    <div className={`min-h-dvh ${padLeft} transition-[padding] duration-200`}>
      <main className="mx-auto max-w-5xl px-6 py-12 pt-16 sm:py-16 md:px-10 md:pt-16">
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-background text-foreground">
      <SidebarProvider>
        <Sidebar />
        <Content>{children}</Content>
      </SidebarProvider>
    </div>
  );
}
