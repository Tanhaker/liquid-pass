import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-2xl place-items-center px-6 py-32 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-faint">404</p>
      <h1 className="mt-4 text-[clamp(2rem,5vw,3rem)] font-semibold leading-tight tracking-[-0.03em]">
        This access window
        <br />
        has expired.
      </h1>
      <p className="mt-5 max-w-sm text-[14px] text-muted">
        The page you were looking for isn&rsquo;t here. The marketplace is still
        running.
      </p>
      <Link
        href="/market"
        className="mt-8 rounded-xl bg-text px-5 py-2.5 text-[14px] font-medium text-ink transition-opacity hover:opacity-90"
      >
        Back to the market
      </Link>
    </div>
  );
}
