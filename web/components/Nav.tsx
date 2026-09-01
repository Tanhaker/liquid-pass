"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";

/**
 * Floating pill navigation.
 *
 * Detached from the top edge rather than a full-bleed bar: it reads as a
 * control surface over the page instead of a website header, which is what
 * makes an app feel like a product rather than a document.
 */

const LINKS = [
  { href: "/market", label: "Market", icon: GridIcon },
  { href: "/dashboard", label: "My Passes", icon: RingIcon },
  { href: "/explorer", label: "Explorer", icon: PulseIcon },
  { href: "/analytics", label: "Analytics", icon: ChartIcon },
  { href: "/verify", label: "Verify", icon: CheckIcon },
  { href: "/issuer", label: "Issuer", icon: KeyIcon },
];

export function Nav() {
  const pathname = usePathname();
  const { isConnected, chainId } = useAccount();

  // RainbowKit shows its own "Wrong network" button, but the Sepolia pill
  // beside it would still read as fine, so this keeps the two in step.
  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  return (
    <div className="sticky top-0 z-50 px-4 pt-4">
      <header className="mx-auto flex max-w-6xl items-center gap-2 rounded-2xl border border-line bg-surface/70 p-2 pl-4 backdrop-blur-2xl">
        <Link href="/" className="flex items-center gap-2.5 pr-2">
          <Mark />
          <span className="text-[14px] font-semibold tracking-tight">
            Liquid<span className="text-muted">Pass</span>
          </span>
        </Link>

        <span className="hidden h-5 w-px bg-line sm:block" />

        <nav className="hidden items-center gap-0.5 sm:flex">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] transition-all ${
                  active
                    ? "bg-raised text-text shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    : "text-muted hover:bg-raised/50 hover:text-text"
                }`}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-muted md:flex">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-life-full opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-life-full" />
            </span>
            Sepolia
          </span>

          {wrongNetwork && (
            <span className="hidden rounded-lg bg-life-crit/15 px-2.5 py-1.5 text-[11px] text-life-crit sm:inline">
              Wrong network
            </span>
          )}

          {/* RainbowKit owns the connect/account/network states. Rebuilding
              them by hand is how you end up with a button that disagrees with
              the wallet it is describing. */}
          <ConnectButton
            showBalance={false}
            accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            chainStatus="none"
          />
          <ThemeToggle />
        </div>
      </header>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = require("next-themes").useTheme();
  const [mounted, setMounted] = require("react").useState(false);

  require("react").useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-8" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex size-8 items-center justify-center rounded-xl bg-raised/50 text-muted transition-colors hover:bg-raised hover:text-text"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  );
}

/** The mark is the product: a ring with a portion already spent. */
function Mark() {
  const c = 2 * Math.PI * 7;
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="7" fill="none" stroke="var(--color-line-bright)" strokeWidth="2.5" />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="var(--color-life-full)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * 0.32}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function RingIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
      <path d="M7 1.6a5.4 5.4 0 0 1 5.4 5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1 7h3l2-4 2 8 2-4h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 12V8M6 12V3M10 12V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7.4 5.4 10.8 12 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="4.6" cy="9.4" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.6 7.4 12 2M9.6 4.4l1.6 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
