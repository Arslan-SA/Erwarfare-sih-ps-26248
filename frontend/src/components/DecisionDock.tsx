// src/components/DecisionDock.tsx
import { useState } from "react";
import { useSimulation } from "../store/simulation";
import type { TraineeDecision } from "../types/simulation";

export default function DecisionDock() {
  const {
    currentRole,
    simTime,
    groundTruthEntities,
    feeds,
    decisions,
    submitDecision,
    setActiveView,
  } = useSimulation();

  const [action, setAction] = useState<TraineeDecision["action"]>("HOLD_VERIFY");
  const [targetEntityId, setTargetEntityId] = useState<string>("TRK-002");
  const [confidence, setConfidence] = useState<number>(75);
  const [assumedRisk, setAssumedRisk] = useState<string>("Civilian maritime collateral damage / Misidentification under EW");
  const [rationale, setRationale] = useState<string>("");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const toggleEvidence = (id: string) => {
    setSelectedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rationale.trim()) {
      alert("Structured rationale is mandatory to substantiate tactical decision under uncertainty.");
      return;
    }

    submitDecision({
      simTimestamp: simTime,
      role: currentRole,
      action,
      targetEntityId,
      confidenceScore: confidence,
      rationale,
      assumedRisk,
      evidenceMessageIds: selectedEvidenceIds,
    });

    setSubmitted(true);
  };

  const lastDecision = decisions[decisions.length - 1];

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="section-header">
        <span>Decision & Defense Rationale Dock</span>
        <span style={{ fontSize: "0.7rem", color: "var(--text-amber)", fontFamily: "var(--font-mono)" }}>
          {submitted ? "DECISION LOCKED" : "AWAITING SUBMISSION"}
        </span>
      </div>

      <div className="decision-dock">
        {submitted && lastDecision ? (
          <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", borderRadius: "6px", padding: "12px" }}>
            <div style={{ color: "#34d399", fontWeight: 700, fontSize: "0.85rem", marginBottom: "4px" }}>
              ✓ DECISION SUBMITTED & SNAPSHOTTED
            </div>
            <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "8px" }}>
              Action: <strong>{lastDecision.action}</strong> on <strong>{lastDecision.targetEntityId}</strong> (Confidence: {lastDecision.confidenceScore}%)
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic", marginBottom: "12px" }}>
              "{lastDecision.rationale}"
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setActiveView("AAR")}
                className="btn-tactical btn-cyan"
                style={{ flex: 1, padding: "6px 12px", fontSize: "0.75rem" }}
              >
                Inspect AAR Evaluation
              </button>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="btn-tactical btn-outline"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                Modify
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Tactical Action Choice */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "6px" }}>
                1. SELECT TACTICAL ACTION
              </label>
              <div className="action-selector">
                <button
                  type="button"
                  className={`action-btn ${action === "HOLD_VERIFY" ? "selected" : ""}`}
                  onClick={() => setAction("HOLD_VERIFY")}
                >
                  Hold & Verify
                </button>
                <button
                  type="button"
                  className={`action-btn ${action === "ENGAGE" ? "selected danger" : ""}`}
                  onClick={() => setAction("ENGAGE")}
                >
                  Engage Target
                </button>
                <button
                  type="button"
                  className={`action-btn ${action === "VECTOR_SUPPORT" ? "selected" : ""}`}
                  onClick={() => setAction("VECTOR_SUPPORT")}
                >
                  Vector Support
                </button>
                <button
                  type="button"
                  className={`action-btn ${action === "EVACUATE" ? "selected" : ""}`}
                  onClick={() => setAction("EVACUATE")}
                >
                  Evacuate Sector
                </button>
              </div>
            </div>

            {/* Target Entity Selection */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "4px" }}>
                2. TARGET CONTACT
              </label>
              <select
                value={targetEntityId}
                onChange={(e) => setTargetEntityId(e.target.value)}
                className="tactical-input"
              >
                {groundTruthEntities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.id}: {ent.name} ({ent.domain} - {ent.classification})
                  </option>
                ))}
              </select>
            </div>

            {/* Confidence Slider */}
            <div className="slider-container">
              <div className="slider-label">
                <span>3. CONFIDENCE IN RECEIVED INFORMATION</span>
                <span style={{ color: "var(--text-cyan)", fontWeight: 700 }}>{confidence}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="tactical-slider"
              />
            </div>

            {/* Assumed Risk */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "4px" }}>
                4. PRIMARY ASSUMED RISK
              </label>
              <select
                value={assumedRisk}
                onChange={(e) => setAssumedRisk(e.target.value)}
                className="tactical-input"
              >
                <option value="Civilian maritime collateral damage / Misidentification under EW">Civilian maritime collateral damage / Misidentification under EW</option>
                <option value="Adversary surface combatant penetration due to verification delay">Adversary surface combatant penetration due to verification delay</option>
                <option value="Friendly littoral unit fratricide (Blue-on-Blue)">Friendly littoral unit fratricide (Blue-on-Blue)</option>
                <option value="Electronic warfare deception trap / decoy spoof">Electronic warfare deception trap / decoy spoof</option>
              </select>
            </div>

            {/* Evidence Linker */}
            {feeds.length > 0 && (
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "4px" }}>
                  5. CORROBORATING FEEDS USED AS EVIDENCE
                </label>
                <div style={{ maxHeight: "80px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "4px", padding: "6px", background: "rgba(0,0,0,0.3)" }}>
                  {feeds.slice(0, 5).map((f) => (
                    <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.7rem", marginBottom: "4px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedEvidenceIds.includes(f.id)}
                        onChange={() => toggleEvidence(f.id)}
                        style={{ accentColor: "var(--text-cyan)" }}
                      />
                      <span style={{ color: "#94a3b8" }}>[{f.sourceUnit}]: {f.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Rationale */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "4px" }}>
                6. TACTICAL REASONING (FOR FORENSIC REVIEW)
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
                placeholder="State why this action is defensible given conflicting/delayed cues..."
                className="tactical-input"
                required
              />
            </div>

            <button type="submit" className="btn-tactical btn-cyan" style={{ width: "100%", padding: "10px" }}>
              Transmit Decision + Rationale
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
