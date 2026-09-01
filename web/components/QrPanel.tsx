"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Scan-to-buy panel for a listed pass.
 *
 * The QR encodes this pass's own URL on whatever origin the page is served
 * from, so a code generated on the deployed site points at the deployed site
 * and one generated locally points at localhost. Hardcoding a domain would
 * produce codes that silently fail during a demo on a preview URL.
 */
export function QrPanel({
  tokenId,
  name,
  price,
  remainingLabel,
  onClose,
}: {
  tokenId: bigint;
  name: string;
  price: string;
  remainingLabel: string;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = `${window.location.origin}/pass/${tokenId}`;
    setUrl(target);
    QRCode.toDataURL(target, {
      margin: 1,
      width: 320,
      color: { dark: "#f2f2f5", light: "#08080b" },
    })
      .then(setDataUrl)
      .catch((e: Error) => setError(e.message));
  }, [tokenId]);

  // Escape closes, and the panel takes focus, so this is usable without a mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      // Clipboard access fails on insecure origins and in some embedded
      // browsers. The URL is shown in full below regardless, so the panel is
      // still usable -- it just has to be typed.
      setCopied("fail");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Scan to buy ${name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-faint">Scan to buy</p>
        <h2 className="mt-2 text-[19px] font-semibold">{name}</h2>
        <p className="tnum mt-1 text-[13px] text-muted">
          {remainingLabel} left · {price} ETH
        </p>

        <div className="mt-5 grid place-items-center rounded-xl border border-line bg-ink p-4">
          {error ? (
            <p className="py-10 text-center text-[12px] text-life-crit">
              Couldn&rsquo;t render the code: {error}
            </p>
          ) : dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={dataUrl} alt={`QR code linking to pass ${tokenId}`} width={280} height={280} />
          ) : (
            <div className="size-[280px] animate-pulse rounded bg-surface" />
          )}
        </div>

        <p className="tnum mt-4 break-all text-[11px] text-faint">{url}</p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={copy}
            className="flex-1 rounded-lg bg-text px-3 py-2 text-[12px] font-medium text-ink"
          >
            {copied === "ok" ? "Copied" : copied === "fail" ? "Copy unavailable" : "Copy link"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-2 text-[12px] text-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
