import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-accent-strong text-white hover:bg-accent active:bg-accent-strong/80",
  secondary: "bg-surface-2 text-foreground border border-border hover:bg-surface hover:border-accent/30",
  ghost: "text-foreground/70 hover:text-foreground hover:bg-surface-2",
  danger: "bg-foreground text-background hover:bg-foreground/90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

type CommonProps = { variant?: Variant; size?: Size; children: ReactNode; className?: string };
type ButtonProps = CommonProps & ComponentProps<"button"> & { href?: undefined };
type AnchorProps = CommonProps & ComponentProps<typeof Link> & { href: string };

export function Button(props: ButtonProps | AnchorProps) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if ("href" in props && props.href) {
    const { href, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    void _v; void _s; void _c; void _ch;
    return <Link href={href} className={cls} {...rest}>{children}</Link>;
  }
  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props as ButtonProps;
  void _v; void _s; void _c; void _ch;
  return <button className={cls} {...rest}>{children}</button>;
}
