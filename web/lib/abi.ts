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

export const LIQUID_PASS_CONTRACT_ADDRESS = "0xac26B1441B1Fce3B2f520bDFc67d64F7BEE01855" as const;
