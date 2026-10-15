// src/components/AARView.tsx
import { useState } from "react";
import { useSimulation } from "../store/simulation";

export default function AARView() {
  const {
    aarEvaluation,
    decisions,
    snapshotAtT5,
    updateInstructorRubric,
    setActiveView,
  } = useSimulation();

  const [situationalAwareness, setSituationalAwareness] = useState<number>(
    aarEvaluation?.instructorScores.situationalAwareness || 4.5
  );
  const [riskManagement, setRiskManagement] = useState<number>(
    aarEvaluation?.instructorScores.riskManagement || 4.5
  );
  const [adaptability, setAdaptability] = useState<number>(
    aarEvaluation?.instructorScores.adaptability || 4.0
  );
  const [evaluatorNotes, setEvaluatorNotes] = useState<string>(
    aarEvaluation?.evaluatorNotes || ""
  );

  const handleUpdateScores = () => {
    updateInstructorRubric({
      situationalAwareness,
      riskManagement,
      adaptability,
      evaluatorNotes,
    });
    alert("Instructor rubric and composite score updated.");
  };

  const handleExportCSV = () => {
    if (!aarEvaluation) return;
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "SessionId,DecisionMomentT,Classification,AutomatedScore,InstructorScore,CompositeScore\n" +
      `${aarEvaluation.sessionId},${aarEvaluation.decisionMomentT},${aarEvaluation.classification},${aarEvaluation.automatedScores.overallAutomated},${aarEvaluation.instructorScores.overallInstructor},${aarEvaluation.finalCompositeScore}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AAR_Report_${aarEvaluation.sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (!aarEvaluation) {
    return (
      <div className="glass-panel" style={{ padding: "32px", textAlign: "center", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📊</div>
        <h2 style={{ color: "var(--text-cyan)", marginBottom: "8px" }}>No Completed Scenario To Review</h2>
        <p style={{ color: "var(--text-dim)", maxWidth: "460px", marginBottom: "18px", fontSize: "0.85rem" }}>
          Run the simulation scenario or submit a decision at T=5 to generate the forensic After Action Review (AAR) and dual-timeline reconstruction.
        </p>
        <button onClick={() => setActiveView("TACTICAL")} className="btn-tactical btn-cyan">
          Return to Tactical Simulation
        </button>
      </div>
    );
  }

  const lastDecision = decisions[decisions.length - 1];

  return (
    <div className="aar-container">
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid var(--border-color)" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", color: "var(--text-cyan)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            After Action Review (AAR) & Forensic Decision Analysis
          </h2>
          <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            SESSION: {aarEvaluation.sessionId} | EVALUATING DECISION AT T={aarEvaluation.decisionMomentT}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={handleExportCSV} className="btn-tactical btn-outline" style={{ fontSize: "0.75rem", padding: "6px 12px" }}>
            Export CSV
          </button>
          <button onClick={handleExportPDF} className="btn-tactical btn-cyan" style={{ fontSize: "0.75rem", padding: "6px 12px" }}>
            Print / Export PDF
          </button>
          <button onClick={() => setActiveView("TACTICAL")} className="btn-tactical btn-outline" style={{ fontSize: "0.75rem", padding: "6px 12px" }}>
            Back to Tactical
          </button>
        </div>
      </div>

      {/* High-level Scorecard */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            FINAL COMPOSITE SCORE
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: aarEvaluation.finalCompositeScore >= 70 ? "#34d399" : "#f87171" }}>
            {aarEvaluation.finalCompositeScore} / 100
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-cyan)" }}>
            40% Automated + 60% Human Rubric
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            DECISION CLASSIFICATION
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-amber)", marginTop: "4px" }}>
            {aarEvaluation.classification}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
            Reasoning: {aarEvaluation.reasoningQuality} | Outcome: {aarEvaluation.outcomeQuality}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            AUTOMATED SCORE
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#38bdf8" }}>
            {aarEvaluation.automatedScores.overallAutomated} / 100
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
            Verifications: {aarEvaluation.automatedScores.verificationAttempts} | Latency: {aarEvaluation.automatedScores.responseLatencySec}s
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            INSTRUCTOR SCORE
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#c084fc" }}>
            {aarEvaluation.instructorScores.overallInstructor} / 100
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
            Weighted Rubric Evaluation
          </div>
        </div>
      </div>

      {/* Dual Timeline Reconstruction */}
      <div className="glass-panel" style={{ padding: "14px" }}>
        <div className="section-header" style={{ padding: "0 0 10px 0" }}>
          <span>Dual-Timeline Reconstruction (Ground Truth vs. Trainee Perception)</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
          {/* Top: Ground Truth */}
          <div>
            <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-cyan)", marginBottom: "6px" }}>
              AUTHORITATIVE GROUND TRUTH (HIDDEN STATE)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "4px" }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((t) => (
                <div key={t} style={{ textAlign: "center", padding: "6px 2px", background: t === aarEvaluation.decisionMomentT ? "rgba(56, 189, 248, 0.25)" : "rgba(14, 21, 37, 0.6)", border: t === aarEvaluation.decisionMomentT ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                  <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-amber)" }}>T={t}</div>
                  <div style={{ fontSize: "0.65rem", color: "#cbd5e1", marginTop: "2px" }}>
                    {t === 0 ? "Scenario Start" : t === 1 ? "Target X Spawns" : t === 2 ? "EW Jamming Begins" : t === 3 ? "Target X Closes" : t === 4 ? "Unit A Tracks" : t === 5 ? "Decision Logged" : t === 6 ? "EW Subsides" : "Scenario Complete"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Trainee Perception */}
          <div>
            <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "#c084fc", marginBottom: "6px" }}>
              TRAINEE OBSERVED REALITY (DEGRADED FEEDS & UNCERTAINTY HORIZON)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "4px" }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((t) => (
                <div key={t} style={{ textAlign: "center", padding: "6px 2px", background: t === aarEvaluation.decisionMomentT ? "rgba(168, 85, 247, 0.25)" : "rgba(14, 21, 37, 0.6)", border: t === aarEvaluation.decisionMomentT ? "1px solid #c084fc" : "1px solid rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                  <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "#c084fc" }}>T={t}</div>
                  <div style={{ fontSize: "0.65rem", color: "#cbd5e1", marginTop: "2px" }}>
                    {t === 0 ? "HQ Brief" : t === 1 ? "Unverified Radar" : t === 2 ? "Comms Glitch" : t === 3 ? "Conflicting IFF" : t === 4 ? "Cross-Check Sent" : t === 5 ? "Action Transmitted" : t === 6 ? "Comms Restored" : "AAR Produced"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4-Quadrant Matrix (Blueprint Page 6) */}
      <div className="glass-panel" style={{ padding: "14px" }}>
        <div className="section-header" style={{ padding: "0 0 10px 0" }}>
          <span>Evaluating the Decision, Not the Outcome (4-Quadrant Matrix)</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
          {/* Top Left: Defensible Decision */}
          <div className={`quadrant-box defensible ${aarEvaluation.classification === "DEFENSIBLE" ? "active-quadrant" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#38bdf8", fontSize: "0.85rem" }}>DEFENSIBLE DECISION</span>
              <span className="badge-tag badge-normal">HIGH SCORE</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Good Reasoning + Bad Outcome</div>
            <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginTop: "4px" }}>
              Trainee rigorously verified conflicting cues and mitigated tactical exposure. Adverse outcome was due to external factors.
            </div>
          </div>

          {/* Top Right: Optimal */}
          <div className={`quadrant-box optimal ${aarEvaluation.classification === "OPTIMAL" ? "active-quadrant" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#10b981", fontSize: "0.85rem" }}>OPTIMAL DECISION</span>
              <span className="badge-tag" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399" }}>HIGH SCORE</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Good Reasoning + Good Outcome</div>
            <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginTop: "4px" }}>
              Exemplary tactical situational awareness. Thorough evidence correlation combined with decisive operational execution.
            </div>
          </div>

          {/* Bottom Left: Critical Failure */}
          <div className={`quadrant-box critical_failure ${aarEvaluation.classification === "CRITICAL_FAILURE" ? "active-quadrant" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#f87171", fontSize: "0.85rem" }}>CRITICAL FAILURE</span>
              <span className="badge-tag badge-dropout">LOW SCORE</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Poor Reasoning + Bad Outcome</div>
            <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginTop: "4px" }}>
              Ignored sensor discrepancies, failed to establish communication with subordinate units, and enacted reckless fire.
            </div>
          </div>

          {/* Bottom Right: Lucky Guess */}
          <div className={`quadrant-box lucky_guess ${aarEvaluation.classification === "LUCKY_GUESS" ? "active-quadrant" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.85rem" }}>LUCKY GUESS</span>
              <span className="badge-tag badge-conflicting">LOW SCORE</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Poor Reasoning + Good Outcome</div>
            <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginTop: "4px" }}>
              Gambled without verification and hit the target purely by chance. Architecture strictly penalizes this to prevent bad habits.
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot of Uncertainty at T=Decision & Instructor Rubric */}
      <div className="aar-grid-2">
        {/* Left: Frozen Snapshot of Uncertainty */}
        <div className="glass-panel" style={{ padding: "14px" }}>
          <div className="section-header" style={{ padding: "0 0 10px 0" }}>
            <span>Forensic Snapshot at T={aarEvaluation.decisionMomentT}</span>
          </div>
          {lastDecision ? (
            <div style={{ fontSize: "0.8rem", color: "#cbd5e1", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div><strong>Action Transmitted:</strong> {lastDecision.action} on {lastDecision.targetEntityId}</div>
              <div><strong>Self-Assessed Confidence:</strong> {lastDecision.confidenceScore}%</div>
              <div><strong>Assumed Tactical Risk:</strong> {lastDecision.assumedRisk}</div>
              <div><strong>Documented Defense Rationale:</strong> "{lastDecision.rationale}"</div>
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Evidence Feeds Visible on Trainee Screen at T={aarEvaluation.decisionMomentT}:
                </span>
                <div style={{ maxHeight: "100px", overflowY: "auto", marginTop: "4px" }}>
                  {snapshotAtT5?.visibleFeeds.map((f) => (
                    <div key={f.id} style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "2px" }}>
                      • [{f.degradationType}] {f.sourceUnit}: {f.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>No decision recorded.</div>
          )}
        </div>

        {/* Right: Human Instructor Rubric Form */}
        <div className="glass-panel" style={{ padding: "14px" }}>
          <div className="section-header" style={{ padding: "0 0 10px 0", color: "#a855f7" }}>
            <span>Instructor Human Evaluation Rubric</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                <span>Situational Awareness</span>
                <span style={{ color: "var(--text-cyan)", fontWeight: 700 }}>{situationalAwareness} / 5.0</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={situationalAwareness}
                onChange={(e) => setSituationalAwareness(Number(e.target.value))}
                className="tactical-slider"
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                <span>Risk Management & Caution</span>
                <span style={{ color: "var(--text-cyan)", fontWeight: 700 }}>{riskManagement} / 5.0</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={riskManagement}
                onChange={(e) => setRiskManagement(Number(e.target.value))}
                className="tactical-slider"
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                <span>Adaptability under Comms Blackout</span>
                <span style={{ color: "var(--text-cyan)", fontWeight: 700 }}>{adaptability} / 5.0</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={adaptability}
                onChange={(e) => setAdaptability(Number(e.target.value))}
                className="tactical-slider"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>
                Instructor Debrief Commentary
              </label>
              <textarea
                value={evaluatorNotes}
                onChange={(e) => setEvaluatorNotes(e.target.value)}
                rows={2}
                className="tactical-input"
              />
            </div>

            <button onClick={handleUpdateScores} className="btn-tactical btn-cyan" style={{ width: "100%", padding: "8px", fontSize: "0.75rem" }}>
              Save Rubric Evaluation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
