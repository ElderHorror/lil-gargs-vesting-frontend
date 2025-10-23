"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { PoolMember, PoolMembersResponse, PoolStateUpdateRequest, PoolStateUpdateResponse } from "@/types/vesting";

interface AdminPoolManagerProps {
  poolId: string;
  poolName: string;
  poolState: string;
  onPoolStateChange: (newState: string) => void;
}

export function AdminPoolManager({ poolId, poolName, poolState, onPoolStateChange }: AdminPoolManagerProps) {
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<PoolMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Member editing state
  const [editingMember, setEditingMember] = useState<PoolMember | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newAllocation, setNewAllocation] = useState(0);
  const [newNftCount, setNewNftCount] = useState(0);
  const [editLoading, setEditLoading] = useState(false);
  
  // Pool state management
  const [confirmAction, setConfirmAction] = useState<"pause" | "resume" | "cancel" | null>(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [stateLoading, setStateLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<PoolMembersResponse>(`/admin/pool/${poolId}/members`);
      if (response.success) {
        setMembers(response.members);
      } else {
        throw new Error("Failed to load pool members");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pool members");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  // Load pool members
  useEffect(() => {
    if (showMembers && poolId) {
      loadMembers();
    }
  }, [showMembers, poolId, loadMembers]);

  // Filter members based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = members.filter(member => 
        member.user_wallet.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMembers(filtered);
    } else {
      setFilteredMembers(members);
    }
  }, [searchTerm, members]);

  // Update member allocation or NFT count
  async function updateMember(member: PoolMember) {
    setEditLoading(true);
    setError(null);
    
    try {
      const updates: Record<string, number> = {};
      if (newAllocation !== member.token_amount) {
        updates.allocation = newAllocation;
      }
      if (newNftCount !== member.nft_count) {
        updates.nftCount = newNftCount;
      }
      
      if (Object.keys(updates).length === 0) {
        setEditModalOpen(false);
        return;
      }
      
      await api.patch(`/admin/pool/${poolId}/member/${member.user_wallet}`, updates);
      
      // Refresh members list
      await loadMembers();
      setEditModalOpen(false);
      
      alert("Member updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setEditLoading(false);
    }
  }

  // Remove member from pool
  async function removeMember(member: PoolMember) {
    // Prevent removing already cancelled members
    if (member.is_cancelled) {
      alert("This member has already been removed.");
      return;
    }
    
    if (!confirm(`Are you sure you want to remove ${member.user_wallet} from the pool?`)) {
      return;
    }
    
    setError(null);
    
    try {
      await api.patch(`/admin/pool/${poolId}/member/${member.user_wallet}`, { remove: true });
      
      // Refresh members list
      await loadMembers();
      
      alert("Member removed successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  // Update pool state
  async function updatePoolState(action: "pause" | "resume" | "cancel") {
    setStateLoading(true);
    setError(null);
    
    try {
      const requestBody: PoolStateUpdateRequest = {
        action,
        reason: action === "cancel" ? confirmReason : undefined
      };
      
      const response = await api.patch<PoolStateUpdateResponse>(`/admin/pool/${poolId}/state`, requestBody);
      
      if (response.success) {
        onPoolStateChange(action === "cancel" ? "cancelled" : action === "pause" ? "paused" : "active");
        setConfirmAction(null);
        setConfirmReason("");
        
        alert(response.message);
      } else {
        throw new Error(response.message || "Failed to update pool state");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pool state");
    } finally {
      setStateLoading(false);
    }
  }

  function handleEditMember(member: PoolMember) {
    // Prevent editing cancelled members
    if (member.is_cancelled) {
      alert("Cannot edit a removed member.");
      return;
    }
    
    setEditingMember(member);
    setNewAllocation(member.token_amount);
    setNewNftCount(member.nft_count);
    setEditModalOpen(true);
  }

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold text-white">Pool Management</h2>
          <p className="text-sm text-white/60 mt-1">Manage pool members and pool state</p>
        </header>
        
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        
        {/* Pool State Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">Pool State</h3>
              <p className="text-sm text-white/60">
                Current state: 
                <span className={`font-medium capitalize ${poolState === 'paused' ? 'text-yellow-400' : poolState === 'cancelled' ? 'text-red-400' : 'text-green-400'}`}>
                  {poolState}
                </span>
              </p>
            </div>
            
            <div className="flex gap-2">
              {poolState === "active" && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setConfirmAction("pause")}
                  disabled={stateLoading}
                >
                  Pause Pool
                </Button>
              )}
              
              {poolState === "paused" && (
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => setConfirmAction("resume")}
                  disabled={stateLoading}
                >
                  Resume Pool
                </Button>
              )}
              
              {(poolState === "active" || poolState === "paused") && (
                <Button 
                  variant="danger" 
                  size="sm" 
                  onClick={() => setConfirmAction("cancel")}
                  disabled={stateLoading}
                >
                  Cancel Pool
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Pool Members Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-white">Pool Members</h3>
              {/* <p className="text-sm text-white/60">
                {members.length} members in pool
              </p> */}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              {showMembers && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by wallet address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none text-sm"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setShowMembers(!showMembers)}
              >
                {showMembers ? "Hide Members" : "Show Members"}
              </Button>
            </div>
          </div>
          
          {showMembers && (
            <div className="overflow-x-auto -mx-6 px-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  No members found in this pool
                </div>
              ) : (
                <div className="min-w-full overflow-hidden rounded-2xl border border-[var(--border)]">
                  <table className="min-w-full divide-y divide-[var(--border)]">
                    <thead className="bg-white/5">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Wallet</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Allocation</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">NFTs</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Tier</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-white/5">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-white/80">
                            {member.user_wallet.slice(0, 6)}...{member.user_wallet.slice(-4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {member.token_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {member.nft_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {member.tier}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              member.is_active 
                                ? 'bg-green-500/10 text-green-400' 
                                : member.is_cancelled 
                                  ? 'bg-red-500/10 text-red-400' 
                                  : 'bg-yellow-500/10 text-yellow-400'
                            }`}>
                              {member.is_active ? 'Active' : member.is_cancelled ? 'Cancelled' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              {!member.is_cancelled && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleEditMember(member)}
                                  >
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="danger" 
                                    size="sm" 
                                    onClick={() => removeMember(member)}
                                  >
                                    Remove
                                  </Button>
                                </>
                              )}
                              {member.is_cancelled && (
                                <span className="text-xs text-white/50 py-2">Removed</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Member Modal */}
      <Modal 
        open={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        title="Edit Member"
      >
        <div className="space-y-4">
          {editingMember && (
            <>
              <div>
                <p className="text-sm text-white/60 mb-1">Wallet Address</p>
                <p className="font-mono text-white">{editingMember.user_wallet}</p>
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">Allocation</label>
                <input
                  type="number"
                  value={newAllocation}
                  onChange={(e) => setNewAllocation(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">NFT Count</label>
                <input
                  type="number"
                  value={newNftCount}
                  onChange={(e) => setNewNftCount(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setEditModalOpen(false)}
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  loading={editLoading}
                  onClick={() => editingMember && updateMember(editingMember)}
                >
                  Save Changes
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
      
      {/* Confirm Action Modal */}
      <Modal 
        open={!!confirmAction} 
        onClose={() => {
          setConfirmAction(null);
          setConfirmReason("");
        }} 
        title={`${confirmAction === "cancel" ? "Cancel" : confirmAction === "pause" ? "Pause" : "Resume"} Pool`}
      >
        <div className="space-y-4">
          <p className="text-white">
            Are you sure you want to {confirmAction} the pool &quot;{poolName}&quot;?
          </p>
          
          {confirmAction === "cancel" && (
            <div>
              <label className="block text-sm text-white/60 mb-1">Reason for cancellation (optional)</label>
              <textarea
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                rows={3}
                placeholder="Enter reason for cancellation..."
              />
            </div>
          )}
          
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setConfirmAction(null);
                setConfirmReason("");
              }}
              disabled={stateLoading}
            >
              Cancel
            </Button>
            <Button 
              variant={confirmAction === "cancel" ? "danger" : "primary"}
              size="sm" 
              loading={stateLoading}
              onClick={() => confirmAction && updatePoolState(confirmAction)}
            >
              {confirmAction === "cancel" ? "Cancel Pool" : confirmAction === "pause" ? "Pause Pool" : "Resume Pool"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
