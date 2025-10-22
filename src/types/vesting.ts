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

// Pool member management types
export interface PoolMember {
  id: string;
  user_wallet: string;
  token_amount: number;
  nft_count: number;
  tier: number;
  created_at: string;
  is_active: boolean;
  is_cancelled: boolean;
}

export interface PoolMembersResponse {
  success: boolean;
  members: PoolMember[];
}

// Pool state management types
export type PoolState = 'active' | 'paused' | 'cancelled';

export interface PoolStateUpdateRequest {
  action: 'pause' | 'resume' | 'cancel';
  reason?: string;
}

export interface PoolStateUpdateResponse {
  success: boolean;
  message: string;
}
