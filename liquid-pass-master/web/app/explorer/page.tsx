"use client";

import React, { useState } from "react";
import { useLiquidPass } from "@/lib/store";
import {
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Filter,
  CheckCircle2,
  RefreshCw,
  Search,
} from "lucide-react";
import { LIQUID_PASS_CONTRACT_ADDRESS } from "@/lib/abi";

export default function ExplorerPage() {
  const { events } = useLiquidPass();
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const filteredEvents = events.filter((e) => {
    if (filterType !== "ALL" && e.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.tokenId.includes(q) ||
        e.service.toLowerCase().includes(q) ||
        e.txHash.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
            <Activity className="w-3.5 h-3.5" />
            <span>REAL-TIME ON-CHAIN TELEMETRY</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
            Stylus Contract Explorer
          </h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            Live stream of subscription mints, secondary listings, ownership transfers, and 90/10 split settlements on Arbitrum Sepolia.
          </p>
        </div>

        {/* Contract target widget */}
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-1.5">
          <div className="text-zincGrey text-[10px] uppercase">TARGET CONTRACT</div>
          <a
            href={`https://sepolia.arbiscan.io/address/${LIQUID_PASS_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="text-uranium hover:underline flex items-center space-x-1 font-bold"
          >
            <span>{LIQUID_PASS_CONTRACT_ADDRESS.slice(0, 18)}...</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <div className="text-zincGrey text-[10px]">WASM RUNTIME: Arbitrum Stylus</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 font-mono text-xs">
        
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-zincGrey absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by token ID, service, or transaction hash..."
            className="w-full pl-9 pr-4 py-2.5 bg-dark-card border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
          />
        </div>

        <div className="md:col-span-6 flex flex-wrap gap-2">
          {["ALL", "Bought", "Listed", "Minted", "PassTransferred"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 uppercase transition-all ${
                filterType === type
                  ? "bg-uranium text-black font-extrabold"
                  : "bg-dark-card border border-dark-border text-zincGrey hover:text-alabaster"
              }`}
            >
              {type === "ALL" ? "All Events" : type}
            </button>
          ))}
        </div>

      </div>

      {/* Live Transaction Feed Table */}
      <div className="bg-dark-card border border-dark-border overflow-hidden shadow-grunge">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-dark-border bg-dark text-zincGrey uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Token &amp; Service</th>
                <th className="py-3 px-4">Value (ETH)</th>
                <th className="py-3 px-4">90/10 Split Execution</th>
                <th className="py-3 px-4">Block &amp; Tx</th>
                <th className="py-3 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border text-alabaster">
              {filteredEvents.map((evt) => {
                const isBought = evt.type === "Bought";
                const isListed = evt.type === "Listed";
                const isMinted = evt.type === "Minted";

                return (
                  <tr key={evt.id} className="hover:bg-dark-surface/50 transition-colors">
                    
                    {/* Event Type */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                          isBought
                            ? "bg-uranium/10 border-uranium text-uranium"
                            : isListed
                            ? "bg-aviation/10 border-aviation text-aviation"
                            : isMinted
                            ? "bg-dark-surface border-dark-border text-alabaster"
                            : "bg-dark border-dark-border text-zincGrey"
                        }`}
                      >
                        {evt.type}
                      </span>
                    </td>

                    {/* Token & Service */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold">{evt.service} Pass</div>
                      <div className="text-zincGrey text-[11px]">Token #{evt.tokenId}</div>
                    </td>

                    {/* Price */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {evt.priceEth ? (
                        <span className="text-uranium font-bold">{evt.priceEth} ETH</span>
                      ) : (
                        <span className="text-zincGrey">-</span>
                      )}
                    </td>

                    {/* 90/10 Settlement */}
                    <td className="py-4 px-4 whitespace-nowrap text-[11px]">
                      {isBought && evt.priceEth ? (
                        <div>
                          <span className="text-uranium">
                            Seller: {(parseFloat(evt.priceEth) * 0.9).toFixed(5)} ETH
                          </span>{" "}
                          ·{" "}
                          <span className="text-periwinkle">
                            Royalty: {(parseFloat(evt.priceEth) * 0.1).toFixed(5)} ETH
                          </span>
                        </div>
                      ) : isListed ? (
                        <span className="text-aviation">Listed for Secondary Resale</span>
                      ) : (
                        <span className="text-zincGrey">Direct Issuance</span>
                      )}
                    </td>

                    {/* Tx & Block */}
                    <td className="py-4 px-4 whitespace-nowrap text-[11px]">
                      <a
                        href={`https://sepolia.arbiscan.io/tx/${evt.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zincGrey hover:text-uranium flex items-center space-x-1"
                      >
                        <span>{evt.txHash.slice(0, 10)}...</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                      <span className="text-zincGrey-dark text-[10px]">Block #{evt.blockNumber}</span>
                    </td>

                    {/* Timestamp */}
                    <td className="py-4 px-4 whitespace-nowrap text-right text-zincGrey text-[11px]">
                      {evt.timestamp}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
