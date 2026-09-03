"use client";

import React, { useState } from "react";
import { useLiquidPass } from "@/lib/store";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Code2,
  Zap,
} from "lucide-react";
import { LIQUID_PASS_CONTRACT_ADDRESS } from "@/lib/abi";

export default function VerifyPage() {
  const { verifyPassAccess, userAddress } = useLiquidPass();
  const [inputQuery, setInputQuery] = useState<string>("0042");
  const [result, setResult] = useState<ReturnType<typeof verifyPassAccess> | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const handleVerify = (queryToRun?: string) => {
    const q = queryToRun || inputQuery;
    if (!q.trim()) return;
    const res = verifyPassAccess(q);
    setResult(res);
  };

  const integrationSnippet = `import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { liquidPassAbi } from '@/lib/abi';

const client = createPublicClient({ chain: arbitrumSepolia, transport: http() });

// 1. Verify user holds active pass on Stylus contract
export async function checkAccess(tokenId: bigint): Promise<boolean> {
  const isActive = await client.readContract({
    address: '${LIQUID_PASS_CONTRACT_ADDRESS}',
    abi: liquidPassAbi,
    functionName: 'isActive',
    args: [tokenId],
  });
  return isActive; // true = unexpired, access granted
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(integrationSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      
      {/* Header */}
      <div className="border-b border-dark-border pb-8">
        <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>CRYPTOGRAPHIC ACCESS VERIFIER</span>
        </div>
        <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">
          Verify Pass &amp; Gate Access
        </h1>
        <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
          Instantly check if any wallet address or token ID holds an active, unexpired subscription pass on the Arbitrum Stylus contract.
        </p>
      </div>

      {/* Main Verification Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Input & Verification Engine */}
        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-6">
          <h3 className="font-header font-bold text-xl text-alabaster border-b border-dark-border pb-4">
            Live Access Checker
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <label className="text-zincGrey block uppercase">Enter Token ID or Wallet Address:</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="e.g. 0042 or 0x39a..."
                className="flex-1 p-3 bg-dark border border-dark-border text-alabaster focus:border-uranium focus:outline-none"
              />
              <button
                onClick={() => handleVerify()}
                className="px-6 py-3 bg-uranium hover:bg-uranium-glow text-black font-extrabold uppercase tracking-wider transition-all shadow-grunge-uranium"
              >
                VERIFY
              </button>
            </div>

            {/* Quick Test Presets */}
            <div className="pt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="text-zincGrey py-1">Quick Presets:</span>
              <button
                onClick={() => {
                  setInputQuery("0042");
                  handleVerify("0042");
                }}
                className="px-2 py-1 bg-dark border border-dark-border text-zincGrey hover:text-uranium"
              >
                Figma #0042 (Valid)
              </button>
              <button
                onClick={() => {
                  setInputQuery("0088");
                  handleVerify("0088");
                }}
                className="px-2 py-1 bg-dark border border-dark-border text-zincGrey hover:text-uranium"
              >
                Cursor #0088 (Valid)
              </button>
              <button
                onClick={() => {
                  setInputQuery("9999");
                  handleVerify("9999");
                }}
                className="px-2 py-1 bg-dark border border-dark-border text-zincGrey hover:text-aviation"
              >
                Token #9999 (Non-existent)
              </button>
            </div>
          </div>

          {/* Verification Verdict Box */}
          {result && (
            <div
              className={`p-5 border transition-all ${
                result.isValid
                  ? "bg-dark-surface border-uranium text-alabaster"
                  : "bg-dark border-red-500/50 text-alabaster"
              }`}
            >
              <div className="flex items-start space-x-3">
                {result.isValid ? (
                  <CheckCircle2 className="w-6 h-6 text-uranium flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 font-mono text-xs">
                  <span
                    className={`font-bold uppercase tracking-wider text-xs block ${
                      result.isValid ? "text-uranium" : "text-red-400"
                    }`}
                  >
                    {result.isValid ? "VERIFIED: ACCESS GRANTED" : "VERIFIED: ACCESS DENIED"}
                  </span>
                  <p className="font-body text-xs text-zincGrey leading-relaxed">
                    {result.message}
                  </p>

                  {result.pass && (
                    <div className="pt-3 border-t border-dark-border space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zincGrey">Service Tier:</span>
                        <span className="text-alabaster font-bold">
                          {result.pass.service} ({result.pass.tier})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zincGrey">Contract Owner:</span>
                        <span className="text-zincGrey">{result.pass.owner}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zincGrey">Expires On:</span>
                        <span className="text-uranium">
                          {new Date(result.pass.expiryTimestamp * 1000).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right: 3-Line Developer Integration Code */}
        <div className="lg:col-span-6 p-6 bg-dark-card border border-dark-border shadow-grunge space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <div className="flex items-center space-x-2">
              <Code2 className="w-4 h-4 text-uranium" />
              <h3 className="font-header font-bold text-xl text-alabaster">
                Gate Any App in 3 Lines
              </h3>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center space-x-1 px-2.5 py-1 bg-dark border border-dark-border hover:border-uranium text-alabaster font-mono text-xs transition-colors"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-uranium" />
                  <span className="text-uranium">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY SDK</span>
                </>
              )}
            </button>
          </div>

          <p className="font-body text-xs text-zincGrey leading-relaxed">
            Integrating LiquidPass into your Next.js, Node.js, or Rust application takes less than 2 minutes. Call the deployed Stylus contract view function:
          </p>

          <pre className="font-mono text-[11px] text-zincGrey-light p-4 bg-black/80 border border-dark-border overflow-x-auto leading-relaxed">
            <code>{integrationSnippet}</code>
          </pre>

          <div className="p-3 bg-dark border border-dark-border text-[11px] font-mono text-zincGrey space-y-1">
            <div className="text-alabaster font-bold">Zero Backend Database Required</div>
            <p>Access status is resolved cryptographically on Arbitrum Sepolia in under 150ms.</p>
          </div>
        </div>

      </div>

    </div>
  );
}
