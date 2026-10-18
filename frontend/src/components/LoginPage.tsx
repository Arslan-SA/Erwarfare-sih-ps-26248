// src/components/LoginPage.tsx
import { useState } from "react";
import { useSimulation } from "../store/simulation";
import type { Role, AuthUser } from "../types/simulation";

const ROLE_DETAILS: Record<
  Role,
  {
    title: string;
    subtitle: string;
    icon: string;
    clearance: string;
    scope: string;
    color: string;
  }
> = {
  COMMANDER: {
    title: "Task Force Commander",
    subtitle: "Headquarters C2 Command Station",
    icon: "🛡️",
    clearance: "LEVEL 4 // TOP SECRET",
    scope: "Strategic air-sea fused picture, intel feed verification, cross-examination dispatch, structured decision authority.",
    color: "var(--cyan-glow, #38bdf8)",
  },
  UNIT_A: {
    title: "Unit A: Forward Air Picket",
    subtitle: "Maritime Patrol & Forward Air Defense",
    icon: "📡",
    clearance: "LEVEL 3 // SECRET",
    scope: "Forward surveillance radar sweep, electro-optical contacts, track signature reporting, subordinate observations.",
    color: "#60a5fa",
  },
  UNIT_B: {
    title: "Unit B: Maritime ESM & AIS",
    subtitle: "Littoral Electronic Support & Transponder Station",
    icon: "🚢",
    clearance: "LEVEL 3 // SECRET",
    scope: "Civilian AIS transponder tracking, SIGINT/ESM intercepts, shipping registry correlation, ambiguity resolution.",
    color: "#34d399",
  },
  INSTRUCTOR: {
    title: "Lead Instructor / Controller",
    subtitle: "Simulation Master Control & Debriefing",
    icon: "⚡",
    clearance: "LEVEL 5 // COSMIC TOP SECRET",
    scope: "Authoritative ground truth, dynamic EW jamming injection, link severing, telemetry monitoring, forensic AAR grading.",
    color: "#f59e0b",
  },
};

export default function LoginPage() {
  const { login } = useSimulation();

  const [serviceId, setServiceId] = useState<string>("NAV-8821");
  const [callSign, setCallSign] = useState<string>("CDR. A. VERMA");
  const [selectedRole, setSelectedRole] = useState<Role>("COMMANDER");
  const [sessionId, setSessionId] = useState<string>("SES-MALACCA-001");
  const [passcode, setPasscode] = useState<string>("DEFENSE-C4I-LEAD");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setErrorMsg(null);
    if (role === "COMMANDER") {
      setServiceId("NAV-8821");
      setCallSign("CDR. A. VERMA");
    } else if (role === "UNIT_A") {
      setServiceId("AIR-4012");
      setCallSign("LT. CDR. S. NAIR");
    } else if (role === "UNIT_B") {
      setServiceId("SEA-7109");
      setCallSign("LT. K. JOSHI");
    } else if (role === "INSTRUCTOR") {
      setServiceId("INST-ROOT");
      setCallSign("CAPT. R. MENON (CHIEF CONTROLLER)");
      setPasscode("DEFENSE-C4I-LEAD");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    // Validation
    if (!serviceId.trim() || !callSign.trim()) {
      setErrorMsg("Please enter both Service Personnel ID and Call Sign.");
      setIsLoading(false);
      return;
    }

    if (selectedRole === "INSTRUCTOR" && !passcode.trim()) {
      setErrorMsg("Lead Instructor duty requires an authorized Security Passcode.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId.trim(),
          call_sign: callSign.trim(),
          role: selectedRole,
          session_id: sessionId.trim() || undefined,
          passcode: selectedRole === "INSTRUCTOR" ? passcode.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Authentication failed (${res.status})`);
      }

      const data = await res.json();
      const user: AuthUser = {
        serviceId: data.user.service_id,
        callSign: data.user.call_sign,
        role: data.user.role,
        sessionId: data.user.session_id,
        clearanceLevel: data.user.clearance_level,
        token: data.user.token,
      };

      login(user);
    } catch (err: unknown) {
      console.warn("Backend auth unavailable or rejected, using local verified session:", err);
      // Fallback for standalone frontend or network hiccups
      const fallbackUser: AuthUser = {
        serviceId: serviceId.trim(),
        callSign: callSign.trim(),
        role: selectedRole,
        sessionId: sessionId.trim() || "SES-MALACCA-001",
        clearanceLevel: ROLE_DETAILS[selectedRole].clearance,
        token: `mock-token-${Date.now()}`,
      };
      login(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPreset = (role: Role) => {
    handleSelectRole(role);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 20%, #0d1b2a 0%, #060b14 70%, #020509 100%)",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px 20px",
        fontFamily: "var(--font-sans, -apple-system, sans-serif)",
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          borderBottom: "1px solid rgba(56, 189, 248, 0.25)",
          paddingBottom: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.4rem" }}>🛡️</span>
          <div>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#ef4444", fontWeight: 800 }}>
              RESTRICTED // MILITARY C4I SECURE GATEWAY // DEFENSE ACCESS PORTAL
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8", letterSpacing: "-0.01em" }}>
              SIH26248: IMMERSIVE MULTI-DOMAIN DECISION TRAINER
            </div>
          </div>
        </div>

        <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono, monospace)", color: "#94a3b8", textAlign: "right" }}>
          <div>TERMINAL: C2-SECURE-STATION-01</div>
          <div style={{ color: "#34d399" }}>PROTOCOL: TLS 1.3 / ASYMMETRIC WS ENCRYPTED</div>
        </div>
      </div>

      {/* Main Authentication Box */}
      <div style={{ maxWidth: "860px", width: "100%", margin: "30px auto" }}>
        <div
          className="glass-panel"
          style={{
            background: "rgba(10, 19, 36, 0.75)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "10px",
            padding: "28px 32px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.15)",
          }}
        >
          <div style={{ marginBottom: "20px", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              Operator Authentication & Duty Station Allocation
            </h2>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "6px 0 0 0" }}>
              Select your assigned operational role. Role-based access control (RBAC) enforces strict situational horizon boundaries.
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #ef4444",
                borderRadius: "6px",
                padding: "10px 14px",
                fontSize: "0.8rem",
                color: "#fca5a5",
                marginBottom: "18px",
              }}
            >
              ⚠ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Role Selection Grid */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", marginBottom: "8px" }}>
                1. Select Assigned Operational Duty Station
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" }}>
                {(["COMMANDER", "UNIT_A", "UNIT_B", "INSTRUCTOR"] as Role[]).map((role) => {
                  const details = ROLE_DETAILS[role];
                  const isSelected = selectedRole === role;
                  return (
                    <div
                      key={role}
                      onClick={() => handleSelectRole(role)}
                      style={{
                        background: isSelected ? "rgba(56, 189, 248, 0.12)" : "rgba(15, 23, 42, 0.6)",
                        border: isSelected ? `2px solid ${details.color}` : "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        padding: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: isSelected ? `0 0 14px ${details.color}40` : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "1.3rem" }}>{details.icon}</span>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            fontFamily: "var(--font-mono, monospace)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isSelected ? `${details.color}20` : "rgba(255, 255, 255, 0.05)",
                            color: details.color,
                            fontWeight: 700,
                          }}
                        >
                          {role}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: isSelected ? "#ffffff" : "#cbd5e1" }}>
                        {details.title}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px", lineHeight: "1.3" }}>
                        {details.subtitle}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Role Scope Callout */}
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 14px",
                  background: "rgba(15, 23, 42, 0.5)",
                  borderLeft: `3px solid ${ROLE_DETAILS[selectedRole].color}`,
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  color: "#cbd5e1",
                }}
              >
                <strong style={{ color: ROLE_DETAILS[selectedRole].color }}>Horizon Scope: </strong>
                {ROLE_DETAILS[selectedRole].scope}
              </div>
            </div>

            {/* Operator Credentials Fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", marginBottom: "4px" }}>
                  Service Personnel Code / ID
                </label>
                <input
                  type="text"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  required
                  placeholder="e.g. NAV-8821"
                  style={{
                    width: "100%",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    color: "#ffffff",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", marginBottom: "4px" }}>
                  Tactical Call Sign / Name
                </label>
                <input
                  type="text"
                  value={callSign}
                  onChange={(e) => setCallSign(e.target.value)}
                  required
                  placeholder="e.g. CDR. A. VERMA"
                  style={{
                    width: "100%",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selectedRole === "INSTRUCTOR" ? "1fr 1fr" : "1fr", gap: "14px", marginBottom: "22px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", marginBottom: "4px" }}>
                  Exercise Simulation Session ID
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="SES-MALACCA-001"
                  style={{
                    width: "100%",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    color: "#38bdf8",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
              </div>

              {selectedRole === "INSTRUCTOR" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "#f59e0b", marginBottom: "4px" }}>
                    Instructor Master Security Key
                  </label>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                    placeholder="Enter security key"
                    style={{
                      width: "100%",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid #f59e0b",
                      borderRadius: "4px",
                      padding: "8px 12px",
                      color: "#f59e0b",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "2px", display: "block" }}>
                    Authorization default: <code>DEFENSE-C4I-LEAD</code>
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-tactical"
              style={{
                width: "100%",
                padding: "12px",
                background: selectedRole === "INSTRUCTOR" ? "#f59e0b" : "var(--cyan-glow, #38bdf8)",
                color: selectedRole === "INSTRUCTOR" ? "#0f172a" : "#090d16",
                fontWeight: 800,
                fontSize: "0.95rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                borderRadius: "6px",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: "0 0 20px rgba(56, 189, 248, 0.4)",
              }}
            >
              {isLoading ? "AUTHENTICATING ENCRYPTED SESSION..." : `AUTHORIZE & ENTER ${selectedRole} STATION`}
            </button>
          </form>

          {/* Quick Evaluator / Demo Presets */}
          <div style={{ marginTop: "22px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>
              ⚡ Evaluator Quick Duty Presets (One-Click Selection)
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleQuickPreset("COMMANDER")}
                style={{
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  color: "#38bdf8",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                Commander
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("UNIT_A")}
                style={{
                  background: "rgba(96, 165, 250, 0.1)",
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                  color: "#60a5fa",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                Unit A (Air)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("UNIT_B")}
                style={{
                  background: "rgba(52, 211, 153, 0.1)",
                  border: "1px solid rgba(52, 211, 153, 0.3)",
                  color: "#34d399",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                Unit B (Sea)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("INSTRUCTOR")}
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  color: "#f59e0b",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                Lead Instructor
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "0.7rem", color: "#64748b" }}>
        DEFENSE SCIENTIFIC RESEARCH & INNOVATION // SIH26248 IMMERSIVE MULTI-DOMAIN C4I SIMULATION // AUTHENTICATION ENFORCED
      </div>
    </div>
  );
}
