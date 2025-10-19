"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/dashboard/StatCard";
import { RuleTable } from "@/components/dashboard/RuleTable";
import { ClaimsPolicyPanel } from "@/components/dashboard/ClaimsPolicyPanel";
import { TreasuryWidget } from "@/components/dashboard/TreasuryWidget";
import { EditRuleModal } from "@/components/dashboard/EditRuleModal";
import { AddRuleModal } from "@/components/dashboard/AddRuleModal";
import type {
  SnapshotRule,
  SnapshotSummaryResponse,
  // RulePreviewResponse,
  // SnapshotProcessResponse,
  SnapshotConfig,
} from "@/types/vesting";
import { api } from "@/lib/api";
// import { cn } from "@/lib/utils";
import { formatTokenAmount } from "@/lib/formatters";

type DashboardViewProps = {
  initialRules: SnapshotRule[];
  initialSummary: SnapshotSummaryResponse | null;
  initialMetrics?: {
    poolBalance: number;
    eligibleWallets: number;
    nextUnlock: string;
    cycleWindow: {
      start: string;
      end: string;
      daysRemaining: number;
    };
  } | null;
};

type DashboardMetrics = {
  poolBalance: number;
  unlockCadence: string;
  eligibleWallets: number;
  nextUnlockCountdown: string;
  refillRequired: boolean;
  cycleWindow?: {
    start: string;
    end: string;
    daysRemaining: number;
  };
};

const INITIAL_METRICS: DashboardMetrics = {
  poolBalance: 5_000_000_000,
  unlockCadence: "Daily",
  eligibleWallets: 0,
  nextUnlockCountdown: "11h",
  refillRequired: false,
};

export function DashboardView({ initialRules, initialSummary, initialMetrics }: DashboardViewProps) {
  const [rules, setRules] = useState<SnapshotRule[]>(initialRules || []);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    ...INITIAL_METRICS,
    ...(initialMetrics && {
      poolBalance: initialMetrics.poolBalance,
      eligibleWallets: initialMetrics.eligibleWallets,
      nextUnlockCountdown: initialMetrics.nextUnlock,
      cycleWindow: initialMetrics.cycleWindow,
    }),
  });
  const [summary, setSummary] = useState<SnapshotSummaryResponse | null>(initialSummary);
  // const [allocationResult, setAllocationResult] = useState<SnapshotProcessResponse | null>(null);
  // const [collectionPreview, setCollectionPreview] = useState<RulePreviewResponse | null>(null);
  // const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refillModalOpen, setRefillModalOpen] = useState(false);
  const [refillAmount, setRefillAmount] = useState("");
  const [refillLoading, setRefillLoading] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);
  const [activityLogs, setActivityLogs] = useState<Array<Record<string, unknown>>>([]);
  const [editRuleModalOpen, setEditRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SnapshotRule | null>(null);
  const [activePoolId, setActivePoolId] = useState<string | null>(null);
  const [streamflowStatus, setStreamflowStatus] = useState<Record<string, unknown> | null>(null);
  const [availablePools, setAvailablePools] = useState<Array<Record<string, unknown>>>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [poolVestingMode, setPoolVestingMode] = useState<string | null>(null);
  const [addRuleModalOpen, setAddRuleModalOpen] = useState(false);

  useEffect(() => {
    if (initialSummary) return;
    refreshSummary();
    loadActivePoolData();
    loadActivityLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load active pool data from backend
  async function loadActivePoolData() {
    try {
      console.log("Loading pool data...");
      const pools = await api.get<Array<Record<string, unknown>>>("/pools");
      console.log("Pools loaded:", pools);
      
      // Store all pools for selector
      setAvailablePools(pools || []);
      
      if (pools && pools.length > 0) {
        const activePool = pools.find((p: Record<string, unknown>) => p.isActive) || pools[0];
        console.log("Active pool:", activePool);
        
        // Store active pool ID for editing
        setActivePoolId(String(activePool.id));
        setSelectedPoolId(String(activePool.id));
        setPoolVestingMode(activePool.vestingMode as "snapshot" | "dynamic" | "manual");
        
        // Update metrics with real pool data
        setMetrics((prev) => ({
          ...prev,
          poolBalance: (activePool.totalAmount as number) || prev.poolBalance,
        }));

        // Load snapshot rules from pool's nft_requirements
        // Note: This requires fetching the full pool details with nft_requirements field
        try {
          const poolDetails = await api.get<Record<string, unknown>>(`/pools/${String(activePool.id)}`);
          console.log("Pool details:", poolDetails);
          
          if (poolDetails?.nftRequirements && Array.isArray(poolDetails.nftRequirements) && poolDetails.nftRequirements.length > 0) {
            // Convert nft_requirements to SnapshotRule format
            const loadedRules: SnapshotRule[] = poolDetails.nftRequirements.map((req: Record<string, unknown>, index: number) => ({
              id: `rule-${index}`,
              name: String(req.name || `Rule ${index + 1}`),
              nftContract: String(req.collection || req.nftContract || ''),
              threshold: Number(req.min_nfts || req.threshold || 1),
              allocationType: String(req.allocationType || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED',
              allocationValue: Number(req.allocationValue || req.pool_percent || 0),
              enabled: true,
            }));
            
            setRules(loadedRules);
            console.log("Loaded rules from pool:", loadedRules);
          }
        } catch (err) {
          console.error("Failed to load pool details:", err);
        }

        // Get eligible wallets count and total allocated
        try {
          const vestings = await api.get<Array<Record<string, unknown>>>(`/pools/${activePool.id}/activity`);
          console.log("Vestings loaded:", vestings);
          
          if (vestings && vestings.length > 0) {
            const totalAllocated = vestings.reduce((sum: number, v: Record<string, unknown>) => sum + Number(v.token_amount), 0);
            
            setMetrics((prev) => ({
              ...prev,
              eligibleWallets: vestings.length,
            }));

            // Update summary with real data
            setSummary((prev) => ({
              ...prev,
              totalWallets: vestings.length,
              totalAllocated: totalAllocated,
              breakdown: prev?.breakdown || [],
            }));
          }
        } catch (err) {
          console.error("Failed to load vestings count:", err);
        }

        // Load Streamflow status
        try {
          const status = await api.get<Record<string, unknown>>(`/pools/${activePool.id}/streamflow-status`);
          setStreamflowStatus(status);
          console.log("Streamflow status:", status);
        } catch (err) {
          console.error("Failed to load Streamflow status:", err);
        }
      }
    } catch (err) {
      console.error("Failed to load pool data:", err);
    }
  }

  // Handle pool selection change
  async function handlePoolChange(poolId: string) {
    setSelectedPoolId(poolId);
    setActivePoolId(poolId);
    
    // Find selected pool to get vesting mode
    const selectedPool = availablePools.find(p => p.id === poolId);
    if (selectedPool) {
      setPoolVestingMode(selectedPool.vestingMode as "snapshot" | "dynamic" | "manual");
    }
    
    // Reload data for selected pool
    try {
      const poolDetails = await api.get<Record<string, unknown>>(`/pools/${poolId}`);
      
      // Update metrics
      setMetrics((prev) => ({
        ...prev,
        poolBalance: (poolDetails.totalAmount as number) || prev.poolBalance,
      }));
      
      // Load rules if available
      if (poolDetails.nftRequirements && Array.isArray(poolDetails.nftRequirements)) {
        const loadedRules: SnapshotRule[] = poolDetails.nftRequirements.map((req: Record<string, unknown>, index: number) => ({
          id: `rule-${index}`,
          name: String(req.name || `Rule ${index + 1}`),
          nftContract: String(req.collection || req.nftContract || ''),
          threshold: Number(req.min_nfts || req.threshold || 1),
          allocationType: String(req.allocationType || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED',
          allocationValue: Number(req.allocationValue || req.pool_percent || 0),
          enabled: true,
        }));
        setRules(loadedRules);
      }
      
      // Load Streamflow status
      const status = await api.get<Record<string, unknown>>(`/pools/${poolId}/streamflow-status`);
      setStreamflowStatus(status);
      
      // Load vestings count
      const vestings = await api.get<Array<Record<string, unknown>>>(`/pools/${poolId}/activity`);
      if (vestings && vestings.length > 0) {
        const totalAllocated = vestings.reduce((sum: number, v: Record<string, unknown>) => sum + Number(v.token_amount), 0);
        setMetrics((prev) => ({
          ...prev,
          eligibleWallets: vestings.length,
        }));
        setSummary((prev) => ({
          ...prev,
          totalWallets: vestings.length,
          totalAllocated: totalAllocated,
          breakdown: prev?.breakdown || [],
        }));
      }
    } catch (err) {
      console.error("Failed to load pool data:", err);
    }
  }

  function toggleRule(id: string) {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  }

  function handleEdit(rule: SnapshotRule) {
    setEditingRule(rule);
    setEditRuleModalOpen(true);
  }

  function handleEditSuccess() {
    setEditRuleModalOpen(false);
    setEditingRule(null);
    // Reload pool data
    loadActivePoolData();
  }

  function handleAddRuleSuccess() {
    setAddRuleModalOpen(false);
    // Reload pool data to show new rule
    loadActivePoolData();
  }

  // Load activity logs from backend
  async function loadActivityLogs() {
    try {
      const logs = await api.get<Array<Record<string, unknown>>>("/admin-logs");
      setActivityLogs(logs || []);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    }
  }

  function refreshSummary() {
    // startTransition(async () => {
    (async () => {
      setError(null);
      try {
        const payload = buildSnapshotConfig();
        const data = await api.post<SnapshotSummaryResponse>("/snapshot/calculate-summary", {
          config: payload,
        });
        setSummary(data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to fetch summary");
      }
    })();
  }

  /* function runAllocationPreview() {
    startTransition(async () => {
      setError(null);
      try {
        const payload = buildSnapshotConfig();
        const data = await api.post<SnapshotProcessResponse>("/snapshot/process", {
          config: payload,
        });
        setAllocationResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process snapshot");
      }
    });
  } */

  /* function previewCollection(rule: SnapshotRule) {
    startTransition(async () => {
      setError(null);
      try {
        const data = await api.post<RulePreviewResponse>("/snapshot/preview-rule", {
          rule,
          poolSize: buildSnapshotConfig().poolSize,
        });
        setCollectionPreview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to preview rule");
      }
    });
  } */

  function buildSnapshotConfig(): SnapshotConfig {
    return {
      rules,
      poolSize: metrics.poolBalance,
      cycleStartTime: Math.floor(Date.now() / 1000),
      cycleDuration: 24 * 60 * 60,
    };
  }

  // const breakdown = summary?.breakdown ?? [];

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pool Balance"
          value={Boolean(streamflowStatus?.deployed) && streamflowStatus?.depositedAmount 
            ? formatTokenAmount(Number(streamflowStatus.depositedAmount))
            : "N/A"}
          helper={streamflowStatus?.deployed ? "From Streamflow" : "Total pool amount"}
        />
        <StatCard
          label="Vested Amount"
          value={Boolean(streamflowStatus?.deployed) && streamflowStatus?.vestedAmount 
            ? formatTokenAmount(Number(streamflowStatus.vestedAmount))
            : "N/A"}
          helper={streamflowStatus?.deployed ? `${Number(streamflowStatus?.vestedPercentage || 0).toFixed(1)}% vested` : "Deploy to Streamflow"}
        />
        <StatCard
          label="Remaining to Vest"
          value={Boolean(streamflowStatus?.deployed) && streamflowStatus?.depositedAmount && streamflowStatus?.vestedAmount
            ? formatTokenAmount(Number(streamflowStatus.depositedAmount) - Number(streamflowStatus.vestedAmount))
            : "N/A"}
          helper={streamflowStatus?.deployed ? "Locked in Streamflow" : "Deploy to Streamflow"}
        />
        <StatCard
          label="Eligible Wallets"
          value={metrics.eligibleWallets.toLocaleString()}
          helper="Total users in pool"
        />
      </section>

      <section className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Allocations Designer</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Snapshot Rules</h2>
              {Boolean(streamflowStatus?.deployed) && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ On-chain vesting: {Number(streamflowStatus?.vestedPercentage || 0).toFixed(1)}% vested
                </p>
              )}
            </div>
            
            {availablePools.length > 1 && (
              <div className="ml-4">
                <label className="text-xs text-white/60 block mb-1">Pool</label>
                <select
                  value={selectedPoolId || ""}
                  onChange={(e) => handlePoolChange(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[#0c0b25] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {availablePools.map((pool) => (
                    <option key={String(pool.id)} value={String(pool.id)}>
                      {String(pool.name)} {pool.isActive ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-white/60 text-xs">Total Wallets</p>
              <p className="font-semibold text-white">{summary?.totalWallets ?? "--"}</p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs">Total Allocated</p>
              <p className="font-semibold text-white">
                {Boolean(streamflowStatus?.deployed) && streamflowStatus?.depositedAmount 
                  ? formatTokenAmount(Number(streamflowStatus.depositedAmount))
                  : summary ? formatTokenAmount(summary.totalAllocated) : "--"}
              </p>
            </div>
            {Boolean(streamflowStatus?.deployed) && (
              <div className="text-right">
                <p className="text-white/60 text-xs">Streamflow Pool</p>
                <p className="font-semibold text-green-400 text-xs">{String(streamflowStatus?.streamflowId || '').slice(0, 8)}...</p>
              </div>
            )}
          </div>
        </header>

        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-6 text-center">
              <p className="text-lg font-semibold text-blue-400 mb-2">No Rules Configured</p>
              <p className="text-sm text-white/60 mb-4">Create a vesting pool to add allocation rules</p>
              {poolVestingMode === 'dynamic' && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setAddRuleModalOpen(true)}
                >
                  + Add First Rule
                </Button>
              )}
            </div>
          ) : (
            <>
              {poolVestingMode === 'dynamic' && (
                <div className="flex justify-end">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => setAddRuleModalOpen(true)}
                  >
                    + Add New Rule
                  </Button>
                </div>
              )}
              
              <div className="overflow-x-auto -mx-6 px-6">
                <div className="min-w-[600px] max-h-[400px] overflow-y-auto rounded-2xl border border-[var(--border)]">
                  <RuleTable rules={rules} onEdit={handleEdit} onToggle={toggleRule} />
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <TreasuryWidget />
        <ClaimsPolicyPanel />
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <header className="flex flex-wrap items-center justify-between gap-4 cursor-pointer" onClick={() => setLogExpanded(!logExpanded)}>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Activity</p>
            <h2 className="text-xl font-semibold text-white">Operational Log</h2>
          </div>
          <Button variant="ghost" size="sm">
            {logExpanded ? "Collapse" : "Expand"}
          </Button>
        </header>

        {logExpanded && (
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            {activityLogs.length > 0 ? (
              activityLogs.slice(0, 10).map((log, idx) => (
                <ActivityItem
                  key={idx}
                  label={String(log.action || "Unknown action")}
                  detail={log.details ? JSON.stringify(log.details) : `Admin: ${String(log.admin_wallet || '').slice(0, 8)}...`}
                  timestamp={new Date(String(log.created_at)).toLocaleString()}
                />
              ))
            ) : (
              <li className="text-white/50 text-center py-4">No activity logs found</li>
            )}
          </ul>
        )}
      </section>

      <Modal open={refillModalOpen} onClose={() => setRefillModalOpen(false)} title="Refill Pool">
        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.25em] text-white/50">Amount (tokens)</span>
            <input
              type="number"
              value={refillAmount}
              onChange={(e) => setRefillAmount(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
              placeholder="500000000"
            />
            <span className="text-xs text-white/40">Amount in base units (lamports)</span>
          </label>

          {error && (
            <div className="rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 p-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRefillModalOpen(false)} disabled={refillLoading}>
              Cancel
            </Button>
            <Button size="sm" loading={refillLoading} onClick={async () => {
              if (!refillAmount) return;
              setRefillLoading(true);
              try {
                await api.post("/pools/pool-primary/topup", {
                  amount: parseInt(refillAmount),
                  adminPrivateKey: "ADMIN_KEY_PLACEHOLDER",
                });
                setRefillModalOpen(false);
                setRefillAmount("");
                alert("Pool refilled successfully!");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to refill pool");
              } finally {
                setRefillLoading(false);
              }
            }}>
              Refill Pool
            </Button>
          </div>
        </div>
      </Modal>

      {editingRule && (
        <EditRuleModal
          open={editRuleModalOpen}
          onClose={() => setEditRuleModalOpen(false)}
          rule={editingRule}
          poolId={activePoolId || ""}
          onSuccess={handleEditSuccess}
        />
      )}
      {activePoolId && (
        <AddRuleModal
          open={addRuleModalOpen}
          onClose={() => setAddRuleModalOpen(false)}
          poolId={activePoolId}
          onSuccess={handleAddRuleSuccess}
        />
      )}
    </div>
  );
}

/* type SettingRowProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

function SettingRow({ label, value, helper, tone = "default" }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-white/50">{label}</p>
        {helper && <p className="text-xs text-white/40">{helper}</p>}
      </div>
      <span
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium",
          tone === "success"
            ? "bg-[var(--success)]/15 text-[var(--success)]"
            : tone === "warning"
              ? "bg-[#f0b94e33] text-[#f0b94e]"
              : tone === "danger"
                ? "bg-[var(--danger)]/15 text-[var(--danger)]"
                : "bg-white/10 text-white/80"
        )}
      >
        {value}
      </span>
    </div>
  );
} */

type ActivityItemProps = {
  label: string;
  detail: string;
  timestamp: string;
  tone?: "default" | "success" | "warning" | "danger";
};

function ActivityItem({ label, detail, timestamp, tone = "default" }: ActivityItemProps) {
  return (
    <li className="flex flex-col gap-1 rounded-xl bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full"
          style={{
            backgroundColor:
              tone === "danger" ? "var(--danger)" : tone === "warning" ? "#f0b94e" : tone === "success" ? "var(--success)" : "var(--accent)",
          }}
        />
        <p className="font-medium text-white">{label}</p>
      </div>
      <p className="text-xs text-white/60">{detail}</p>
      <p className="text-xs text-white/40">{timestamp}</p>
    </li>
  );
}
