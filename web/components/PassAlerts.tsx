"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Bell, BellOff } from "lucide-react";
import { fetchPasses, fetchPlans } from "@/lib/data";
import { useLiquidPass } from "@/lib/store";
import { alertsOn, collectAlerts, setAlertsOn } from "@/lib/alerts";

/**
 * Watches the connected wallet's passes while any Liquid Pass page is open and
 * raises an alert when a listing sells, a pass is about to expire, or an
 * auto-sell rule fires. Off until the holder turns it on (AlertsToggle).
 *
 * In-page notices use the site's existing toasts; a system notification is
 * shown too when the browser allows it. See lib/alerts.ts for the rules.
 */

const POLL_MS = 60_000;
const EVENT = "liquid-pass-alerts-changed";

export function PassAlerts() {
  const { address } = useAccount();
  const { addNotification } = useLiquidPass();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(alertsOn());
    const sync = () => setOn(alertsOn());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const check = useCallback(async () => {
    if (!address || document.visibilityState !== "visible") return;
    try {
      const [passes, plans] = await Promise.all([fetchPasses(), fetchPlans()]);
      const names = new Map(plans.map((p) => [p.id.toString(), p.name]));
      const alerts = collectAlerts(address, passes, (p) => names.get(p.planId.toString()) || `Pass #${p.tokenId}`, Date.now());
      for (const a of alerts) {
        addNotification({ status: "success", title: a.title, message: a.message });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification(a.title, { body: a.message, icon: "/Logo.png", tag: a.key });
          n.onclick = () => {
            window.focus();
            window.location.href = a.href;
          };
        }
      }
    } catch {
      // A failed read is retried on the next tick.
    }
    // addNotification comes from context and is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (!on || !address) return;
    void check();
    const id = setInterval(() => void check(), POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [on, address, check]);

  return null;
}

/** The switch, shown on My Passes. Asks the browser for permission when turned on. */
export function AlertsToggle() {
  const [on, setOn] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setOn(alertsOn());
    setBlocked(typeof Notification !== "undefined" && Notification.permission === "denied");
  }, []);

  async function toggle() {
    const next = !on;
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      const answer = await Notification.requestPermission();
      setBlocked(answer === "denied");
    }
    setAlertsOn(next);
    setOn(next);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => void toggle()}
        aria-pressed={on}
        className={`flex w-full items-center justify-between gap-3 border px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
          on ? "border-uranium bg-uranium/10 text-uranium" : "border-dark-border bg-dark text-zincGrey hover:border-uranium hover:text-alabaster"
        }`}
      >
        <span className="flex items-center gap-2">
          {on ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          PASS ALERTS
        </span>
        <span className="font-bold">{on ? "ON" : "OFF"}</span>
      </button>
      <p className="text-[10px] normal-case leading-snug text-zincGrey">
        {on
          ? blocked
            ? "On, as notices on this site. Your browser blocks system notifications."
            : "Sale, expiry and rule alerts while a Liquid Pass tab is open."
          : "Get told when a listing sells, a pass nears expiry or a rule fires."}
      </p>
    </div>
  );
}
