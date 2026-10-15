// src/components/VerificationModal.tsx
import { useState } from "react";
import { useSimulation } from "../store/simulation";
import type { Role } from "../types/simulation";

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  const { verifications, requestVerification, commsSeveredUnits } = useSimulation();

  const [toRole, setToRole] = useState<Role>("UNIT_A");
  const [targetEntityId, setTargetEntityId] = useState<string>("TARGET_X");
  const [query, setQuery] = useState<string>(
    "Request secondary pulse-doppler scan on Target X to confirm if track is genuine military UAV or commercial transponder decoy."
  );

  if (!isOpen) return null;

  const isTargetSevered =
    (toRole === "UNIT_A" && commsSeveredUnits.unitA) ||
    (toRole === "UNIT_B" && commsSeveredUnits.unitB);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    requestVerification(targetEntityId, query, toRole);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="section-header" style={{ background: "rgba(10, 16, 28, 0.95)" }}>
          <span>Tactical Cross-Examination Protocol</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1.1rem" }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Initiate asymmetric verification query between Command and Subordinate Units to resolve sensor divergence under EW conditions.
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>
                  QUERY RECIPIENT
                </label>
                <select
                  value={toRole}
                  onChange={(e) => setToRole(e.target.value as Role)}
                  className="tactical-input"
                >
                  <option value="UNIT_A">Unit A (Forward Air Defense)</option>
                  <option value="UNIT_B">Unit B (Coastal Radar Post)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>
                  CONTACT IN QUESTION
                </label>
                <select
                  value={targetEntityId}
                  onChange={(e) => setTargetEntityId(e.target.value)}
                  className="tactical-input"
                >
                  <option value="TARGET_X">Target X (Air Sector 4)</option>
                  <option value="TARGET_Y">Target Y (Maritime Track)</option>
                </select>
              </div>
            </div>

            {isTargetSevered && (
              <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "4px", fontSize: "0.75rem", color: "#f87171" }}>
                ⚠️ WARNING: Electronic jamming has severed datalink with {toRole}. Transmission may fail or be dropped.
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>
                VERIFICATION DIRECTIVE
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
                className="tactical-input"
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={onClose} className="btn-tactical btn-outline">
                Cancel
              </button>
              <button type="submit" className="btn-tactical btn-cyan">
                Transmit Query
              </button>
            </div>
          </form>

          {/* Verification History */}
          {verifications.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", marginTop: "4px" }}>
              <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-cyan)", marginBottom: "6px" }}>
                RECENT VERIFICATION RECORDS
              </div>
              <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {verifications.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      background: "rgba(8, 12, 20, 0.6)",
                      padding: "8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      borderLeft: `3px solid ${v.status === "ANSWERED" ? "#34d399" : v.status === "JAMMED" ? "#ef4444" : "#fbbf24"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)", fontSize: "0.7rem" }}>
                      <span>TO: {v.toRole} ({v.targetEntityId})</span>
                      <span style={{ fontWeight: 700 }}>STATUS: {v.status}</span>
                    </div>
                    <div style={{ marginTop: "2px", color: "#cbd5e1" }}>{v.query}</div>
                    {v.response && (
                      <div style={{ marginTop: "4px", color: "#34d399", fontWeight: 600 }}>
                        ↳ RESPONSE: {v.response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
