"use client";

import { useEffect, useState } from "react";
import type { PlanMetadata } from "@/app/api/ipfs/route";
import { cidFromUri, fetchPlanMetadata } from "@/lib/ipfs";

/**
 * Renders whatever IPFS knows about a plan, and nothing at all when it can't
 * be reached.
 *
 * The rule this component exists to honour: IPFS must never be a critical
 * dependency. The plan's name, price and duration come from the chain and are
 * already on screen before this mounts. Everything here is additive, so a dead
 * gateway costs a description, not a card.
 */
export function PlanMeta({ uri }: { uri: string }) {
  const [meta, setMeta] = useState<PlanMetadata | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "missing">("idle");

  useEffect(() => {
    const cid = cidFromUri(uri);
    if (!cid) {
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    fetchPlanMetadata(uri)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setState(m ? "done" : "missing");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (state === "idle") return null;

  if (state === "loading") {
    return <p className="mt-2 text-[11px] text-faint">Reading IPFS…</p>;
  }

  if (state === "missing") {
    // Renders nothing. An earlier version said "IPFS metadata unavailable" on
    // the card, which was honest but meant every plan with an unresolvable CID
    // wore a failure line -- and the seeded demo plans all have placeholder
    // CIDs, so that was the whole marketplace. Metadata here is additive: the
    // name, price and duration beside it are already on chain and already
    // correct, so its absence is not an error worth reporting to a buyer.
    //
    // Where it IS worth reporting is the issuer console, which says up front
    // whether pinning is configured at all.
    return null;
  }

  return (
    <div className="mt-2">
      {meta?.description && (
        <p className="text-[12px] leading-relaxed text-muted">{meta.description}</p>
      )}
      <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-life-full">
        <span className="size-1 rounded-full bg-life-full" />
        via IPFS
      </p>
    </div>
  );
}
