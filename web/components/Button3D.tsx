"use client";

import Link from "next/link";
import React from "react";

/**
 * The physical button.
 *
 * Grunge + futuristic, per DESIGN_RULES §3: the pass is a weathered physical
 * object inside a precise technical system. So this is a stamped key that
 * actually moves -- it sits raised on a hard offset shadow, lifts under the
 * cursor, and travels down onto its own shadow when pressed.
 *
 * The depth is a hard `box-shadow` with zero blur, not a soft drop shadow.
 * A blurred shadow reads as glossy Material; a hard offset reads as screen
 * print, which is the register the rest of the UI is in.
 *
 * Motion is transform-only (translate) so it stays on the compositor, and the
 * whole travel is disabled under prefers-reduced-motion -- the button keeps
 * its depth, it just stops moving.
 */

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Uranium fill, black type. The one true CTA.
  primary:
    "bg-uranium text-black border-uranium [--btn3d-shadow:var(--color-uranium-dim,#6EB812)] hover:bg-uranium-glow",
  // Recessed panel. Used beside a primary so the pair does not read as two CTAs.
  ghost:
    "bg-dark-card text-alabaster border-dark-border [--btn3d-shadow:var(--border-strong)] hover:border-uranium hover:text-uranium",
  danger:
    "bg-dark-card text-red-300 border-red-500/60 [--btn3d-shadow:#7f1d1d] hover:bg-red-500/10",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-2 text-[11px] gap-1.5",
  md: "px-5 py-2.5 text-xs gap-2",
  lg: "px-8 py-4 text-sm gap-2",
};

type CommonProps = {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
};

function classesFor(variant: Variant, size: Size, className: string) {
  return [
    "btn3d",
    "relative inline-flex select-none items-center justify-center border",
    "font-mono font-extrabold uppercase tracking-wider",
    "outline-none focus-visible:ring-2 focus-visible:ring-uranium focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]",
    "disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].join(" ");
}

export function Button3D({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classesFor(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton3D({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: CommonProps &
  { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={classesFor(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
