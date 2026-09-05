export const PASSKEY_WALLET_ADDRESS =
  "0x490630168df621c98e6bba22549295a2202de358" as const;

/// Must match the deployed contract's EXPECTED_ORIGIN constant. The contract
/// rejects any assertion whose clientDataJSON origin differs, so the app has
/// to be served from exactly this origin.
export const REQUIRED_ORIGIN = "http://localhost:3000";

export const passKeyWalletAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "x", type: "uint256" },
      { name: "y", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getChallenge",
    stateMutability: "view",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "auth_data", type: "bytes" },
      { name: "client_data", type: "bytes" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ type: "bytes" }],
  },
  {
    type: "function",
    name: "nonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pubkey",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
] as const;

/**
 * Placeholder issuer for the demo-mode fixtures in lib/store.tsx.
 *
 * This slot used to hold 0xac26B144...01855, which reads like a deployment and
 * is not one -- there is no code at that address on Arbitrum Sepolia. It was
 * never on a real code path, but a plausible-looking dead address sitting in a
 * file called abi.ts is a trap for the next person. The live addresses are in
 * lib/contract.ts and nowhere else.
 */
export const DEMO_ISSUER = "0x000000000000000000000000000000000000dEaD" as const;
