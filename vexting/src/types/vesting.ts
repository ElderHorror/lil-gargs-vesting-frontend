export type AllocationType = "FIXED" | "PERCENTAGE";

export interface SnapshotRule {
  id: string;
  name: string;
  nftContract: string;
  threshold: number;
  allocationType: AllocationType;
  allocationValue: number;
  enabled: boolean;
}

export interface SnapshotConfig {
  rules: SnapshotRule[];
  poolSize: number;
  cycleStartTime: number;
  cycleDuration: number;
}

export interface SnapshotSummaryBreakdown {
  name: string;
  amount: number;
  wallets: number;
}

export interface SnapshotSummaryResponse {
  totalWallets: number;
  totalAllocated: number;
  breakdown: SnapshotSummaryBreakdown[];
}

export interface SnapshotProcessAllocationSource {
  ruleName: string;
  amount: number;
}

export interface SnapshotAllocation {
  address: string;
  amount: number;
  sources: SnapshotProcessAllocationSource[];
}

export interface SnapshotProcessResponse {
  totalWallets: number;
  totalAllocated: number;
  breakdown: Array<{
    ruleName: string;
    eligibleWallets: number;
    totalNfts: number;
    allocation: number;
  }>;
  allocations: SnapshotAllocation[];
  errors: string[];
}

export interface CollectionStatsResponse {
  totalSupply: number;
  uniqueHolders: number;
}

export interface RulePreviewResponse {
  eligibleWallets: number;
  totalNfts: number;
  estimatedAllocation: number;
}
