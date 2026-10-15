// src/App.tsx
import { useState } from "react";
import Header from "./components/Header";
import TacticalMap from "./components/TacticalMap";
import FeedStream from "./components/FeedStream";
import DecisionDock from "./components/DecisionDock";
import InstructorPanel from "./components/InstructorPanel";
import AARView from "./components/AARView";
import VerificationModal from "./components/VerificationModal";
import useSimulationSocket from "./hooks/useSimulationSocket";
import { useSimulation } from "./store/simulation";

export default function App() {
  // Initialize WebSocket & Scenario Simulation Engine
  useSimulationSocket();

  const { activeView, currentRole } = useSimulation();
  const [isVerificationOpen, setIsVerificationOpen] = useState<boolean>(false);

  return (
    <div className="app-container">
      {/* Tactical HUD Header */}
      <Header />

      {/* Main Workspace View */}
      {activeView === "AAR" ? (
        <AARView />
      ) : (
        <main className="main-workspace">
          {/* Left Viewport: Tactical Situation Map */}
          <section className="viewport-left glass-panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="section-header">
              <span>Tactical Situation Display (MGRS C2 Grid)</span>
              <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-cyan)" }}>
                {currentRole === "INSTRUCTOR" ? "OMNISCIENT TRUTH" : `RESTRICTED HORIZON (${currentRole})`}
              </span>
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              <TacticalMap />
            </div>
          </section>

          {/* Right Viewport: Role Specific Controls */}
          <section className="viewport-right">
            {currentRole === "INSTRUCTOR" ? (
              <InstructorPanel />
            ) : (
              <>
                {/* Incoming Feeds with Cross-Check trigger */}
                <div style={{ flex: 6, minHeight: 0 }}>
                  <FeedStream onOpenVerification={() => setIsVerificationOpen(true)} />
                </div>

                {/* Structured Decision Dock (for Commander) or Unit Telemetry */}
                <div style={{ flex: 5, minHeight: 0 }}>
                  {currentRole === "COMMANDER" ? (
                    <DecisionDock />
                  ) : (
                    <div className="glass-panel" style={{ padding: "16px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div className="section-header" style={{ padding: "0 0 8px 0" }}>
                          <span>{currentRole} Subordinate Station</span>
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "8px" }}>
                          You are currently logged in as <strong>{currentRole}</strong>. Your sensor telemetry is streamed to Headquarters.
                          Use the <strong>Cross-Check Unit</strong> button or incoming queries to assist Commander decision-making.
                        </p>
                      </div>

                      <button
                        onClick={() => setIsVerificationOpen(true)}
                        className="btn-tactical btn-cyan"
                        style={{ width: "100%", padding: "10px" }}
                      >
                        Transmit Subordinate Observation
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      )}

      {/* Verification Dialog */}
      <VerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
      />
    </div>
  );
}
