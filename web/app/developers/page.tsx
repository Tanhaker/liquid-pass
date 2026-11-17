"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Code2, Copy, FileCode2, Server, ScanLine } from "lucide-react";
import { EXPLORER, LIQUID_PASS_ADDRESS, MARKETPLACE_ADDRESS, STREAM_RENTAL_ADDRESS, shortAddress } from "@/lib/contract";

/**
 * Integrating Liquid Pass, for the SaaS company on the other side.
 *
 * The proposal's roadmap calls this the Issuer SDK. At hackathon scale it is
 * three snippets, because that is all an integration needs: the contract is
 * public and its views are free to call. Each snippet is the same logic
 * LiquidDesk and the check-in scanner run in production.
 */

const REPO = "https://github.com/Tanhaker/liquid-pass";

const CHECK = `import { createPublicClient, http, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";

const client = createPublicClient({ chain: arbitrumSepolia, transport: http() });
const CORE = "${LIQUID_PASS_ADDRESS}";
const core = parseAbi([
  "function ownerOf(uint256) view returns (address)",
  "function isActive(uint256) view returns (bool)",
  "function issuerOf(uint256) view returns (address)",
]);

/** True while \`wallet\` holds pass \`tokenId\`, it has time left, and it is yours. */
export async function holdsPass(wallet: string, tokenId: bigint, issuer: string) {
  const read = (functionName: "ownerOf" | "isActive" | "issuerOf") =>
    client.readContract({ address: CORE, abi: core, functionName, args: [tokenId] });
  const [owner, active, by] = await Promise.all([read("ownerOf"), read("isActive"), read("issuerOf")]);
  return active && String(owner).toLowerCase() === wallet.toLowerCase()
    && String(by).toLowerCase() === issuer.toLowerCase();
}`;

const GATE = `// 1. Prove the visitor controls the wallet: a free, one-time signed message.
import { verifyMessage } from "viem";

const message = \`\${host} wants you to sign in with your wallet:\\n\${address}\\n\\nNonce: \${nonce}\`;
const valid = await verifyMessage({ address, message, signature });
if (!valid) return new Response("Bad signature", { status: 401 });

// 2. Keep the address in a signed, httpOnly cookie -- your own session.

// 3. On EVERY request to a paid feature, ask the chain again. No cache, no
//    revocation list: a sold pass is refused on the seller's next request.
if (!(await holdsPass(session.address, tokenId, YOUR_ISSUER_ADDRESS))) {
  return new Response("This wallet does not hold an active pass", { status: 403 });
}`;

const DOOR = `import { recoverMessageAddress } from "viem";

// The door shows a QR with a random, one-time challenge. The holder's wallet
// signs it; the door recovers the signer and checks the chain.
const message = [
  "Liquid Pass check-in", "", \`Venue: \${venue}\`, \`Pass: #\${tokenId}\`,
  \`Challenge: \${nonce}\`, \`Valid until: \${new Date(expires * 1000).toISOString()}\`,
  "", "Signing is free and does not send a transaction.",
].join("\\n");

const signer = await recoverMessageAddress({ message, signature });
const admit = !used.has(nonce) && Date.now() / 1000 < expires
  && (await holdsPass(signer, BigInt(tokenId), YOUR_ISSUER_ADDRESS));
if (admit) used.add(nonce); // each code works once`;

export default function DevelopersPage() {
  return (
    <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-dark-border pb-8 gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-dark-card border border-dark-border text-uranium font-mono text-xs uppercase mb-2">
            <Code2 className="w-3.5 h-3.5" /><span>FOR SAAS COMPANIES // INTEGRATION GUIDE</span>
          </div>
          <h1 className="font-header font-extrabold text-3xl sm:text-5xl text-alabaster tracking-tight">Accept Liquid Pass in Your App</h1>
          <p className="font-body text-zincGrey text-sm mt-2 max-w-2xl">
            No SDK to install, no API key and no account with us. The contract is public and its checks are free to call.
            These are the exact checks LiquidDesk and the check-in scanner run.
          </p>
        </div>
        <div className="p-4 bg-dark-card border border-dark-border font-mono text-xs space-y-2 md:min-w-[300px]">
          {[
            ["CORE (RUST / STYLUS)", LIQUID_PASS_ADDRESS],
            ["MARKETPLACE", MARKETPLACE_ADDRESS],
            ["STREAM RENTAL", STREAM_RENTAL_ADDRESS],
          ].map(([label, addr]) => (
            <div key={label} className="flex items-center justify-between gap-6 text-zincGrey">
              <span>{label}:</span>
              <a href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer" className="text-uranium font-bold hover:underline">
                {shortAddress(addr)}
              </a>
            </div>
          ))}
          <div className="text-zincGrey">NETWORK: Arbitrum Sepolia (421614)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { icon: <FileCode2 className="w-4 h-4 text-uranium" />, step: "01", title: "Create a plan", body: "Ask for issuer access on the Issuer page, then publish a plan: name, price, length. Every resale of it pays you 10%." },
          { icon: <Server className="w-4 h-4 text-uranium" />, step: "02", title: "Gate your app", body: "Sign the visitor in with their wallet and check the pass on every request to a paid feature." },
          { icon: <ScanLine className="w-4 h-4 text-uranium" />, step: "03", title: "Or gate a door", body: "For a venue, use the signed QR challenge so a screenshot of a pass cannot be reused." },
        ].map((s) => (
          <div key={s.step} className="p-5 bg-dark-card border border-dark-border shadow-grunge space-y-2">
            <div className="flex items-center gap-2">{s.icon}<span className="font-mono text-xs font-bold text-uranium">{s.step}</span><h3 className="font-header font-bold text-lg text-alabaster">{s.title}</h3></div>
            <p className="font-body text-xs text-zincGrey leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <Snippet title="The access check" note="One function. Three free reads: who holds the pass, is there time left, and is it one of yours." code={CHECK} />
      <Snippet title="Gate a web app" note="What LiquidDesk does: wallet sign-in once, then the check above on every request." code={GATE} source={`${REPO}/tree/master/liquiddesk`} />
      <Snippet title="Gate a physical door" note="What the check-in scanner does: a signed one-time challenge, accepted once." code={DOOR} source={`${REPO}/blob/master/web/lib/checkin.ts`} />

      <div className="flex flex-wrap gap-3 font-mono text-xs uppercase tracking-wider">
        <Link href="/issuer" className="inline-flex items-center gap-2 px-5 py-3 bg-uranium hover:bg-uranium-glow text-black font-extrabold shadow-grunge-uranium">
          BECOME AN ISSUER <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <a href={process.env.NEXT_PUBLIC_LIQUIDDESK_URL || "https://desk.liquidpass.xyz"} className="inline-flex items-center gap-2 px-5 py-3 bg-dark border border-dark-border hover:border-uranium text-alabaster hover:text-uranium">
          SEE IT RUNNING IN LIQUIDDESK <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
        <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 bg-dark border border-dark-border hover:border-uranium text-alabaster hover:text-uranium">
          SOURCE ON GITHUB <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

function Snippet({ title, note, code, source }: { title: string; note: string; code: string; source?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="p-6 bg-dark-card border border-dark-border shadow-grunge space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-dark-border pb-4">
        <div className="flex items-center space-x-2 min-w-0"><Code2 className="w-4 h-4 text-uranium flex-shrink-0" /><h3 className="font-header font-bold text-xl text-alabaster truncate">{title}</h3></div>
        <button
          onClick={() => {
            navigator.clipboard
              .writeText(code)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => undefined);
          }}
          className="flex items-center space-x-1 px-2.5 py-1 bg-dark border border-dark-border hover:border-uranium text-alabaster font-mono text-xs transition-colors whitespace-nowrap"
        >
          {copied ? (<><Check className="w-3.5 h-3.5 text-uranium" /><span className="text-uranium">COPIED</span></>) : (<><Copy className="w-3.5 h-3.5" /><span>COPY</span></>)}
        </button>
      </div>
      <p className="font-body text-xs text-zincGrey leading-relaxed">
        {note}
        {source && (
          <>
            {" "}
            <a href={source} target="_blank" rel="noreferrer" className="text-uranium hover:underline">Full source</a>.
          </>
        )}
      </p>
      <pre className="font-mono text-[11px] text-zincGrey-light p-4 bg-black/80 border border-dark-border overflow-x-auto leading-relaxed"><code>{code}</code></pre>
    </section>
  );
}
