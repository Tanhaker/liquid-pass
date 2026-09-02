"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, Search, Loader2 } from "lucide-react";
import { formatEther } from "viem";
import { EXPLORER, LIQUID_PASS_ADDRESS, shortAddress } from "@/lib/contract";
import { fetchActivity, type Activity as ActivityType } from "@/lib/data";

export default function ExplorerPage() {
  const [events, setEvents] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const acts = await fetchActivity(200);
      setEvents(acts);
    } catch (e) { console.error("Failed to load activity", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredEvents = events.filter((e) => {
    if (filterType !== "ALL" && e.kind !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.tokenId.toString().includes(q) || e.txHash.toLowerCase().includes(q) || (e.who && e.who.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
            <Activity className="w-3.5 h-3.5" /><span>REAL-TIME ON-CHAIN TELEMETRY</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Stylus Contract Explorer</h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-xl">
            Live stream of subscription mints, secondary listings, ownership transfers, and 90/10 split settlements on Arbitrum Sepolia.
          </p>
        </div>
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-1.5">
          <div className="text-zincGrey text-[10px] uppercase">TARGET CONTRACT</div>
          <a href={`${EXPLORER}/address/${LIQUID_PASS_ADDRESS}`} target="_blank" rel="noreferrer" className="text-uranium hover:underline flex items-center space-x-1 font-bold">
            <span>{shortAddress(LIQUID_PASS_ADDRESS)}</span><ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <div className="text-zincGrey text-[10px]">WASM RUNTIME: Arbitrum Stylus</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 font-mono text-xs">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-zincGrey absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by token ID, address, or tx hash..."
            className="w-full pl-9 pr-4 py-2.5 bg-dark-card border border-dark-border text-alabaster focus:border-uranium focus:outline-none" />
        </div>
        <div className="md:col-span-6 flex flex-wrap gap-2">
          {["ALL", "Bought", "Listed", "Minted", "PassPurchased", "PassTransferred"].map((type) => (
            <button key={type} onClick={() => setFilterType(type)}
              className={`px-3 py-2 uppercase transition-all ${filterType === type ? "bg-uranium text-black font-extrabold" : "bg-dark-card border border-dark-border text-zincGrey hover:text-alabaster"}`}>
              {type === "ALL" ? "All Events" : type}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-dark-card border border-dark-border overflow-hidden shadow-grunge">
        {loading ? (
          <div className="p-12 text-center font-mono text-xs text-zincGrey">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-uranium" />Reading contract events from Arbitrum Sepolia...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center font-mono text-xs text-zincGrey">No events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-dark-border bg-dark text-zincGrey uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Token ID</th>
                  <th className="py-3 px-4">Value (ETH)</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Block</th>
                  <th className="py-3 px-4 text-right">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-alabaster">
                {filteredEvents.map((evt, i) => {
                  const isBought = evt.kind === "Bought";
                  const isListed = evt.kind === "Listed";
                  const isMinted = evt.kind === "Minted" || evt.kind === "PassPurchased";
                  return (
                    <tr key={`${evt.txHash}-${i}`} className="hover:bg-dark-surface/50 transition-colors">
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                          isBought ? "bg-uranium/10 border-uranium text-uranium" : isListed ? "bg-aviation/10 border-aviation text-aviation" : isMinted ? "bg-dark-surface border-dark-border text-alabaster" : "bg-dark border-dark-border text-zincGrey"
                        }`}>{evt.kind}</span>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <a href={`/pass/${evt.tokenId}`} className="text-alabaster hover:text-uranium font-bold">Token #{evt.tokenId.toString()}</a>
                        {evt.planId !== undefined && <div className="text-zincGrey text-[11px]">Plan #{evt.planId.toString()}</div>}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {evt.price !== undefined && evt.price > 0n ? <span className="text-uranium font-bold">{formatEther(evt.price)} ETH</span> : <span className="text-zincGrey">-</span>}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap text-[11px] text-zincGrey">{evt.who ? shortAddress(evt.who) : "-"}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-[11px] text-zincGrey">Block #{evt.blockNumber.toString()}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-right">
                        <a href={`${EXPLORER}/tx/${evt.txHash}`} target="_blank" rel="noreferrer" className="text-zincGrey hover:text-uranium flex items-center justify-end space-x-1 text-[11px]">
                          <span>{evt.txHash.slice(0, 10)}...</span><ArrowUpRight className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
