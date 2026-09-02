"use client";

import React, { useState } from "react";
import { usePublicClient } from "wagmi";
import { ShieldCheck, CheckCircle2, XCircle, Copy, Check, Code2, Loader2 } from "lucide-react";
import { LIQUID_PASS_ADDRESS, liquidPassAbi, shortAddress, remaining, formatRemaining } from "@/lib/contract";

export default function VerifyPage() {
  const client = usePublicClient();
  const [inputQuery, setInputQuery] = useState<string>("0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean; tokenId: string; owner?: string; issuer?: string; expiry?: number; active?: boolean; message: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const handleVerify = async (queryToRun?: string) => {
    const q = (queryToRun || inputQuery).trim();
    if (!q || !client) return;
    setLoading(true); setResult(null);
    try {
      const tokenId = BigInt(q);
      const [owner, isActive, expiry, issuer] = await Promise.all([
        client.readContract({ address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "ownerOf", args: [tokenId] }),
        client.readContract({ address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "isActive", args: [tokenId] }),
        client.readContract({ address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "expiryOf", args: [tokenId] }),
        client.readContract({ address: LIQUID_PASS_ADDRESS, abi: liquidPassAbi, functionName: "issuerOf", args: [tokenId] }),
      ]);
      const zeroAddr = "0x0000000000000000000000000000000000000000";
      if ((owner as string) === zeroAddr) {
        setResult({ isValid: false, tokenId: q, message: `Token #${q} does not exist on-chain.` });
      } else {
        const left = remaining(expiry as bigint);
        setResult({
          isValid: isActive as boolean, tokenId: q, owner: owner as string, issuer: issuer as string,
          expiry: Number(expiry as bigint), active: isActive as boolean,
          message: (isActive as boolean)
            ? `Token #${q} is ACTIVE with ${formatRemaining(left)} remaining. Access is granted.`
            : `Token #${q} exists but has EXPIRED. Access is denied.`,
        });
      }
    } catch (e) {
      setResult({ isValid: false, tokenId: q, message: `Failed to verify: ${(e as Error).message}` });
    } finally { setLoading(false); }
  };

  const integrationSnippet = `import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

const client = createPublicClient({ chain: arbitrumSepolia, transport: http() });

export async function checkAccess(tokenId: bigint): Promise<boolean> {
  const isActive = await client.readContract({
    address: '${LIQUID_PASS_ADDRESS}',
    abi: [{ name: 'isActive', type: 'function', stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [{ name: '', type: 'bool' }] }],
    functionName: 'isActive',
    args: [tokenId],
  });
  return isActive; // true = unexpired, access granted
}`;

  const handleCopyCode = () => { navigator.clipboard.writeText(integrationSnippet); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="border-b border-dark-border pb-8">
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
          <ShieldCheck className="w-3.5 h-3.5" /><span>CRYPTOGRAPHIC ACCESS VERIFIER</span>
        </div>
        <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Verify Pass &amp; Gate Access</h1>
        <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
          Instantly verify any token ID on the live Arbitrum Stylus contract. Reads isActive(), ownerOf(), and expiryOf() directly from the blockchain.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <h3 className="font-header font-bold text-xl text-alabaster border-b border-dark-border pb-4">Live On-Chain Access Checker</h3>
          <div className="space-y-3 font-mono text-xs">
            <label className="text-zincGrey block uppercase">Enter Token ID:</label>
            <div className="flex space-x-2">
              <input type="text" value={inputQuery} onChange={(e) => setInputQuery(e.target.value)} placeholder="e.g. 0, 1, 2..."
                className="flex-1 p-3 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none" />
              <button onClick={() => handleVerify()} disabled={loading}
                className="px-6 py-3 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider transition-all shadow-grunge-uranium disabled:opacity-50">
                {loading ? "CHECKING..." : "VERIFY"}
              </button>
            </div>
            <div className="pt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="text-zincGrey py-1">Quick Presets:</span>
              <button onClick={() => { setInputQuery("0"); handleVerify("0"); }} className="px-2 py-1 bg-dark border border-dark-border text-zincGrey hover:text-uranium">Token #0 (First Pass)</button>
              <button onClick={() => { setInputQuery("1"); handleVerify("1"); }} className="px-2 py-1 bg-dark border border-dark-border text-zincGrey hover:text-uranium">Token #1</button>
              <button onClick={() => { setInputQuery("9999"); handleVerify("9999"); }} className="px-2 py-1 bg-dark border border-dark-border text-zincGrey hover:text-aviation">Token #9999 (Non-existent)</button>
            </div>
          </div>

          {loading && (
            <div className="p-5 text-center font-mono text-xs text-zincGrey">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-uranium" />Querying Arbitrum Stylus contract...
            </div>
          )}

          {result && !loading && (
            <div className={`p-5 border transition-all ${result.isValid ? "bg-dark-surface border-uranium text-alabaster" : "bg-dark border-red-500/50 text-alabaster"}`}>
              <div className="flex items-start space-x-3">
                {result.isValid ? <CheckCircle2 className="w-6 h-6 text-uranium flex-shrink-0 mt-0.5" /> : <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="space-y-1 font-mono text-xs">
                  <span className={`font-bold uppercase tracking-wider text-xs block ${result.isValid ? "text-uranium" : "text-red-400"}`}>
                    {result.isValid ? "VERIFIED: ACCESS GRANTED" : "VERIFIED: ACCESS DENIED"}
                  </span>
                  <p className="font-body text-xs text-zincGrey leading-relaxed">{result.message}</p>
                  {result.owner && (
                    <div className="pt-3 border-t border-dark-border space-y-1 text-[11px]">
                      <div className="flex justify-between"><span className="text-zincGrey">Owner:</span><span className="text-alabaster font-bold">{shortAddress(result.owner)}</span></div>
                      <div className="flex justify-between"><span className="text-zincGrey">Issuer:</span><span className="text-zincGrey">{result.issuer ? shortAddress(result.issuer) : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-zincGrey">Expires:</span><span className="text-uranium">{result.expiry ? new Date(result.expiry * 1000).toLocaleString() : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-zincGrey">Status:</span><span className={result.active ? "text-uranium font-bold" : "text-red-400 font-bold"}>{result.active ? "ACTIVE" : "EXPIRED"}</span></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <div className="flex items-center space-x-2"><Code2 className="w-4 h-4 text-uranium" /><h3 className="font-header font-bold text-xl text-alabaster">Gate Any App in 3 Lines</h3></div>
            <button onClick={handleCopyCode} className="flex items-center space-x-1 px-2.5 py-1 bg-dark border border-dark-border hover:border-uranium text-alabaster font-mono text-xs transition-colors">
              {copiedCode ? (<><Check className="w-3.5 h-3.5 text-uranium" /><span className="text-uranium">COPIED</span></>) : (<><Copy className="w-3.5 h-3.5" /><span>COPY SDK</span></>)}
            </button>
          </div>
          <p className="font-body text-xs text-zincGrey leading-relaxed">
            Integrating LiquidPass into your Next.js, Node.js, or Rust application takes less than 2 minutes. Call the deployed Stylus contract view function:
          </p>
          <pre className="font-mono text-[11px] text-zincGrey-light p-4 bg-black/80 border border-dark-border overflow-x-auto leading-relaxed"><code>{integrationSnippet}</code></pre>
          <div className="p-3 bg-dark border border-dark-border text-[11px] font-mono text-zincGrey space-y-1">
            <div className="text-alabaster font-bold">Zero Backend Database Required</div>
            <p>Access status is resolved cryptographically on Arbitrum Sepolia in under 150ms.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
