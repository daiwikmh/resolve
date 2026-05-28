"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { WalletButton } from "@/components/app/WalletButton";

type NavItem = {
  href: string;
  label: string;
  letter: string;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { href: "/app", label: "Swap", letter: "S" },
  { href: "/app/status", label: "Oracle", letter: "O" },
  { href: "/app/brakes", label: "Vault", letter: "V" },
  { href: "/app/docs", label: "Docs", letter: "D" },
];

const STORAGE_KEY = "Inari:sidebar-collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggle, mobileOpen, setMobileOpen }),
    [collapsed, toggle, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

function activeHref(pathname: string): string | null {
  let match: string | null = null;
  for (const item of NAV) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!match || item.href.length > match.length) match = item.href;
    }
  }
  return match;
}

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 px-3 py-4 text-foreground"
      aria-label="Inari home"
    >
      <span className="inline-block h-3 w-3 shrink-0 rotate-45 border-2 border-accent" />
      {!collapsed && <span className="font-serif text-lg leading-none">Inari</span>}
    </Link>
  );
}

function NavList({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = activeHref(pathname);
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2">
      {NAV.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              "group flex items-center gap-3 rounded-r-md border-l-2 px-3 py-2 font-mono text-[13px] transition-colors " +
              (isActive
                ? "border-accent bg-surface text-foreground"
                : "border-transparent text-foreground/55 hover:text-foreground hover:bg-surface/60")
            }
            aria-current={isActive ? "page" : undefined}
          >
            {collapsed ? (
              <span className="mx-auto inline-flex h-6 w-6 items-center justify-center text-[13px]">
                {item.letter}
              </span>
            ) : (
              <>
                <span className="inline-flex h-6 w-6 items-center justify-center text-[12px] text-foreground/40 group-hover:text-foreground/70">
                  {item.letter}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-foreground/40">
                    soon
                  </span>
                )}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ collapsed, toggle }: { collapsed: boolean; toggle: () => void }) {
  return (
    <div className="border-t border-foreground/15 px-2 py-3">
      <div
        className={
          collapsed
            ? "flex flex-col items-center gap-2"
            : "flex items-center justify-between gap-2"
        }
      >
        {collapsed ? (
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-accent"
            title="Wallet"
          />
        ) : (
          <WalletButton />
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground/50 transition-colors hover:text-foreground hover:bg-surface"
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname() ?? "/app";
  const width = collapsed ? "w-14" : "w-60";

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/90 text-foreground/70 backdrop-blur md:hidden"
      >
        <span className="flex flex-col gap-[3px]">
          <span className="block h-[2px] w-4 bg-current" />
          <span className="block h-[2px] w-4 bg-current" />
          <span className="block h-[2px] w-4 bg-current" />
        </span>
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden ${width} flex-col border-r border-foreground/15 bg-background transition-[width] duration-200 md:flex`}
      >
        <BrandMark collapsed={collapsed} />
        <NavList pathname={pathname} collapsed={collapsed} />
        <Footer collapsed={collapsed} toggle={toggle} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-foreground/15 bg-background">
            <div className="flex items-center justify-between pr-3">
              <BrandMark collapsed={false} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground/50"
              >
                ✕
              </button>
            </div>
            <NavList
              pathname={pathname}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
            <Footer collapsed={false} toggle={toggle} />
          </aside>
        </div>
      )}
    </>
  );
}
