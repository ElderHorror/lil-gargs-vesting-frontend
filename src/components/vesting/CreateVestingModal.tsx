"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api, ValidationResult } from "@/lib/api";

export type VestingMode = "snapshot" | "dynamic" | "manual";

type AllocationType = "PERCENTAGE" | "FIXED";

type RuleForm = {
  id: string;
  name: string;
  nftContract: string;
  threshold: number;
  allocationType: AllocationType;
  allocationValue: number;
  enabled: boolean;
};

type ManualAllocation = {
  id: string;
  wallet: string;
  allocationType: "PERCENTAGE" | "FIXED";
  allocationValue: number;
  note?: string;
};

type CreateVestingModalProps = {
  open: boolean;
  onClose: () => void;
  mode: VestingMode;
  onModeChange: (mode: VestingMode) => void;
};

const GARG_TOKEN = {
  symbol: "GARG",
  mint: "2FcDPDTvdURqtyuH6WSBFs33hupeuYJAWy625KyXrWid",
  decimals: 9,
};

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

const DEFAULT_RULE: RuleForm = {
  id: generateId(),
  name: "OG Holders",
  nftContract: "",
  threshold: 1,
  allocationType: "PERCENTAGE",
  allocationValue: 50,
  enabled: true,
};

export function CreateVestingModal({ open, onClose, mode, onModeChange }: CreateVestingModalProps) {
  const [currentMode, setCurrentMode] = useState<VestingMode>(mode);
  const [amount, setAmount] = useState("");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");
  const [cliffTime, setCliffTime] = useState("");
  const [rules, setRules] = useState<RuleForm[]>([DEFAULT_RULE]);
  const [manualAllocations, setManualAllocations] = useState<ManualAllocation[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkWallets, setBulkWallets] = useState("");
  const [bulkAllocationType, setBulkAllocationType] = useState<"PERCENTAGE" | "FIXED">("FIXED");
  const [bulkAllocationValue, setBulkAllocationValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [skipStreamflow, setSkipStreamflow] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentMode(mode);
    setAmount("");
    setCycleStart("");
    setCycleEnd("");
    setCliffTime("");
    setRules([{ ...DEFAULT_RULE, id: generateId() }]);
    setManualAllocations([]);
    setBulkMode(false);
    setBulkWallets("");
    setBulkAllocationType("FIXED");
    setBulkAllocationValue(0);
    setError(null);
    setValidation(null);
    setSkipStreamflow(false);
    setShowValidation(false);
  }, [open, mode]);

  async function validatePool() {
    try {
      setLoading(true);
      setError(null);
      
      const start = Math.floor(new Date(cycleStart).getTime() / 1000);
      
      const validationResult = await api.post<ValidationResult>("/pools/validate", {
        start_time: new Date(start * 1000).toISOString(),
        total_pool_amount: Number(amount),
        vesting_mode: currentMode,
        manual_allocations: currentMode === "manual" ? manualAllocations.filter(a => a.wallet).map(a => ({
          allocationType: a.allocationType,
          allocationValue: a.allocationValue,
        })) : undefined,
        rules: (currentMode === "snapshot" || currentMode === "dynamic") ? rules.map(r => ({
          name: r.name,
          nftContract: r.nftContract,
          threshold: r.threshold,
          allocationType: r.allocationType,
          allocationValue: r.allocationValue,
          enabled: r.enabled,
        })) : undefined,
      });
      
      setValidation(validationResult);
      setShowValidation(true);
      
      return validationResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function updateRule(index: number, key: keyof RuleForm, value: RuleForm[typeof key]) {
    setRules((prev) =>
      prev.map((rule, idx) => (idx === index ? { ...rule, [key]: value } : rule))
    );
  }

  function addRule() {
    setRules((prev) => [
      ...prev,
      {
        id: generateId(),
        name: "New Rule",
        nftContract: "",
        threshold: 1,
        allocationType: "PERCENTAGE",
        allocationValue: 10,
        enabled: true,
      },
    ]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== index));
  }

  function parseBulkWallets() {
    const wallets = bulkWallets
      .split('\n')
      .map(w => w.trim())
      .filter(w => w.length > 0);
    
    // If percentage, split equally among all wallets
    const valuePerWallet = bulkAllocationType === "PERCENTAGE" 
      ? bulkAllocationValue / wallets.length 
      : bulkAllocationValue;
    
    const newAllocations: ManualAllocation[] = wallets.map(wallet => ({
      id: generateId(),
      wallet,
      allocationType: bulkAllocationType,
      allocationValue: valuePerWallet,
      note: "",
    }));
    
    setManualAllocations(prev => [...prev, ...newAllocations]);
    setBulkWallets("");
    setBulkMode(false);
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      // Run validation first if not already validated
      if (!validation || !showValidation) {
        const validationResult = await validatePool();
        if (!validationResult) {
          return; // Validation failed
        }
        
        // If validation has errors and not skipping Streamflow, show validation UI
        if (!validationResult.valid && !skipStreamflow) {
          return; // Let user review validation results
        }
      }

      const start = cycleStart ? new Date(cycleStart).getTime() / 1000 : Math.floor(Date.now() / 1000);
      if (!cycleEnd) {
        throw new Error("Please provide an end time for the vesting cycle.");
      }
      const end = new Date(cycleEnd).getTime() / 1000;
      if (Number.isNaN(start) || Number.isNaN(end)) {
        throw new Error("Invalid cycle dates provided.");
      }
      if (end <= start) {
        throw new Error("End time must be later than start time.");
      }

      const durationSeconds = end - start;
      const cliffSeconds = cliffTime ? Math.floor(new Date(cliffTime).getTime() / 1000) : undefined;

      const payloadRules = rules.map((rule) => ({
        name: rule.name,
        nftContract: rule.nftContract,
        threshold: rule.threshold,
        allocationType: rule.allocationType,
        allocationValue: rule.allocationValue,
        enabled: rule.enabled,
      }));

      // Validate based on mode
      if (currentMode === "manual") {
        if (!manualAllocations.length || manualAllocations.every(a => !a.wallet)) {
          throw new Error("Add at least one wallet allocation for manual mode.");
        }
        // Validate wallet addresses
        for (const alloc of manualAllocations) {
          if (alloc.wallet && alloc.wallet.length < 32) {
            throw new Error(`Invalid wallet address: ${alloc.wallet}`);
          }
          if (alloc.allocationValue <= 0) {
            throw new Error(`Wallet ${alloc.wallet} must have an allocation value greater than 0`);
          }
        }
      } else if (!payloadRules.length) {
        throw new Error("Add at least one eligibility rule before creating a vesting.");
      }

      // Validate inputs
      if (!amount || Number(amount) <= 0) {
        throw new Error("Please enter a valid pool amount");
      }

      const config = {
        mode: currentMode,
        token: {
          symbol: GARG_TOKEN.symbol,
          mint: GARG_TOKEN.mint,
          decimals: GARG_TOKEN.decimals,
        },
        poolSize: Number(amount),
        cycleStartTime: start,
        cycleEndTime: end,
        cycleDuration: durationSeconds,
        cliffTime: cliffSeconds,
        rules: payloadRules,
      };

      console.log("Creating vesting with config:", {
        amount: Number(amount),
        durationSeconds,
        durationDays: Math.floor(durationSeconds / 86400),
        start,
        end,
      });

      // Step 1: Set vesting mode
      console.log("Step 1: Setting vesting mode to", currentMode);
      await api.put("/config/mode", {
        mode: currentMode,
        adminWallet: "ADMIN_WALLET_PLACEHOLDER",
      });

      if (currentMode === "snapshot") {
        // Step 2: Process snapshot to calculate allocations
        console.log("Step 2: Processing snapshot with config:", config);
        const processResult = await api.post("/snapshot/process", { config });
        console.log("Snapshot process result:", processResult);
        
        const processData = processResult as Record<string, unknown>;
        if (!processData.allocations || (processData.allocations as unknown[]).length === 0) {
          throw new Error("No eligible wallets found for snapshot");
        }

        // Step 3: Create vesting stream in database
        console.log("Step 3: Creating vesting pool");
        const streamResult = await api.post("/pools", {
          name: `Vesting - ${new Date().toLocaleDateString()}`,
          description: `Snapshot vesting with ${payloadRules.length} rule(s)`,
          total_pool_amount: Number(amount),
          vesting_duration_days: durationSeconds / 86400, // Allow fractional days for testing
          cliff_duration_days: cliffSeconds ? (cliffSeconds - start) / 86400 : 0,
          start_time: new Date(start * 1000).toISOString(),
          end_time: new Date(end * 1000).toISOString(),
          is_active: true,
          vesting_mode: "snapshot",
          rules: payloadRules, // Include rules for nft_requirements
          skipStreamflow, // Pass skipStreamflow flag
        });
        console.log("Pool created:", streamResult);

        const streamData = streamResult as Record<string, unknown>;
        const streamObj = streamData.stream as Record<string, unknown> | undefined;
        const vestingStreamId = streamObj?.id || streamData.id || 1;
        const streamflowDeployed = streamData.streamflowDeployed;
        const streamflowId = streamObj?.streamflow_stream_id as string | undefined;

        // Step 4: Commit allocations to database
        console.log("Step 4: Committing allocations to database");
        const commitResult = await api.post("/snapshot/commit", {
          allocations: processData.allocations,
          vestingStreamId,
          startTime: start,
          cliffDays: cliffSeconds ? (cliffSeconds - start) / 86400 : 0,
          vestingDays: durationSeconds / 86400, // Allow fractional days
        });
        console.log("Commit result:", commitResult);

        const streamflowMsg = skipStreamflow
          ? '\n📝 Pool created in database only (Streamflow deployment skipped)'
          : streamflowDeployed 
            ? `\n✅ Deployed to Streamflow: ${streamflowId?.slice(0, 8)}...`
            : '\n⚠️ Streamflow deployment failed (pool still created in DB)';

        alert(`Vesting created successfully! ${(processData.allocations as unknown[]).length} wallets allocated.${streamflowMsg}`);
      } else if (currentMode === "manual") {
        // Manual mode: Create pool with manual allocations
        console.log("Creating manual vesting pool");
        
        const streamResult = await api.post("/pools", {
          name: `Manual Vesting - ${new Date().toLocaleDateString()}`,
          description: `Manual vesting with ${manualAllocations.length} wallet(s)`,
          total_pool_amount: Number(amount),
          vesting_duration_days: durationSeconds / 86400,
          cliff_duration_days: cliffSeconds ? (cliffSeconds - start) / 86400 : 0,
          vesting_duration_seconds: durationSeconds,
          cliff_duration_seconds: cliffSeconds ? (cliffSeconds - start) : 0,
          start_time: new Date(start * 1000).toISOString(),
          end_time: new Date(end * 1000).toISOString(),
          is_active: true,
          vesting_mode: "manual",
          manual_allocations: manualAllocations.filter(a => a.wallet).map(a => ({
            wallet: a.wallet,
            allocationType: a.allocationType,
            allocationValue: a.allocationValue,
            note: a.note || undefined,
          })),
          skipStreamflow, // Pass skipStreamflow flag
        });
        console.log("Manual pool created:", streamResult);
        
        const manualStreamData = streamResult as Record<string, unknown>;
        const manualStreamObj = manualStreamData.stream as Record<string, unknown> | undefined;
        const streamflowDeployed = manualStreamData.streamflowDeployed;
        const streamflowId = manualStreamObj?.streamflow_stream_id as string | undefined;
        const streamflowMsg = skipStreamflow
          ? '\n📝 Pool created in database only (Streamflow deployment skipped)'
          : streamflowDeployed 
            ? `\n✅ Deployed to Streamflow: ${streamflowId?.slice(0, 8)}...`
            : '\n⚠️ Streamflow deployment failed (pool still created in DB)';
        
        alert(`Manual vesting pool created! ${manualAllocations.length} wallet(s) allocated.${streamflowMsg}`);
      } else {
        // Dynamic mode: Create vesting stream config
        console.log("Creating dynamic vesting pool");
        const streamResult = await api.post("/pools", {
          name: `Dynamic Vesting - ${new Date().toLocaleDateString()}`,
          description: `Dynamic vesting with ${payloadRules.length} rule(s)`,
          total_pool_amount: Number(amount),
          vesting_duration_days: durationSeconds / 86400, // Allow fractional days for testing
          cliff_duration_days: cliffSeconds ? (cliffSeconds - start) / 86400 : 0,
          start_time: new Date(start * 1000).toISOString(),
          end_time: new Date(end * 1000).toISOString(),
          is_active: true,
          vesting_mode: "dynamic",
          rules: payloadRules, // Include rules for nft_requirements
          skipStreamflow, // Pass skipStreamflow flag
        });
        console.log("Dynamic pool created:", streamResult);
        
        const dynamicStreamData = streamResult as Record<string, unknown>;
        const dynamicStreamObj = dynamicStreamData.stream as Record<string, unknown> | undefined;
        const dynamicStreamflowDeployed = dynamicStreamData.streamflowDeployed;
        const dynamicStreamflowId = dynamicStreamObj?.streamflow_stream_id as string | undefined;
        const dynamicStreamflowMsg = skipStreamflow
          ? '\n📝 Pool created in database only (Streamflow deployment skipped)'
          : dynamicStreamflowDeployed 
            ? `\n✅ Deployed to Streamflow: ${dynamicStreamflowId?.slice(0, 8)}...`
            : '\n⚠️ Streamflow deployment failed (pool still created in DB)';
        
        alert(`Dynamic vesting pool created! Sync daemon will create vesting records.${dynamicStreamflowMsg}`);
      }

      onModeChange(currentMode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vesting");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Vesting">
      <div className="space-y-6 text-sm text-white/80">
        <section className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Vesting Mode</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMode("snapshot")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                currentMode === "snapshot" ? "bg-[var(--accent)] text-white" : "bg-white/10 text-white/70"
              }`}
            >
              Snapshot
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode("dynamic")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                currentMode === "dynamic" ? "bg-[var(--accent)] text-white" : "bg-white/10 text-white/70"
              }`}
            >
              Dynamic
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode("manual")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                currentMode === "manual" ? "bg-[var(--accent)] text-white" : "bg-white/10 text-white/70"
              }`}
            >
              Manual
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">
            {currentMode === "snapshot"
              ? "Capture a point-in-time snapshot of eligible wallets and mint vesting streams once."
              : currentMode === "dynamic"
              ? "Continuously monitor collections and adjust Streamflow vesting streams as ownership changes."
              : "Manually specify wallet addresses and their token allocations."}
          </p>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Funding Token</p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Token</span>
                  <span className="text-sm font-medium text-white">{GARG_TOKEN.symbol}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-white/50">Mint</span>
                  <span className="font-mono text-xs text-white/70">{GARG_TOKEN.mint}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-white/50">Decimals</span>
                  <span className="text-xs text-white/70">{GARG_TOKEN.decimals}</span>
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/60">Total tokens to stream</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                  placeholder="5000000000"
                />
                <span className="text-xs text-white/40">
                  Net amount (in smallest unit) to deposit from the treasury wallet when vesting is approved.
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Schedule</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/60">Start time</span>
                <input
                  type="datetime-local"
                  value={cycleStart}
                  onChange={(event) => setCycleStart(event.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/60">End time</span>
                <input
                  type="datetime-local"
                  value={cycleEnd}
                  onChange={(event) => setCycleEnd(event.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                  required
                />
              </label>
            </div>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs text-white/60">Optional cliff unlock</span>
              <input
                type="datetime-local"
                value={cliffTime}
                onChange={(event) => setCliffTime(event.target.value)}
                className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
              />
              <span className="text-xs text-white/40">Funds remain locked until cliff. Leave empty for linear unlock from start.</span>
            </label>
          </div>

          {/* Streamflow Deployment Option */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50 mb-3">Deployment Options</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skipStreamflow}
                onChange={(e) => setSkipStreamflow(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
              />
              <div className="flex-1">
                <span className="text-sm text-white font-medium">Skip Streamflow Deployment</span>
                <p className="text-xs text-white/50 mt-0.5">
                  Create pool in database only without deploying to Streamflow protocol. 
                  Useful for testing or when Streamflow is unavailable.
                </p>
              </div>
            </label>
          </div>
        </section>

        {currentMode === "manual" ? (
          <section className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Manual Allocations</p>
                <p className="text-xs text-white/50">Specify wallet addresses and token amounts.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setBulkMode(!bulkMode)}
                >
                  {bulkMode ? "Single Mode" : "Bulk Mode"}
                </Button>
                {!bulkMode && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setManualAllocations(prev => [...prev, { id: generateId(), wallet: "", allocationType: "FIXED", allocationValue: 0, note: "" }])}
                  >
                    Add Wallet
                  </Button>
                )}
              </div>
            </header>

            {bulkMode && (
              <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-white">Bulk Add Wallets</p>
                <textarea
                  value={bulkWallets}
                  onChange={(e) => setBulkWallets(e.target.value)}
                  placeholder="Paste wallet addresses (one per line)
Example:
ABC123...
DEF456...
GHI789..."
                  className="w-full h-32 rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none resize-none"
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/60">Allocation Type</span>
                    <select
                      value={bulkAllocationType}
                      onChange={(e) => setBulkAllocationType(e.target.value as "PERCENTAGE" | "FIXED")}
                      className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
                    >
                      <option value="FIXED">Fixed Amount</option>
                      <option value="PERCENTAGE">Percentage</option>
                    </select>
                  </label>
                  
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/60">
                      {bulkAllocationType === "PERCENTAGE" ? "Total % (split equally)" : "Token Amount per wallet"}
                    </span>
                    <input
                      type="number"
                      value={bulkAllocationValue}
                      onChange={(e) => setBulkAllocationValue(Number(e.target.value))}
                      className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                      placeholder={bulkAllocationType === "PERCENTAGE" ? "0-100" : "0"}
                      max={bulkAllocationType === "PERCENTAGE" ? 100 : undefined}
                    />
                    {bulkAllocationType === "PERCENTAGE" && bulkWallets.trim() && (
                      <span className="text-xs text-white/40">
                        {(bulkAllocationValue / bulkWallets.split('\n').filter(w => w.trim()).length).toFixed(2)}% per wallet
                      </span>
                    )}
                  </label>
                </div>
                
                <Button 
                  size="sm" 
                  onClick={parseBulkWallets}
                  disabled={!bulkWallets.trim() || bulkAllocationValue <= 0}
                  className="w-full"
                >
                  Add {bulkWallets.split('\n').filter(w => w.trim()).length} Wallet(s)
                </Button>
              </div>
            )}

            {manualAllocations.length === 0 && !bulkMode && (
              <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center">
                <p className="text-sm text-white/60">No wallets added yet</p>
                <p className="text-xs text-white/40 mt-1">Click &quot;Add Wallet&quot; or &quot;Bulk Mode&quot; to get started</p>
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {manualAllocations.map((allocation, index) => (
                <div key={allocation.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs text-white/60">Wallet #{index + 1}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setManualAllocations(prev => prev.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                  
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-white/60">Wallet Address</span>
                      <input
                        value={allocation.wallet}
                        onChange={(e) => {
                          const newAllocations = [...manualAllocations];
                          newAllocations[index].wallet = e.target.value.trim();
                          setManualAllocations(newAllocations);
                        }}
                        className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                        placeholder="Solana wallet address"
                      />
                    </label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-white/60">Allocation Type</span>
                        <select
                          value={allocation.allocationType}
                          onChange={(e) => {
                            const newAllocations = [...manualAllocations];
                            newAllocations[index].allocationType = e.target.value as "PERCENTAGE" | "FIXED";
                            setManualAllocations(newAllocations);
                          }}
                          className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
                        >
                          <option value="FIXED">Fixed Amount</option>
                          <option value="PERCENTAGE">Percentage</option>
                        </select>
                      </label>
                      
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-white/60">
                          {allocation.allocationType === "PERCENTAGE" ? "Percentage (%)" : "Token Amount"}
                        </span>
                        <input
                          type="number"
                          value={allocation.allocationValue}
                          onChange={(e) => {
                            const newAllocations = [...manualAllocations];
                            newAllocations[index].allocationValue = Number(e.target.value);
                            setManualAllocations(newAllocations);
                          }}
                          className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                          placeholder={allocation.allocationType === "PERCENTAGE" ? "0-100" : "0"}
                          max={allocation.allocationType === "PERCENTAGE" ? 100 : undefined}
                        />
                      </label>
                    </div>
                    
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-white/60">Note (optional)</span>
                      <input
                        value={allocation.note || ""}
                        onChange={(e) => {
                          const newAllocations = [...manualAllocations];
                          newAllocations[index].note = e.target.value;
                          setManualAllocations(newAllocations);
                        }}
                        className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                        placeholder="Team, Advisor, etc."
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
              <p className="text-xs text-white/70">
                {manualAllocations.length} wallet(s) • 
                {manualAllocations.filter(a => a.allocationType === "FIXED").length > 0 && 
                  ` ${manualAllocations.filter(a => a.allocationType === "FIXED").reduce((sum, a) => sum + a.allocationValue, 0).toLocaleString()} fixed tokens`}
                {manualAllocations.filter(a => a.allocationType === "PERCENTAGE").length > 0 && 
                  ` • ${manualAllocations.filter(a => a.allocationType === "PERCENTAGE").reduce((sum, a) => sum + a.allocationValue, 0)}% of pool`}
              </p>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Eligibility Rules</p>
                <p className="text-xs text-white/50">Define how wallets qualify for allocations.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={addRule}>
                Add rule
              </Button>
            </header>

            <div className="space-y-3">
              {rules.map((rule, index) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onChange={(key, value) => updateRule(index, key, value)}
                  onRemove={() => removeRule(index)}
                />
              ))}
            </div>
          </section>
        )}

        {error && (
          <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/15 p-3 text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        {/* Validation Results */}
        {showValidation && validation && (
          <section className="space-y-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
            <h3 className="text-sm font-semibold text-white">Pre-Flight Validation</h3>
            
            {/* Errors */}
            {validation.errors.length > 0 && (
              <div className="space-y-2">
                {validation.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                    <span>❌</span>
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                {validation.warnings.map((warn, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-yellow-400">
                    <span>⚠️</span>
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Treasury Info */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-white/60">Treasury Wallet:</span>
                <span className="font-mono text-white">{validation.checks.treasury.address.slice(0, 8)}...{validation.checks.treasury.address.slice(-4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">SOL Balance:</span>
                <span className={validation.checks.solBalance.valid ? "text-green-400" : "text-red-400"}>
                  {validation.checks.solBalance.current.toFixed(4)} SOL {validation.checks.solBalance.valid ? "✓" : "✗"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Token Balance:</span>
                <span className={validation.checks.tokenBalance.valid ? "text-green-400" : "text-red-400"}>
                  {validation.checks.tokenBalance.current.toFixed(2)} {validation.checks.tokenBalance.valid ? "✓" : "✗"}
                </span>
              </div>
            </div>

            {/* Skip Streamflow Option */}
            {!validation.valid && validation.canProceedWithoutStreamflow && (
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <input
                  type="checkbox"
                  checked={skipStreamflow}
                  onChange={(e) => setSkipStreamflow(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="text-xs text-white">
                  Create pool without Streamflow deployment (database only)
                </span>
              </label>
            )}
          </section>
        )}

        <footer className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {showValidation && !validation?.valid && !skipStreamflow && (
            <Button variant="secondary" size="sm" onClick={validatePool} loading={loading}>
              Retry Validation
            </Button>
          )}
          {!showValidation && (
            <Button variant="secondary" size="sm" onClick={validatePool} loading={loading}>
              Validate
            </Button>
          )}
          <Button 
            size="sm" 
            onClick={handleCreate} 
            loading={loading}
            disabled={showValidation && !validation?.valid && !skipStreamflow}
          >
            Create Vesting
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

type RuleCardProps = {
  rule: RuleForm;
  onChange: <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => void;
  onRemove: () => void;
};

function RuleCard({ rule, onChange, onRemove }: RuleCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <input
          value={rule.name}
          onChange={(event) => onChange("name", event.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
          placeholder="Rule name (e.g. OG holders)"
        />
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">NFT Collection Mint</span>
          <input
            value={rule.nftContract}
            onChange={(event) => onChange("nftContract", event.target.value.trim())}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            placeholder="Mint address"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Minimum NFTs</span>
          <input
            type="number"
            value={rule.threshold}
            onChange={(event) => onChange("threshold", Number(event.target.value) || 0)}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            min={0}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Allocation type</span>
          <select
            value={rule.allocationType}
            onChange={(event) => onChange("allocationType", event.target.value as AllocationType)}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="PERCENTAGE" className="bg-slate-900 text-white">
              Percentage of pool
            </option>
            <option value="FIXED" className="bg-slate-900 text-white">
              Fixed token amount
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Allocation value</span>
          <input
            type="number"
            value={rule.allocationValue}
            onChange={(event) => onChange("allocationValue", Number(event.target.value) || 0)}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            min={0}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(event) => onChange("enabled", event.target.checked)}
            className="h-4 w-4 rounded border border-[var(--border)] bg-white/5 text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          Enabled
        </label>
      </div>
    </div>
  );
}
