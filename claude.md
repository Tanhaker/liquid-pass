# PassKey Wallet — Arbitrum Stylus

## What this is
A seedless smart account on Arbitrum. The user creates a wallet with a device
passkey (Face ID / Touch ID / Windows Hello / security key) and signs
transactions with it. The contract verifies a real WebAuthn assertion on-chain
using secp256r1 (P-256).

## Why this project exists — do not lose sight of this
Ethereum signs with secp256k1 and has a native precompile for it. Every
passkey authenticator signs with secp256r1 (P-256), for which the EVM has NO
precompile. Verifying P-256 in Solidity means hand-rolling 256-bit field
arithmetic and costs hundreds of thousands of gas. In Rust on Stylus it is an
audited library call.

The deliverable is a demonstration of that gap: working, deployed, and
measured. Every scoping decision should protect that demonstration.

## Deadline
Showcase 2 September 2026. Working and deployed beats feature-complete.
When forced to choose, cut scope — never cut correctness.

## Environment requirements
- Rust toolchain v1.91 or newer (rustup, rustc, cargo)
- Docker must be running — `cargo stylus check` and `deploy` require it
- Foundry (`cast`) for contract interaction
- Target chain: Arbitrum Sepolia

## THE HARD CONSTRAINT — read before writing any code
Stylus contracts must fit in **24 KB brotli-compressed WASM**. This is the
same 24KB code-size limit Ethereum applies to contracts. The `p256` crate is
not small. Whether this project is possible at all depends on fitting P-256
verification inside 24KB compressed.

`cargo stylus check` verifies this without needing a transaction. Run it early
and often. If a change pushes the binary over, say so immediately — do not
silently strip functionality to make it fit.

Size levers, in order of preference:
1. `default-features = false`, no_std, drop unused features
2. Release profile: opt-level = "z", lto = true, panic = "abort",
   codegen-units = 1, strip = true
3. `cargo stylus check` supports additional optimisation flags — check `--help`
4. Last resort: hand-roll the field arithmetic instead of using the crate

## Stack — do not add to this
- Contract: Rust + stylus-sdk (use the current release; check the version,
  do not assume), built and deployed with cargo stylus
- Crypto: `p256` crate (RustCrypto), default-features = false
- Frontend: Next.js 15 App Router, TypeScript, wagmi, viem, Tailwind
- WebAuthn: raw navigator.credentials API — no wrapper libraries
- Relayer: a plain funded EOA
- Testing: cargo test off-chain; Foundry `cast` on-chain

## Explicitly out of scope
ERC-4337, bundlers, paymasters, IPFS, subgraphs, any backend server, any
database, multi-device passkeys, social recovery, session keys, mainnet
deployment, token standards.

If I ask for any of these, remind me they are out of scope before building.

## Repo layout
```
/contracts   src/lib.rs (contract), src/webauthn.rs (verifier module)
/solidity    naive P-256 verifier — gas benchmark only
/web         Next.js frontend
/bench       gas comparison script -> results.json
```

## Correctness rules — non-negotiable

1. The message the authenticator signs is:
   `sha256(authenticatorData || sha256(clientDataJSON))`
   It is NOT the transaction hash directly.

2. The contract MUST extract the `challenge` field from clientDataJSON,
   base64url-decode it, and assert it equals the expected transaction hash.
   **Omitting this is a total security break** — any signature the user ever
   made logging into any website would authorise any transaction. A valid
   signature proves the finger was real; it does not prove the user consented
   to THIS transaction.

3. Do not JSON-parse on-chain. Locate the `"challenge":"` substring and read
   to the closing quote. Handle malformed input by reverting cleanly — never
   panic, never index out of bounds.

4. Reject high-s signatures (s > n/2) to prevent malleability.

5. Check the user-presence bit in authenticatorData flags.

6. The challenge preimage must include the nonce and this contract's address,
   so signatures cannot be replayed across transactions or contracts.

7. Follow checks-effects-interactions: increment the nonce BEFORE making the
   external call in execute().

## How I want you to work
- State your plan before writing code. Wait for my go-ahead on anything
  touching the verifier.
- Small steps. Do not generate multiple layers in one turn.
- Never claim something works unless you actually ran it and saw the output.
  Paste the output.
- If unsure about an API, crate version, or SDK signature, check the real
  docs or source. Do not guess and do not invent function signatures.
- Never fabricate test vectors, gas numbers, transaction hashes, or contract
  addresses. If you need one, ask me for it.
- Flag security concerns immediately, even if I did not ask.