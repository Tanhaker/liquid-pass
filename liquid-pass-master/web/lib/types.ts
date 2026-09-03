export interface SubscriptionPass {
  tokenId: string;
  name: string;
  service: string;
  serviceLogo?: string;
  owner: string;
  issuer: string;
  expiryTimestamp: number; // in seconds
  totalDurationSeconds: number; // original pass lifetime
  originalPriceEth: string; // e.g. "0.035"
  listingPriceEth?: string; // e.g. "0.012" if listed
  isListed: boolean;
  tier: "PRO" | "ENTERPRISE" | "TEAM" | "ULTRA";
  features: string[];
}

export interface OnChainEvent {
  id: string;
  type: "Minted" | "Listed" | "Bought" | "PassTransferred" | "Unlisted";
  tokenId: string;
  service: string;
  from?: string;
  to?: string;
  priceEth?: string;
  royaltyEth?: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
}

export interface MarketFilter {
  urgency: "ALL" | "EXPIRING_SOON" | "FRESH" | "UNDER_0_01_ETH";
  search: string;
  sortBy: "EXPIRY_ASC" | "PRICE_ASC" | "DISCOUNT_DESC";
}
