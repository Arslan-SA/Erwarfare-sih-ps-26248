// src/components/InstructorPanel.tsx
import { useSimulation } from "../store/simulation";

export default function InstructorPanel() {
  const {
    simTime,
    clockRunning,
    setClockRunning,
    timeMultiplier,
    setTimeMultiplier,
    resetSimulation,
    ewIntensity,
    setEWIntensity,
    commsSeveredUnits,
    toggleCommsLink,
    injectConflictingReport,
    decisions,
    verifications,
    setActiveView,
  } = useSimulation();

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <div className="section-header" style={{ color: "#a855f7" }}>
        <span>Instructor Closed-Loop Control & Injections</span>
        <span className="badge-tag" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc" }}>
          MASTER CONTROL
        </span>
      </div>

      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Simulation Clock Controls */}
        <div style={{ background: "rgba(10, 16, 28, 0.7)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "8px" }}>
            SIMULATION CLOCK & PACING
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setClockRunning(!clockRunning)}
              className={`btn-tactical ${clockRunning ? "btn-amber" : "btn-cyan"}`}
              style={{ flex: 1 }}
            >
              {clockRunning ? "⏸ Pause Clock" : "▶ Start Simulation"}
            </button>
            <button
              onClick={resetSimulation}
              className="btn-tactical btn-outline"
              style={{ padding: "8px 12px" }}
            >
              ↺ Reset (T=0)
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px", marginTop: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginRight: "4px" }}>Speed:</span>
            {[1, 2, 5].map((mult) => (
              <button
                key={mult}
                onClick={() => setTimeMultiplier(mult)}
                className={`btn-tactical ${timeMultiplier === mult ? "btn-cyan" : "btn-outline"}`}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {mult}x
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--text-amber)" }}>
              Step T={simTime}/7
            </span>
          </div>
        </div>

        {/* Dynamic Injection Engine */}
        <div style={{ background: "rgba(10, 16, 28, 0.7)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-warning)" }}>
          <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-amber)", marginBottom: "10px", fontWeight: 700 }}>
            DYNAMIC SCENARIO INJECTION ENGINE
          </div>

          {/* EW Jamming Slider */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
              <span>OVERRIDE EW JAMMING INTENSITY</span>
              <span style={{ color: "#ef4444", fontWeight: 700 }}>{ewIntensity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={ewIntensity}
              onChange={(e) => setEWIntensity(Number(e.target.value))}
              className="tactical-slider"
              style={{ accentColor: "#ef4444" }}
            />
          </div>

          {/* Comms Dropout Toggles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
            <button
              onClick={() => toggleCommsLink("unitA")}
              className={`btn-tactical ${commsSeveredUnits.unitA ? "btn-danger" : "btn-outline"}`}
              style={{ fontSize: "0.7rem", padding: "8px 4px" }}
            >
              {commsSeveredUnits.unitA ? "Restore Unit A Link" : "Drop Unit A Datalink"}
            </button>
            <button
              onClick={() => toggleCommsLink("unitB")}
              className={`btn-tactical ${commsSeveredUnits.unitB ? "btn-danger" : "btn-outline"}`}
              style={{ fontSize: "0.7rem", padding: "8px 4px" }}
            >
              {commsSeveredUnits.unitB ? "Restore Unit B Link" : "Drop Unit B Datalink"}
            </button>
          </div>

          {/* Inject Conflicting Report */}
          <button
            onClick={injectConflictingReport}
            className="btn-tactical btn-amber"
            style={{ width: "100%", fontSize: "0.75rem", padding: "8px" }}
          >
            ⚡ Inject Contradictory Sensor Report
          </button>
        </div>

        {/* Live Trainee Telemetry Stream */}
        <div style={{ background: "rgba(10, 16, 28, 0.7)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-cyan)", marginBottom: "8px" }}>
            <span>LIVE TRAINEE TELEMETRY</span>
            <span>{decisions.length} DECISIONS | {verifications.length} VERIFICATIONS</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
            {decisions.length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontStyle: "italic", padding: "8px" }}>
                Commander is currently assessing incoming sensor streams...
              </div>
            ) : (
              decisions.map((d) => (
                <div key={d.id} style={{ background: "rgba(56, 189, 248, 0.1)", borderLeft: "3px solid #38bdf8", padding: "6px 8px", borderRadius: "3px", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#38bdf8", fontWeight: 700 }}>
                    <span>ACTION: {d.action} (Target: {d.targetEntityId})</span>
                    <span>T={d.simTimestamp}</span>
                  </div>
                  <div style={{ color: "#cbd5e1", marginTop: "2px" }}>Confidence: {d.confidenceScore}%</div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.7rem", marginTop: "2px" }}>
                    Rationale: {d.rationale}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => setActiveView("AAR")}
            className="btn-tactical btn-cyan"
            style={{ width: "100%", marginTop: "12px", padding: "8px", fontSize: "0.75rem" }}
          >
            Open After Action Review (AAR) Suite
          </button>
        </div>
      </div>
    </div>
  );
}
