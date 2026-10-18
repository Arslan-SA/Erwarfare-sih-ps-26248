// src/components/Header.tsx
import { useSimulation } from "../store/simulation";
import type { Role } from "../types/simulation";

export default function Header() {
  const {
    currentUser,
    currentRole,
    setCurrentRole,
    activeView,
    setActiveView,
    simTime,
    clockRunning,
    connectionStatus,
    aarEvaluation,
    logout,
  } = useSimulation();

  const mins = Math.floor(simTime / 60);
  const secs = simTime % 60;
  const zuluString = `T+${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}Z`;

  const isInstructor = currentUser?.role === "INSTRUCTOR";

  const handleAARToggle = () => {
    if (!isInstructor && !aarEvaluation) {
      alert("AAR ACCESS RESTRICTED: The After Action Review is generated upon decision submission or exercise completion by the Lead Instructor.");
      return;
    }
    setActiveView(activeView === "TACTICAL" ? "AAR" : "TACTICAL");
  };

  return (
    <header className="hud-header">
      <div className="hud-title-group">
        <div>
          <div className="hud-title">
            <span>🛡️</span>
            <span>Immersive Multi-Domain Decision Trainer</span>
          </div>
          <div className="hud-subtitle">
            SIH26248 · MALACCA STRAIT C4I · SESSION:{" "}
            <strong style={{ color: "var(--text-cyan)", fontFamily: "var(--font-mono)" }}>
              {currentUser?.sessionId || "SES-MALACCA-001"}
            </strong>
          </div>
        </div>

        {/* View Toggle */}
        <div className="role-tabs" style={{ marginLeft: "12px" }}>
          <button
            onClick={() => setActiveView("TACTICAL")}
            className={`role-tab ${activeView === "TACTICAL" ? "active" : ""}`}
          >
            Tactical Simulation
          </button>
          <button
            onClick={handleAARToggle}
            className={`role-tab ${activeView === "AAR" ? "active" : ""}`}
            style={{
              background: activeView === "AAR" ? "#7c3aed" : "transparent",
              opacity: !isInstructor && !aarEvaluation ? 0.6 : 1,
            }}
            title={!isInstructor && !aarEvaluation ? "AAR unlocks post-exercise" : "Switch to AAR debrief"}
          >
            After Action Review (AAR) {!isInstructor && !aarEvaluation ? "🔒" : ""}
          </button>
        </div>
      </div>

      <div className="hud-controls-group">
        {/* Zulu Simulation Clock */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            SIM CLOCK:
          </span>
          <div className="zulu-clock">
            {zuluString} {clockRunning ? "●" : "⏸"}
          </div>
        </div>

        {/* Role-Based Operational Badge / Inspector */}
        {isInstructor ? (
          /* Instructor has permission to inspect trainee station horizons */
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.65rem", color: "#f59e0b", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              INSPECT HORIZON:
            </span>
            <div className="role-tabs">
              {(["INSTRUCTOR", "COMMANDER", "UNIT_A", "UNIT_B"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setCurrentRole(r)}
                  className={`role-tab ${
                    currentRole === r
                      ? r === "INSTRUCTOR"
                        ? "instructor-active"
                        : "active"
                      : ""
                  }`}
                  style={{ fontSize: "0.68rem", padding: "4px 8px" }}
                >
                  {r === "INSTRUCTOR" ? "Omniscient" : r === "COMMANDER" ? "Cmdr" : r}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Trainees are strictly locked into their authorized duty station */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 10px",
              borderRadius: "4px",
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            <span style={{ fontSize: "0.85rem" }}>
              {currentRole === "COMMANDER" ? "🛡️" : currentRole === "UNIT_A" ? "📡" : "🚢"}
            </span>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-cyan)" }}>
                {currentUser?.callSign || currentRole}
              </div>
              <div style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                STATION: {currentRole} (LOCKED)
              </div>
            </div>
          </div>
        )}

        {/* Operator User Profile & Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {currentUser && (
            <button
              onClick={() => {
                if (confirm(`Sign out from station ${currentRole}?`)) {
                  logout();
                }
              }}
              className="btn-tactical btn-outline"
              style={{
                fontSize: "0.68rem",
                padding: "4px 8px",
                borderColor: "rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
              }}
              title="Sign out and return to duty station login gateway"
            >
              Sign Out
            </button>
          )}

          {/* Live WebSocket Status Pill */}
          <div className={`status-pill ${connectionStatus}`}>
            <div className="status-dot" />
            <span>{connectionStatus === "connected" ? "WS ACTIVE" : connectionStatus}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
