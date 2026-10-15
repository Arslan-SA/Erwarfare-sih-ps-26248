// src/components/Header.tsx
import { useSimulation } from "../store/simulation";
import type { Role } from "../types/simulation";

export default function Header() {
  const {
    currentRole,
    setCurrentRole,
    activeView,
    setActiveView,
    simTime,
    clockRunning,
    connectionStatus,
  } = useSimulation();

  const mins = Math.floor(simTime / 60);
  const secs = simTime % 60;
  const zuluString = `T+${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}Z`;

  return (
    <header className="hud-header">
      <div className="hud-title-group">
        <div>
          <div className="hud-title">
            <span>🛡️</span>
            <span>Immersive Multi-Domain Decision Trainer</span>
          </div>
          <div className="hud-subtitle">
            SIH26248 · OP NORTHERN AEGIS · AUTH: FASTAPI / WEBSOCKETS / PG
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
            onClick={() => setActiveView("AAR")}
            className={`role-tab ${activeView === "AAR" ? "active" : ""}`}
            style={{ background: activeView === "AAR" ? "#7c3aed" : "transparent" }}
          >
            After Action Review (AAR)
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

        {/* Role Selector Tabs */}
        <div className="role-tabs">
          {(["COMMANDER", "UNIT_A", "UNIT_B", "INSTRUCTOR"] as Role[]).map((role) => (
            <button
              key={role}
              onClick={() => setCurrentRole(role)}
              className={`role-tab ${
                currentRole === role
                  ? role === "INSTRUCTOR"
                    ? "instructor-active"
                    : "active"
                  : ""
              }`}
            >
              {role === "COMMANDER"
                ? "Commander"
                : role === "UNIT_A"
                ? "Unit A (Air)"
                : role === "UNIT_B"
                ? "Unit B (Sea)"
                : "Instructor"}
            </button>
          ))}
        </div>

        {/* Live WebSocket Status Pill */}
        <div className={`status-pill ${connectionStatus}`}>
          <div className="status-dot" />
          <span>{connectionStatus === "connected" ? "WS LINK ACTIVE" : connectionStatus}</span>
        </div>
      </div>
    </header>
  );
}
