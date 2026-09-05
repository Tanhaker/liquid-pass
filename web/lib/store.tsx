"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SubscriptionPass, OnChainEvent } from "./types";
import { DEMO_ISSUER } from "./abi";

interface TxNotification {
  id: string;
  status: "pending" | "success" | "error";
  title: string;
  message: string;
  txHash?: string;
}

interface LiquidPassContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  demoPasses: SubscriptionPass[];
  events: OnChainEvent[];
  userAddress: string;
  buyPass: (tokenId: string, priceEth: string) => Promise<boolean>;
  listPass: (tokenId: string, priceEth: string) => Promise<boolean>;
  unlistPass: (tokenId: string) => Promise<boolean>;
  mintPass: (service: string, tier: "PRO" | "ENTERPRISE" | "TEAM" | "ULTRA", days: number, priceEth: string) => Promise<string>;
  txNotifications: TxNotification[];
  addNotification: (notif: Omit<TxNotification, "id">) => void;
  removeNotification: (id: string) => void;
  verifyPassAccess: (tokenIdOrAddress: string) => { isValid: boolean; pass?: SubscriptionPass; message: string };
}

const INITIAL_PASSES: SubscriptionPass[] = [
  {
    tokenId: "0042",
    name: "Figma Pro Pass",
    service: "Figma",
    owner: "0x39a...71e4",
    issuer: DEMO_ISSUER,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 19, // 19 days left
    totalDurationSeconds: 86400 * 30, // 30 days total
    originalPriceEth: "0.0020",
    listingPriceEth: "0.0012",
    isListed: true,
    tier: "PRO",
    features: ["Unlimited FigJam Files", "Dev Mode Inspections", "Shared Component Libraries"],
  },
  {
    tokenId: "0088",
    name: "Cursor Pro Copilot",
    service: "Cursor",
    owner: "0x82b...44a1",
    issuer: DEMO_ISSUER,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 3.5, // 3.5 days left -> STEAL
    totalDurationSeconds: 86400 * 30,
    originalPriceEth: "0.0035",
    listingPriceEth: "0.0004", // Huge discount
    isListed: true,
    tier: "PRO",
    features: ["Claude 3.5 Sonnet Uncapped", "Fast Premium Requests", "Multi-file Codebase Indexing"],
  },
  {
    tokenId: "0104",
    name: "Midjourney V6 Ultra",
    service: "Midjourney",
    owner: "0x14c...99e0",
    issuer: DEMO_ISSUER,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 24, // 24 days left
    totalDurationSeconds: 86400 * 30,
    originalPriceEth: "0.0060",
    listingPriceEth: "0.0048",
    isListed: true,
    tier: "ULTRA",
    features: ["30h Fast GPU Generation", "Stealth Image Mode", "Concurrent Fast Jobs"],
  },
  {
    tokenId: "0119",
    name: "Linear Team Workspace",
    service: "Linear",
    owner: "0x77d...230f",
    issuer: DEMO_ISSUER,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 14, // 14 days left
    totalDurationSeconds: 86400 * 60, // 60 days total
    originalPriceEth: "0.0045",
    listingPriceEth: "0.0011",
    isListed: true,
    tier: "TEAM",
    features: ["Unlimited Issue History", "Roadmap & Cycles Sync", "GitHub CI/CD Automation"],
  },
  {
    tokenId: "0142",
    name: "Claude 3.5 Sonnet Pro",
    service: "Claude",
    owner: "0xDEMO_USER_ACTIVE_WALLET_882", // Owned by current user
    issuer: DEMO_ISSUER,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 22,
    totalDurationSeconds: 86400 * 30,
    originalPriceEth: "0.0035",
    isListed: false,
    tier: "PRO",
    features: ["5x Usage Cap vs Free", "Artifacts Visual Sandbox", "Projects & Knowledge Bases"],
  },
  {
    tokenId: "0155",
    name: "Vercel Enterprise Edge",
    service: "Vercel",
    owner: "0xDEMO_USER_ACTIVE_WALLET_882", // Owned by current user
    issuer: DEMO_ISSUER,
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 12.5,
    totalDurationSeconds: 86400 * 30,
    originalPriceEth: "0.0080",
    listingPriceEth: "0.0033", // User listed it
    isListed: true,
    tier: "ENTERPRISE",
    features: ["Edge Middleware", "Global Edge Cache", "Advanced DDoS Mitigation"],
  }
];

const INITIAL_EVENTS: OnChainEvent[] = [
  {
    id: "evt-1",
    type: "Bought",
    tokenId: "0088",
    service: "Cursor",
    from: "0x91a...3312",
    to: "0x82b...44a1",
    priceEth: "0.0004",
    royaltyEth: "0.00004",
    txHash: "0x78f21a99b4d081e770ac92be80a5f82b70f03120194820",
    blockNumber: 42198022,
    timestamp: "2 mins ago",
  },
  {
    id: "evt-2",
    type: "Listed",
    tokenId: "0042",
    service: "Figma",
    from: "0x39a...71e4",
    priceEth: "0.0012",
    txHash: "0x41b8a1c900e47da192bfe839100234acb20195e801129",
    blockNumber: 42197980,
    timestamp: "14 mins ago",
  },
  {
    id: "evt-3",
    type: "Minted",
    tokenId: "0104",
    service: "Midjourney",
    to: "0x14c...99e0",
    txHash: "0x99201de38ba0041ca770912beef3810a9082312091238",
    blockNumber: 42197820,
    timestamp: "45 mins ago",
  },
  {
    id: "evt-4",
    type: "Bought",
    tokenId: "0119",
    service: "Linear",
    from: "0x66f...1123",
    to: "0x77d...230f",
    priceEth: "0.0011",
    royaltyEth: "0.00011",
    txHash: "0x11029abce910041289fe0019238bcde29104882103982",
    blockNumber: 42197510,
    timestamp: "1 hour ago",
  },
  {
    id: "evt-5",
    type: "PassTransferred",
    tokenId: "0142",
    service: "Claude",
    from: "0x0000000000000000000000000000000000000000",
    to: "0xDEMO_USER_ACTIVE_WALLET_882",
    txHash: "0x55102919abcc012891398bbec01929481023910283019",
    blockNumber: 42197100,
    timestamp: "3 hours ago",
  }
];

const LiquidPassContext = createContext<LiquidPassContextType | undefined>(undefined);

export function LiquidPassProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [passes, setPasses] = useState<SubscriptionPass[]>(INITIAL_PASSES);
  const [events, setEvents] = useState<OnChainEvent[]>(INITIAL_EVENTS);
  const [notifications, setNotifications] = useState<TxNotification[]>([]);
  const userAddress = "0xDEMO_USER_ACTIVE_WALLET_882";

  const addNotification = (notif: Omit<TxNotification, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { ...notif, id }]);
    setTimeout(() => {
      removeNotification(id);
    }, 6500);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => {
      const next = !prev;
      addNotification({
        status: "success",
        title: next ? "DEMO MODE ACTIVATED" : "CONNECTED TO ON-CHAIN RPC",
        message: next
          ? "Simulated wallet enabled: testing all buyer/seller/issuer flows."
          : "Wired to Stylus contract on Arbitrum Sepolia (0xe670...1f84)",
      });
      return next;
    });
  };

  const buyPass = async (tokenId: string, priceEth: string): Promise<boolean> => {
    addNotification({
      status: "pending",
      title: "TRANSACTION BROADCASTING",
      message: `Executing buy() on Stylus contract for Token #${tokenId} (${priceEth} ETH)...`,
    });

    await new Promise((r) => setTimeout(r, 1200));

    let passName = `Pass #${tokenId}`;
    setPasses((prev) =>
      prev.map((p) => {
        if (p.tokenId === tokenId) {
          passName = p.name;
          return {
            ...p,
            owner: userAddress,
            isListed: false,
            listingPriceEth: undefined,
          };
        }
        return p;
      })
    );

    const newEvent: OnChainEvent = {
      id: `evt-${Date.now()}`,
      type: "Bought",
      tokenId,
      service: passName.split(" ")[0],
      from: "Previous Owner",
      to: userAddress,
      priceEth,
      royaltyEth: (parseFloat(priceEth) * 0.1).toFixed(5),
      txHash: `0x${Math.random().toString(16).substring(2, 42)}`,
      blockNumber: 42198000 + events.length + 1,
      timestamp: "Just now",
    };

    setEvents((prev) => [newEvent, ...prev]);

    addNotification({
      status: "success",
      title: "PASS ACQUIRED & TRANSFERRED",
      message: `Token #${tokenId} transferred to ${userAddress.slice(0, 10)}... 90% paid to seller, 10% royalty to issuer.`,
      txHash: newEvent.txHash.slice(0, 14) + "...",
    });

    return true;
  };

  const listPass = async (tokenId: string, priceEth: string): Promise<boolean> => {
    addNotification({
      status: "pending",
      title: "SUBMITTING LISTING",
      message: `Calling list(#${tokenId}, ${priceEth} ETH) on Stylus contract...`,
    });

    await new Promise((r) => setTimeout(r, 1000));

    let passName = `Pass #${tokenId}`;
    setPasses((prev) =>
      prev.map((p) => {
        if (p.tokenId === tokenId) {
          passName = p.name;
          return {
            ...p,
            isListed: true,
            listingPriceEth: priceEth,
          };
        }
        return p;
      })
    );

    const newEvent: OnChainEvent = {
      id: `evt-${Date.now()}`,
      type: "Listed",
      tokenId,
      service: passName.split(" ")[0],
      from: userAddress,
      priceEth,
      txHash: `0x${Math.random().toString(16).substring(2, 42)}`,
      blockNumber: 42198000 + events.length + 1,
      timestamp: "Just now",
    };

    setEvents((prev) => [newEvent, ...prev]);

    addNotification({
      status: "success",
      title: "PASS LISTED ON MARKETPLACE",
      message: `Token #${tokenId} is now discoverable on LiquidPass Market for ${priceEth} ETH.`,
      txHash: newEvent.txHash.slice(0, 14) + "...",
    });

    return true;
  };

  const unlistPass = async (tokenId: string): Promise<boolean> => {
    addNotification({
      status: "pending",
      title: "CANCELLING LISTING",
      message: `Calling unlist(#${tokenId}) on Stylus contract...`,
    });

    await new Promise((r) => setTimeout(r, 900));

    setPasses((prev) =>
      prev.map((p) => {
        if (p.tokenId === tokenId) {
          return {
            ...p,
            isListed: false,
            listingPriceEth: undefined,
          };
        }
        return p;
      })
    );

    addNotification({
      status: "success",
      title: "LISTING WITHDRAWN",
      message: `Token #${tokenId} returned to private vault inventory.`,
    });

    return true;
  };

  const mintPass = async (
    service: string,
    tier: "PRO" | "ENTERPRISE" | "TEAM" | "ULTRA",
    days: number,
    priceEth: string
  ): Promise<string> => {
    const newId = `0${(200 + passes.length + 1).toString()}`;
    addNotification({
      status: "pending",
      title: "ISSUING TIME-BOUND PASS",
      message: `Calling mint(${userAddress.slice(0, 8)}..., ${days * 86400}s) from Issuer...`,
    });

    await new Promise((r) => setTimeout(r, 1300));

    const newPass: SubscriptionPass = {
      tokenId: newId,
      name: `${service} ${tier} Pass`,
      service,
      owner: userAddress,
      issuer: DEMO_ISSUER,
      expiryTimestamp: Math.floor(Date.now() / 1000) + days * 86400,
      totalDurationSeconds: days * 86400,
      originalPriceEth: priceEth,
      isListed: false,
      tier,
      features: ["Full Platform Access", "Resellable on LiquidPass", "On-chain Time Decay"],
    };

    setPasses((prev) => [newPass, ...prev]);

    const newEvent: OnChainEvent = {
      id: `evt-${Date.now()}`,
      type: "Minted",
      tokenId: newId,
      service,
      to: userAddress,
      txHash: `0x${Math.random().toString(16).substring(2, 42)}`,
      blockNumber: 42198000 + events.length + 1,
      timestamp: "Just now",
    };

    setEvents((prev) => [newEvent, ...prev]);

    addNotification({
      status: "success",
      title: "PASS ISSUED ON-CHAIN",
      message: `Minted ${service} Pass #${newId} with ${days} days duration.`,
      txHash: newEvent.txHash.slice(0, 14) + "...",
    });

    return newId;
  };

  const verifyPassAccess = (tokenIdOrAddress: string) => {
    const query = tokenIdOrAddress.trim().toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    // Try finding by token ID
    let found = passes.find((p) => p.tokenId.toLowerCase() === query);

    // If not found, try finding active pass by owner address
    if (!found) {
      found = passes.find(
        (p) => p.owner.toLowerCase() === query && p.expiryTimestamp > now
      );
    }

    if (!found) {
      return {
        isValid: false,
        message: "No active subscription pass found for this token ID or address.",
      };
    }

    const isExpired = found.expiryTimestamp <= now;
    if (isExpired) {
      return {
        isValid: false,
        pass: found,
        message: `Pass #${found.tokenId} expired on ${new Date(found.expiryTimestamp * 1000).toLocaleDateString()}. Access lapsed.`,
      };
    }

    const remainingDays = ((found.expiryTimestamp - now) / 86400).toFixed(1);
    return {
      isValid: true,
      pass: found,
      message: `PASS VALID · Grants access to ${found.service} (${found.tier}) with ${remainingDays} days remaining.`,
    };
  };

  return (
    <LiquidPassContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        demoPasses: passes,
        events,
        userAddress,
        buyPass,
        listPass,
        unlistPass,
        mintPass,
        txNotifications: notifications,
        addNotification,
        removeNotification,
        verifyPassAccess,
      }}
    >
      {children}
    </LiquidPassContext.Provider>
  );
}

export function useLiquidPass() {
  const context = useContext(LiquidPassContext);
  if (!context) {
    throw new Error("useLiquidPass must be used within a LiquidPassProvider");
  }
  return context;
}
