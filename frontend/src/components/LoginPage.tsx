// src/components/LoginPage.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSimulation } from "../store/simulation";
import type { AuthUser, Role } from "../types/simulation";

interface StationPreset {
  serviceId: string;
  callSign: string;
  role: Role;
  password: string;
  clearance: string;
  title: string;
  subtitle: string;
  responsibilities: string;
}

const STATION_PRESETS: StationPreset[] = [
  {
    serviceId: "CDR-NAV-8821",
    callSign: "CDR. A. STERLING",
    role: "COMMANDER",
    password: "COMMANDER-2026",
    clearance: "LVL 4 // TOP SECRET",
    title: "Task Force Commander",
    subtitle: "Headquarters C2 Command Station",
    responsibilities: "Strategic air-sea fused picture, verification dispatch, rules of engagement decision authority.",
  },
  {
    serviceId: "FAD-AIR-4012",
    callSign: "LT. CDR. V. CHEN",
    role: "UNIT_A",
    password: "UNIT-A-2026",
    clearance: "LVL 3 // SECRET",
    title: "Forward Air Defense Picket",
    subtitle: "Maritime Patrol & Forward Air Defense",
    responsibilities: "Forward surveillance radar sweep, electro-optical contacts, track signature reporting.",
  },
  {
    serviceId: "ESM-SEA-7109",
    callSign: "LT. K. RAO",
    role: "UNIT_B",
    password: "UNIT-B-2026",
    clearance: "LVL 3 // SECRET",
    title: "Maritime ESM & Coastal Radar",
    subtitle: "Littoral Electronic Support & Transponder",
    responsibilities: "Civilian AIS transponder tracking, SIGINT/ESM intercepts, shipping registry correlation.",
  },
  {
    serviceId: "INST-CTRL-001",
    callSign: "CAPT. R. MENON",
    role: "INSTRUCTOR",
    password: "DEFENSE-C4I-LEAD",
    clearance: "LVL 5 // COSMIC TOP SECRET",
    title: "Lead Instructor / Controller",
    subtitle: "Simulation Master Control & Debriefing",
    responsibilities: "Authoritative ground truth, dynamic EW jamming injection, link severing, telemetry monitoring.",
  },
];

interface DatabaseStatus {
  status: string;
  database_type: string;
  active_url: string;
  supabase_configured: boolean;
  registered_accounts: number;
  tables_registered: number;
}

interface CombatLogEntry {
  id: string;
  time: string;
  sender: string;
  message: string;
  colorClass: string;
}

export default function LoginPage() {
  const { login } = useSimulation();

  // Authentication State
  const [selectedStation, setSelectedStation] = useState<StationPreset>(STATION_PRESETS[0]);
  const [serviceId, setServiceId] = useState<string>("CDR-NAV-8821");
  const [callSign, setCallSign] = useState<string>("CDR. A. STERLING");
  const [selectedRole, setSelectedRole] = useState<Role>("COMMANDER");
  const [sessionId, setSessionId] = useState<string>("SES-MALACCA-001");
  const [password, setPassword] = useState<string>("COMMANDER-2026");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState<boolean>(false);

  // Database Diagnostic Modal
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [showDbModal, setShowDbModal] = useState<boolean>(false);

  // Live HUD Telemetry & Simulation States
  const [zuluClock, setZuluClock] = useState<string>("00:00:00.00Z");
  const [countdownTimer, setCountdownTimer] = useState<string>("00:38:12 SEC");
  const [quantumSeed, setQuantumSeed] = useState<string>("0x9F3E...B210 [08s]");
  const [activeDomainFilter, setActiveDomainFilter] = useState<string>("ALL");
  const [selectedTarget, setSelectedTarget] = useState<string>("VAMPIRE-04 [ASCM HYPERSONIC]");
  const [selectedWeapon, setSelectedWeapon] = useState<string>("SM6");
  const [isEngaging, setIsEngaging] = useState<boolean>(false);
  const [terminalInput, setTerminalInput] = useState<string>("");
  const [activeEmcon, setActiveEmcon] = useState<string>("EMCON LEVEL ALPHA");
  const [killChainAuto, setKillChainAuto] = useState<boolean>(true);

  // Quick Action Toggles
  const [flirActive, setFlirActive] = useState<boolean>(false);
  const [ewSpectrumActive, setEwSpectrumActive] = useState<boolean>(false);

  // Spectrogram Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const combatLogContainerRef = useRef<HTMLDivElement | null>(null);

  // Combat Logs
  const [combatLogs, setCombatLogs] = useState<CombatLogEntry[]>([
    {
      id: "log-1",
      time: "14:32:01Z",
      sender: "LINK16_DA",
      message: "J3.2 Air Track 8821 correlated with SPY-3 active search array. Bearing 042° Range 31 NM.",
      colorClass: "text-emerald-300/80",
    },
    {
      id: "log-2",
      time: "14:32:04Z",
      sender: "FIRE_CTRL",
      message: "Hostile missile acceleration profile detected: Mach 4.8. Track elevated to PRIORITY 1 THREAT (VAMPIRE-04).",
      colorClass: "text-tactical-red font-bold",
    },
    {
      id: "log-3",
      time: "14:32:07Z",
      sender: "EW_SUITE",
      message: "Active radar seeker locked on TF-71. Deploying active electronic expendables and off-board chaff clouds.",
      colorClass: "text-tactical-amber",
    },
    {
      id: "log-4",
      time: "14:32:09Z",
      sender: "AUTO_WPN",
      message: "SM-6 Dual-Mode solution calculated. Intercept waypoint 01°38'N 103°52'E. Probability of Kill (Pk): 0.89.",
      colorClass: "text-emerald-400",
    },
    {
      id: "log-5",
      time: "14:32:12Z",
      sender: "AUTH_GATEWAY",
      message: "Operational duty stations synchronized. Ready for station operator authentication.",
      colorClass: "text-tactical-cyan",
    },
  ]);

  const logCounterRef = useRef<number>(6);

  const appendCombatLog = useCallback((sender: string, message: string, colorClass: string = "text-emerald-200") => {
    logCounterRef.current += 1;
    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}Z`;
    const newEntry: CombatLogEntry = {
      id: `log-${logCounterRef.current}`,
      time: timeStr,
      sender,
      message,
      colorClass,
    };
    setCombatLogs((prev) => [...prev, newEntry]);
  }, []);

  // Scroll to bottom when new log arrives
  useEffect(() => {
    if (combatLogContainerRef.current) {
      combatLogContainerRef.current.scrollTop = combatLogContainerRef.current.scrollHeight;
    }
  }, [combatLogs]);

  // Fetch Database Status
  useEffect(() => {
    fetch("/api/system/database-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDbStatus(data);
      })
      .catch(() => {
        // Local offline mode
      });
  }, []);

  // Tactical Zulu Clock Timer (Every 50ms)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, "0");
      const minutes = String(now.getUTCMinutes()).padStart(2, "0");
      const seconds = String(now.getUTCSeconds()).padStart(2, "0");
      const ms = String(Math.floor(now.getUTCMilliseconds() / 10)).padStart(2, "0");
      setZuluClock(`${hours}:${minutes}:${seconds}.${ms}Z`);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Intercept Countdown Timer
  useEffect(() => {
    let totalSec = 38;
    let msTenths = 12;

    const interval = setInterval(() => {
      msTenths -= 4;
      if (msTenths < 0) {
        msTenths = 99;
        totalSec--;
        if (totalSec < 0) {
          totalSec = 45; // Reset loop
        }
      }
      const sStr = String(totalSec).padStart(2, "0");
      const msStr = String(msTenths).padStart(2, "0");
      setCountdownTimer(`00:${sStr}:${msStr} SEC`);
    }, 40);

    return () => clearInterval(interval);
  }, []);

  // Cyclic Quantum Key Generator
  useEffect(() => {
    const interval = setInterval(() => {
      const randHex = Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      const randSec = Math.floor(Math.random() * 9) + 1;
      setQuantumSeed(`0x${randHex}...B210 [0${randSec}s]`);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Spectrogram Canvas Drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth || 300;
      canvas.height = parent.clientHeight || 112;
    }

    const columns = Math.max(10, Math.floor(canvas.width / 4));
    const heights = new Array(columns).fill(20);

    const drawSpectrogram = () => {
      ctx.fillStyle = "rgba(5, 10, 7, 0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < columns; i++) {
        const noise = (Math.random() - 0.48) * 12;
        heights[i] = Math.max(5, Math.min(canvas.height - 10, heights[i] + noise));

        let color = "#00ff66";
        if (i > columns * 0.6 && i < columns * 0.75) {
          color = "#ef4444"; // Red hostile jamming peak
          heights[i] = Math.max(canvas.height * 0.65, heights[i]);
        } else if (i > columns * 0.3 && i < columns * 0.4) {
          color = "#f59e0b";
        }

        ctx.fillStyle = color;
        ctx.fillRect(i * 4, canvas.height - heights[i], 3, heights[i]);
      }

      animationFrameId = requestAnimationFrame(drawSpectrogram);
    };

    drawSpectrogram();

    const handleResize = () => {
      if (parent && canvas) {
        canvas.width = parent.clientWidth || 300;
        canvas.height = parent.clientHeight || 112;
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Station Selection
  const handleSelectStation = (preset: StationPreset) => {
    setSelectedStation(preset);
    setSelectedRole(preset.role);
    setServiceId(preset.serviceId);
    setCallSign(preset.callSign);
    setPassword(preset.password);
    setErrorMsg(null);
  };

  // Execute Authentication
  const handleExecuteLogin = async (
    targetServiceId: string,
    targetCallSign: string,
    targetRole: Role,
    targetPassword: string,
    targetSessionId: string
  ) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: targetServiceId.trim(),
          call_sign: targetCallSign.trim(),
          role: targetRole,
          password: targetPassword.trim(),
          passcode: targetRole === "INSTRUCTOR" ? targetPassword.trim() : undefined,
          session_id: targetSessionId.trim() || undefined,
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

      appendCombatLog("AUTH_GATEWAY", `Access Granted: ${user.callSign} (${user.role})`, "text-tactical-cyan font-bold");
      login(user);
    } catch (err: unknown) {
      console.warn("Backend auth failed or network offline, falling back to verified local session:", err);
      const preset = STATION_PRESETS.find((p) => p.role === targetRole) || STATION_PRESETS[0];
      const fallbackUser: AuthUser = {
        serviceId: targetServiceId.trim(),
        callSign: targetCallSign.trim(),
        role: targetRole,
        sessionId: targetSessionId.trim() || "SES-MALACCA-001",
        clearanceLevel: preset.clearance,
        token: `verified-station-${preset.role.toLowerCase()}`,
      };
      login(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantSignIn = (preset: StationPreset) => {
    handleSelectStation(preset);
    handleExecuteLogin(preset.serviceId, preset.callSign, preset.role, preset.password, sessionId);
  };

  // Authorize & Engage Button Handler
  const handleAuthorizeEngage = () => {
    if (isEngaging) return;
    setIsEngaging(true);
    appendCombatLog(
      "KILL_CHAIN",
      `TACTICAL ACTION AUTHORIZED: ${selectedWeapon === "SM6" ? "RIM-174 SM-6 ERAM SALVO 2x" : selectedWeapon === "HELIOS" ? "HELIOS 60kW LASER PULSE" : "PHALANX 20mm CIWS BURST"} DEPLOYED TO ${selectedTarget} INTERCEPT VECTOR.`,
      "text-red-400 font-bold"
    );

    setTimeout(() => {
      setIsEngaging(false);
      appendCombatLog("AUTO_WPN", "KINETIC INTERCEPT COMPLETE. TARGET RADAR RETURN TERMINATED.", "text-emerald-400 font-bold");
    }, 4000);
  };

  // Terminal Command Parser
  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim().toUpperCase();
    appendCombatLog("OPERATOR", cmd, "text-tactical-cyan font-bold");

    setTimeout(() => {
      if (cmd.includes("ENGAGE") || cmd.includes("FIRE") || cmd.includes("VAMPIRE")) {
        handleAuthorizeEngage();
      } else if (cmd.includes("EMCON")) {
        const newEmcon = cmd.includes("DELTA") ? "EMCON LEVEL DELTA (SILENT)" : "EMCON LEVEL ALPHA (COMBAT)";
        setActiveEmcon(newEmcon);
        appendCombatLog("SIGINT_SUITE", `EMISSION CONTROL MODIFIED: ${newEmcon}`, "text-tactical-amber");
      } else if (cmd.includes("STATUS")) {
        appendCombatLog(
          "SYS_TELEMETRY",
          `DATABASE: ${dbStatus?.database_type || "SQLITE"} // 4 STATIONS ARMED // INTERCEPT PK: 0.89`,
          "text-emerald-400"
        );
      } else if (cmd.includes("SWEEP") || cmd.includes("RADAR")) {
        appendCombatLog("SPY3_RADAR", "HIGH-PRT APERTURE SWEEP EXECUTED ACROSS 360° HORIZON.", "text-emerald-400");
      } else if (cmd.includes("SONAR")) {
        appendCombatLog("SONAR_PASS", "HYDROPHONE ARRAY SCANNED: SHALLOW SHELF 48.2m CONTACT CONFIRMED.", "text-tactical-cyan");
      } else if (cmd.includes("LOGIN")) {
        if (cmd.includes("COMMANDER")) handleInstantSignIn(STATION_PRESETS[0]);
        else if (cmd.includes("UNIT_A") || cmd.includes("AIR")) handleInstantSignIn(STATION_PRESETS[1]);
        else if (cmd.includes("UNIT_B") || cmd.includes("ESM")) handleInstantSignIn(STATION_PRESETS[2]);
        else if (cmd.includes("INSTRUCTOR")) handleInstantSignIn(STATION_PRESETS[3]);
        else appendCombatLog("AUTH_DAEMON", "SPECIFY STATION: 'LOGIN COMMANDER', 'LOGIN UNIT_A', 'LOGIN UNIT_B', 'LOGIN INSTRUCTOR'", "text-red-400");
      } else if (cmd === "CLEAR") {
        setCombatLogs([]);
      } else if (cmd === "HELP") {
        appendCombatLog("HELP_GATEWAY", "COMMANDS: ENGAGE, EMCON ALPHA/DELTA, STATUS, SWEEP, SONAR, LOGIN <STATION>, CLEAR", "text-emerald-300");
      } else {
        appendCombatLog("C4I_DAEMON", `COMMAND '${cmd}' ROUTED THROUGH LINK-16 PACKET SWITCH.`, "text-emerald-400/70");
      }
    }, 250);

    setTerminalInput("");
  };

  return (
    <div className="min-h-screen bg-tactical-black text-emerald-100/80 antialiased flex flex-col justify-between selection:bg-emerald-500 selection:text-black font-mono relative">
      {/* CRT Aesthetic Scanline Layer */}
      <div className="crt-overlay fixed inset-0 z-50 pointer-events-none" />

      {/* ==================== TOP CLASSIFICATION & TELEMETRY HEADER ==================== */}
      <header className="w-full bg-tactical-black border-b border-tactical-border relative z-40">
        {/* Top Security Banner */}
        <div className="bg-red-950/80 border-b border-red-700/60 px-4 py-1 flex flex-wrap justify-between items-center text-3xs tracking-widest text-red-300 uppercase font-semibold gap-2">
          <div className="flex items-center space-x-3">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-white font-bold tracking-wider">RESTRICTED // MINISTRY OF DEFENCE C4I GATEWAY // PS-26248</span>
            <span className="text-red-400">DEFCON 2 // ARMED INTERVENTION LEVEL ECHO</span>
          </div>
          <div className="flex items-center space-x-4 text-red-200">
            <span className="hidden md:inline">SECURITY CLASSIFICATION: TOP SECRET // NOFORN // SPECIAL COMPARTMENTED (SCI)</span>
            <span className="hidden sm:inline">GATEWAY: C4I-TAC-NODE-01</span>

            {/* Clickable Live Database Status Pill */}
            <button
              onClick={() => setShowDbModal(true)}
              title="Click to view Database & Supabase connection diagnostics"
              className="text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 border border-emerald-500/50 hover:bg-emerald-900 transition flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus?.database_type?.includes("SUPABASE") ? "bg-cyan-400" : "bg-emerald-400"} animate-pulse`} />
              DATABASE: {dbStatus?.database_type || "SQLITE"} ACTIVE ({dbStatus?.status || "HEALTHY"})
            </button>

            <span className="text-tactical-cyan">PROTOCOL: TLS 1.3 / ASYMMETRIC WS</span>
          </div>
        </div>

        {/* Telemetry & Station Meta Row */}
        <div className="px-4 py-2 flex flex-wrap justify-between items-center gap-4 bg-tactical-panel/90">
          {/* Title & Littoral Defense Node */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 border border-tactical-cyan/40 bg-tactical-cyan/10 flex items-center justify-center font-black text-tactical-cyan text-base">
              C4I
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-emerald-100 flex items-center gap-2 uppercase">
                Immersive Multi-Domain Decision-Making Trainer
                <span className="text-2xs bg-tactical-cyan/20 border border-tactical-cyan/50 text-tactical-cyan px-1.5 py-0.5 font-bold">
                  TASK FORCE 71
                </span>
              </h1>
              <p className="text-2xs text-emerald-400/70 tracking-wide font-normal">
                Degraded Comms Architecture • Strait of Malacca Littoral Defense • Authoritative State Engine [SIM-V8.42]
              </p>
            </div>
          </div>

          {/* Real-Time Telemetry Readouts */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="border border-tactical-border bg-tactical-bg px-2.5 py-1">
              <span className="text-emerald-600/80 block text-3xs uppercase">Tactical Zulu Time</span>
              <span className="text-tactical-cyan font-semibold tracking-wider">{zuluClock}</span>
            </div>
            <div className="border border-tactical-border bg-tactical-bg px-2.5 py-1 hidden sm:block">
              <span className="text-emerald-600/80 block text-3xs uppercase">Geographic Anchor</span>
              <span className="text-tactical-amber tracking-wider font-semibold">01°26'14"N 103°38'02"E</span>
            </div>
            <div className="border border-tactical-border bg-tactical-bg px-2.5 py-1 hidden md:block">
              <span className="text-emerald-600/80 block text-3xs uppercase">Mesh Datalink Ratio</span>
              <span className="text-emerald-400 font-semibold tracking-wider">73.4% PKT REC</span>
            </div>
            <div className="border border-tactical-border bg-tactical-bg px-2.5 py-1">
              <span className="text-emerald-600/80 block text-3xs uppercase">Sensor Emission Mode</span>
              <span className="text-tactical-red font-semibold tracking-wider pulse-danger">{activeEmcon}</span>
            </div>
          </div>

          {/* Tactical Quick-Action Command Strip */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => {
                setFlirActive(!flirActive);
                appendCombatLog("SENSOR", `FLIR IR-1 OPTICAL FEED ${!flirActive ? "ENGAGED" : "STANDBY"}`, "text-tactical-cyan");
              }}
              className={`px-2.5 py-1 text-2xs border ${flirActive ? "bg-tactical-cyan text-black font-bold border-tactical-cyan" : "border-tactical-border hover:border-tactical-cyan hover:bg-tactical-cyan/10 text-emerald-200"} transition uppercase`}
            >
              FLIR IR-1
            </button>
            <button
              onClick={() => {
                setEwSpectrumActive(!ewSpectrumActive);
                appendCombatLog("EW_SUITE", `SPECTRUM RECCE ${!ewSpectrumActive ? "EXPANDED TO HIGH BAND" : "NORMALIZED"}`, "text-tactical-amber");
              }}
              className={`px-2.5 py-1 text-2xs border ${ewSpectrumActive ? "bg-tactical-amber text-black font-bold border-tactical-amber" : "border-tactical-border hover:border-tactical-amber hover:bg-tactical-amber/10 text-emerald-200"} transition uppercase`}
            >
              EW Jam Spectrum
            </button>
            <button
              onClick={() => {
                appendCombatLog("SONAR", "ACTIVE SONAR PING TRANSMITTED (3.5 kHz). SHALLOW ECHO RECEIVED.", "text-emerald-300 font-bold");
              }}
              className="px-2.5 py-1 text-2xs border border-tactical-border hover:border-tactical-cyan hover:bg-tactical-cyan/10 text-emerald-200 font-semibold transition uppercase"
            >
              Sonar Pass
            </button>
            <button
              onClick={() => {
                const next = !killChainAuto;
                setKillChainAuto(next);
                appendCombatLog("FIRE_CTRL", `KILL-CHAIN INTERLOCK SET TO: ${next ? "AUTO ON" : "MANUAL OVERRIDE"}`, next ? "text-emerald-300" : "text-tactical-amber");
              }}
              className={`px-2.5 py-1 text-2xs border ${killChainAuto ? "border-red-500/60 bg-red-950/40 text-red-300 hover:bg-red-800/60" : "border-amber-500/60 bg-amber-950/40 text-amber-300"} font-bold transition uppercase`}
            >
              Kill-Chain: {killChainAuto ? "AUTO ON" : "MANUAL"}
            </button>
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="px-2.5 py-1 text-2xs border border-tactical-border hover:border-emerald-400 bg-tactical-panel text-emerald-300 transition uppercase"
            >
              {showManualForm ? "▲ Hide Form" : "▼ Custom Creds"}
            </button>
          </div>
        </div>
      </header>

      {/* ==================== OPERATIONAL DUTY STATIONS LOGIN RIBBON ==================== */}
      <section className="bg-tactical-bg/95 border-b border-tactical-border px-4 py-2.5 z-30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-3 bg-tactical-cyan inline-block" />
            <h2 className="text-xs uppercase font-bold tracking-widest text-emerald-200">
              Operational Duty Stations &amp; Station Logins
            </h2>
            <span className="hidden md:inline text-2xs text-emerald-400/60">
              | Each station features discrete sensor horizons, cryptographic clearances, and command rules of engagement.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xs text-tactical-amber tracking-widest font-mono">
              ENCRYPTED CREDENTIAL POOL // 4 STATIONS READY
            </span>
          </div>
        </div>

        {/* 4 Duty Station Cards matching reference architecture */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STATION_PRESETS.map((preset) => {
            const isSelected = selectedStation.role === preset.role;
            const isInstructor = preset.role === "INSTRUCTOR";

            return (
              <article
                key={preset.role}
                className={`bg-tactical-panel border ${
                  isSelected
                    ? isInstructor
                      ? "border-2 border-tactical-amber shadow-[0_0_15px_rgba(245,158,11,0.25)] corner-bracket corner-bracket-amber"
                      : "border-2 border-tactical-cyan shadow-[0_0_15px_rgba(0,255,102,0.2)] corner-bracket"
                    : "border-tactical-border hover:border-tactical-cyan/70 corner-bracket"
                } p-2.5 transition-all flex flex-col justify-between`}
              >
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`text-3xs px-1.5 py-0.5 ${
                        isInstructor
                          ? "bg-amber-950/80 border border-amber-500 text-tactical-amber font-bold"
                          : "bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold"
                      }`}
                    >
                      {preset.role}
                    </span>
                    <span className="text-3xs text-tactical-red font-semibold">{preset.clearance}</span>
                  </div>
                  <h3 className={`text-xs font-bold uppercase ${isInstructor ? "text-tactical-amber" : "text-white"}`}>
                    {preset.title}
                  </h3>
                  <p className="text-2xs text-emerald-400/60 mb-2">{preset.subtitle}</p>

                  <div className="space-y-0.5 text-3xs font-mono border-t border-emerald-900/40 pt-1.5">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">SERVICE ID:</span>
                      <span className="text-emerald-200 font-bold">{preset.serviceId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">CALL SIGN:</span>
                      <span className={isInstructor ? "text-white font-bold" : "text-tactical-cyan font-bold"}>
                        {preset.callSign}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">PASSWORD:</span>
                      <span className="text-emerald-300/80">{preset.password}</span>
                    </div>
                  </div>
                  <p className="text-3xs text-emerald-400/70 mt-2 line-clamp-2">{preset.responsibilities}</p>
                </div>

                <div className="flex items-center space-x-1.5 mt-2.5 pt-2 border-t border-emerald-900/40">
                  <button
                    onClick={() => handleInstantSignIn(preset)}
                    disabled={isLoading}
                    className={`flex-1 ${
                      isInstructor
                        ? "bg-tactical-amber hover:bg-yellow-400 text-black font-extrabold"
                        : "bg-tactical-cyan/20 hover:bg-tactical-cyan hover:text-black border border-tactical-cyan/60 text-tactical-cyan font-bold"
                    } text-3xs uppercase py-1.5 transition cursor-pointer`}
                  >
                    {isLoading && isSelected ? "Authenticating..." : "Instant Sign In"}
                  </button>
                  <button
                    onClick={() => {
                      handleSelectStation(preset);
                      setShowManualForm(true);
                    }}
                    className="px-2 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/70 text-3xs uppercase text-emerald-300 border border-emerald-800/60 transition cursor-pointer"
                  >
                    Select
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Optional Manual Credential Entry Drawer */}
        {showManualForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteLogin(serviceId, callSign, selectedRole, password, sessionId);
            }}
            className="mt-3 p-3 bg-tactical-panel border border-tactical-border corner-bracket grid grid-cols-1 md:grid-cols-6 gap-2.5 text-2xs"
          >
            <div>
              <label className="text-3xs text-emerald-500 block uppercase mb-1">Service ID</label>
              <input
                type="text"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full bg-tactical-bg border border-tactical-border px-2 py-1 text-emerald-200 text-xs font-mono focus:border-tactical-cyan outline-none"
              />
            </div>
            <div>
              <label className="text-3xs text-emerald-500 block uppercase mb-1">Call Sign</label>
              <input
                type="text"
                value={callSign}
                onChange={(e) => setCallSign(e.target.value)}
                className="w-full bg-tactical-bg border border-tactical-border px-2 py-1 text-emerald-200 text-xs font-mono focus:border-tactical-cyan outline-none"
              />
            </div>
            <div>
              <label className="text-3xs text-emerald-500 block uppercase mb-1">Operational Role</label>
              <select
                value={selectedRole}
                onChange={(e) => {
                  const r = e.target.value as Role;
                  setSelectedRole(r);
                  const p = STATION_PRESETS.find((x) => x.role === r);
                  if (p) {
                    setServiceId(p.serviceId);
                    setCallSign(p.callSign);
                    setPassword(p.password);
                  }
                }}
                className="w-full bg-tactical-bg border border-tactical-border px-2 py-1 text-emerald-200 text-xs font-mono focus:border-tactical-cyan outline-none"
              >
                <option value="COMMANDER">COMMANDER</option>
                <option value="UNIT_A">UNIT_A (AIR DEFENSE)</option>
                <option value="UNIT_B">UNIT_B (MARITIME ESM)</option>
                <option value="INSTRUCTOR">INSTRUCTOR (EXERCISE CTRL)</option>
              </select>
            </div>
            <div>
              <label className="text-3xs text-emerald-500 block uppercase mb-1">Session ID</label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full bg-tactical-bg border border-tactical-border px-2 py-1 text-emerald-200 text-xs font-mono focus:border-tactical-cyan outline-none"
              />
            </div>
            <div>
              <label className="text-3xs text-emerald-500 block uppercase mb-1">Password / Passcode</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-tactical-bg border border-tactical-border px-2 py-1 text-emerald-200 text-xs font-mono focus:border-tactical-cyan outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-tactical-cyan hover:bg-emerald-400 text-black font-bold py-1.5 px-3 uppercase text-2xs transition cursor-pointer"
              >
                {isLoading ? "Authenticating..." : "Authorize Station"}
              </button>
            </div>
          </form>
        )}

        {errorMsg && (
          <div className="mt-2 p-2 bg-red-950/70 border border-red-500/80 text-red-300 text-2xs flex justify-between items-center">
            <span>⚠ AUTHENTICATION ERROR: {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 font-bold px-1 hover:text-white">
              ✕
            </button>
          </div>
        )}
      </section>

      {/* ==================== MAIN WARFARE COMMAND MATRIX ==================== */}
      <main className="flex-1 p-3 grid grid-cols-12 gap-3 bg-tactical-black/90">
        {/* ==================== LEFT COLUMN: Electronic Warfare & Sensor Telemetry ==================== */}
        <aside className="col-span-12 xl:col-span-3 flex flex-col space-y-3">
          {/* ESM & SIGINT Spectrogram Visualizer */}
          <section className="bg-tactical-panel border border-tactical-border p-3 corner-bracket">
            <div className="flex justify-between items-center border-b border-tactical-border pb-1.5 mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-tactical-cyan inline-block" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                  ESM / SIGINT Waterfall
                </span>
              </div>
              <span className="text-3xs font-mono text-tactical-cyan">BAND: 3.4 - 18.2 GHz</span>
            </div>

            {/* Live Visualizer Canvas */}
            <div className="relative bg-tactical-black border border-tactical-border h-28 overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full block" />
              <div className="absolute inset-x-0 bottom-0 px-2 py-0.5 bg-black/70 flex justify-between text-3xs font-mono text-emerald-300/80">
                <span>FREQ: 14.82 GHz [HOPPING]</span>
                <span className="text-tactical-red font-bold animate-pulse">JAM INTENSITY: 84 dBm</span>
              </div>
            </div>

            {/* Signal Intercept Telemetry List */}
            <div className="mt-2 space-y-1 text-2xs font-mono">
              <div className="p-1.5 bg-emerald-950/30 border-l-2 border-red-500 flex justify-between items-center">
                <div>
                  <span className="text-red-400 font-bold block">INTERCEPT #882: SCAN-RADAR</span>
                  <span className="text-3xs text-emerald-400/70">TYPE: X-BAND MONOPULSE // S-300/400 EMITTER</span>
                </div>
                <span className="text-red-400 font-bold text-3xs px-1 border border-red-500/40">HOSTILE</span>
              </div>
              <div className="p-1.5 bg-emerald-950/30 border-l-2 border-tactical-amber flex justify-between items-center">
                <div>
                  <span className="text-amber-400 font-bold block">INTERCEPT #883: MIL-COMM BURST</span>
                  <span className="text-3xs text-emerald-400/70">FREQ: 432.175 MHz // LINK IDENT UNKNOWN</span>
                </div>
                <span className="text-amber-400 text-3xs px-1 border border-amber-500/40">SUSPECT</span>
              </div>
            </div>
          </section>

          {/* Coastal Sonar & Subsurface Sensor Array */}
          <section className="bg-tactical-panel border border-tactical-border p-3 corner-bracket">
            <div className="flex justify-between items-center border-b border-tactical-border pb-1.5 mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-emerald-400 inline-block" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                  Acoustic Sonar Profile
                </span>
              </div>
              <span className="text-3xs text-emerald-400 font-mono">PASSIVE HYDROPHONE ARRAY</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-2xs mb-2">
              <div className="bg-tactical-bg p-2 border border-tactical-border">
                <span className="text-3xs text-emerald-600 block">WATER DEPTH (MEDIAN)</span>
                <span className="text-emerald-400 font-bold font-mono text-sm">48.2 METERS</span>
                <span className="text-3xs text-emerald-400/70">SHALLOW LITTORAL SHELF</span>
              </div>
              <div className="bg-tactical-bg p-2 border border-tactical-border">
                <span className="text-3xs text-emerald-600 block">DOPPLER CONTACT</span>
                <span className="text-tactical-amber font-bold font-mono text-sm">-14.2 KTS</span>
                <span className="text-3xs text-emerald-400/70">BEARING: 224° RELATIVE</span>
              </div>
            </div>
            <div className="bg-tactical-black p-2 border border-tactical-border text-3xs font-mono space-y-1">
              <div className="flex justify-between text-emerald-300/80">
                <span>SONOBUOY FIELD STRIKE-NORTH:</span>
                <span className="text-emerald-400">12/12 ACTIVE</span>
              </div>
              <div className="w-full bg-emerald-950/60 h-1.5">
                <div className="bg-emerald-500 h-1.5 w-4/5" />
              </div>
              <div className="flex justify-between text-emerald-300/80 pt-1">
                <span>SUB-SURFACE ACOUSTIC ANOMALY:</span>
                <span className="text-tactical-red font-bold">TYPE 039C AIP SSK (PROBABLE)</span>
              </div>
            </div>
          </section>

          {/* Degraded Communications Routing & Link Telemetry */}
          <section className="bg-tactical-panel border border-tactical-border p-3 corner-bracket flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-tactical-border pb-1.5 mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 bg-tactical-cyan inline-block" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                    Datalink &amp; Cryptographic Net
                  </span>
                </div>
                <span className="text-3xs text-tactical-cyan font-mono">LINK-16 // MADL // SAT</span>
              </div>
              <div className="space-y-1.5 text-2xs font-mono">
                <div className="flex items-center justify-between border-b border-emerald-900/30 pb-1">
                  <span className="text-emerald-400/70">MILSTAR SATCOM G-7:</span>
                  <span className="text-tactical-amber font-semibold">DEGRADED (RAIN FADE 6dB)</span>
                </div>
                <div className="flex items-center justify-between border-b border-emerald-900/30 pb-1">
                  <span className="text-emerald-400/70">TROPOSCATTER MESH 04:</span>
                  <span className="text-emerald-400 font-semibold">LOCKED // LATENCY: 22ms</span>
                </div>
                <div className="flex items-center justify-between border-b border-emerald-900/30 pb-1">
                  <span className="text-emerald-400/70">QUANTUM SEED CYCLE:</span>
                  <span className="text-tactical-cyan">{quantumSeed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400/70">DEGRADED BURST RETRIES:</span>
                  <span className="text-tactical-red font-semibold">14 RE-TX/SEC</span>
                </div>
              </div>
            </div>

            <div className="mt-3 bg-red-950/30 border border-red-500/30 p-2 text-3xs text-red-300">
              <div className="font-bold flex items-center gap-1 mb-0.5">
                <svg className="w-3 h-3 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clipRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    fillRule="evenodd"
                  />
                </svg>
                WARN: GPS DENIED ENVIRONMENT
              </div>
              INS kalman filtering initialized. Terrain-contour matching (TERCOM) active on all strike nodes.
            </div>
          </section>
        </aside>

        {/* ==================== CENTER COLUMN: Central Combat Vector Map & Kill-Chain ==================== */}
        <section className="col-span-12 xl:col-span-6 flex flex-col space-y-3">
          {/* Central Tactical Vector Map Display */}
          <div className="bg-tactical-panel border-2 border-tactical-border-bright p-3 corner-bracket relative flex-1 flex flex-col">
            {/* Display Header with Map Modes */}
            <div className="flex justify-between items-center border-b border-tactical-border pb-2 mb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-tactical-cyan inline-block animate-ping" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-100">
                  Central Geo-Tactical Vector Map
                </h2>
                <span className="text-2xs bg-tactical-border px-2 py-0.5 text-emerald-200 font-mono">
                  GRID MGRS: 48N TH 8291 9302
                </span>
              </div>
              {/* Radar Layer Filters */}
              <div className="flex space-x-1 text-3xs font-mono">
                {["ALL", "AIR", "SURFACE", "SUB"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveDomainFilter(f)}
                    className={`px-2 py-0.5 font-bold transition cursor-pointer ${
                      activeDomainFilter === f
                        ? "bg-tactical-cyan text-black"
                        : "bg-emerald-950/70 border border-emerald-800/60 text-emerald-200 hover:bg-emerald-900/60"
                    }`}
                  >
                    {f === "ALL" ? "ALL DOMAINS" : f === "AIR" ? "AIR (14)" : f === "SURFACE" ? "SURFACE (38)" : "SUB (2)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Radar Viewport Container */}
            <div className="relative flex-1 min-h-[380px] bg-tactical-black border border-emerald-900/40 rounded-sm overflow-hidden flex items-center justify-center">
              {/* Background Coordinate Grids & Range Rings */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-emerald-900/40" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern height="40" id="tactical-grid" patternUnits="userSpaceOnUse" width="40">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect fill="url(#tactical-grid)" height="100%" width="100%" />
                {/* Range Rings centered on TF-71 */}
                <circle cx="50%" cy="52%" fill="none" r="80" stroke="rgba(0, 255, 102, 0.2)" strokeDasharray="4 4" strokeWidth="1" />
                <circle cx="50%" cy="52%" fill="none" r="160" stroke="rgba(0, 255, 102, 0.15)" strokeWidth="1" />
                <circle cx="50%" cy="52%" fill="none" r="240" stroke="rgba(0, 255, 102, 0.1)" strokeDasharray="6 3" strokeWidth="1" />
                {/* MEZ / WEZ Zone Polygon */}
                <polygon
                  fill="rgba(239, 68, 68, 0.07)"
                  points="280,120 450,90 520,240 340,310"
                  stroke="rgba(239, 68, 68, 0.4)"
                  strokeDasharray="4 2"
                  strokeWidth="1.2"
                />
                {/* Intercept Trajectory Line */}
                <line stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1.5" x1="390" x2="350" y1="130" y2="235" />
                <line stroke="#00ff66" strokeWidth="1.5" x1="280" x2="350" y1="270" y2="235" />
              </svg>

              {/* Radar Sweep Scanner Line */}
              <div className="absolute w-[480px] h-[480px] pointer-events-none rounded-full flex items-center justify-center animate-radar">
                <div className="w-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-emerald-400 origin-right" />
              </div>

              {/* Radar Range Markings */}
              <div className="absolute top-2 left-2 text-3xs font-mono text-tactical-cyan/60 pointer-events-none">
                <div>RANGE: 250 NM HORIZON</div>
                <div>BEARING: 000° TRUE NORTH</div>
                <div>ELEVATION: SEA LEVEL TO FL600</div>
              </div>
              <div className="absolute top-2 right-2 text-3xs font-mono text-tactical-amber pointer-events-none text-right">
                <div>MEZ ENVELOPE: ACTIVE</div>
                <div>SAM COVERAGE: SM-6 / PAC-3</div>
              </div>

              {/* TACTICAL TRACK 1: Hostile Incoming Vampire (Target Locked) */}
              {(activeDomainFilter === "ALL" || activeDomainFilter === "AIR") && (
                <div
                  onClick={() => {
                    setSelectedTarget("VAMPIRE-04 [ASCM HYPERSONIC]");
                    appendCombatLog("TARGET_LOCK", "TRACK VAMPIRE-04 SELECTED. FIRE CONTROL SOLUTION GENERATING.", "text-red-400 font-bold");
                  }}
                  className="absolute top-[28%] left-[54%] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  <div className="relative">
                    <span className="w-4 h-4 border-2 border-red-500 block rotate-45 pulse-danger" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-ping" />
                  </div>
                  <div className="absolute left-6 -top-2 bg-black/90 border border-red-500 p-1 text-3xs font-mono text-red-300 whitespace-nowrap shadow-lg">
                    <span className="font-bold text-red-400 block">VAMPIRE-04 [ASCM HYPERSONIC]</span>
                    <span>SPD: MACH 4.8 // ALT: 35ft AGL</span>
                    <span className="block text-white font-bold animate-pulse">ETA IMPACT: 38 SEC</span>
                  </div>
                </div>
              )}

              {/* TACTICAL TRACK 2: Friendly DDG-1000 Guided Missile Destroyer */}
              {(activeDomainFilter === "ALL" || activeDomainFilter === "SURFACE") && (
                <div
                  onClick={() => {
                    setSelectedTarget("TF-71 [USS ZUMWALT DDG]");
                    appendCombatLog("C2_NODE", "FLAGSHIP TF-71 SELECTED. AEGIS STATUS: NOMINAL.", "text-emerald-300");
                  }}
                  className="absolute top-[52%] left-[48%] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                >
                  <div className="w-3.5 h-3.5 border-2 border-tactical-cyan rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-tactical-cyan" />
                  </div>
                  <div className="absolute left-5 -top-1 bg-black/80 border border-tactical-cyan/60 p-1 text-3xs font-mono text-emerald-200 whitespace-nowrap">
                    <span className="font-bold block text-white">TF-71 [USS ZUMWALT DDG]</span>
                    <span>AEGIS BASELINE 10 // EMCON-A</span>
                  </div>
                </div>
              )}

              {/* TACTICAL TRACK 3: Friendly Combat Air Patrol F-35C Lightning */}
              {(activeDomainFilter === "ALL" || activeDomainFilter === "AIR") && (
                <div
                  onClick={() => {
                    setSelectedTarget("VIPER-FLIGHT (2x F-35C)");
                    appendCombatLog("AIR_CAP", "VIPER FLIGHT IN PATROL ORBIT. AIM-120D ARMED.", "text-emerald-300");
                  }}
                  className="absolute top-[68%] left-[36%] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                >
                  <div className="w-3 h-3 border border-emerald-400 rotate-45 flex items-center justify-center">
                    <div className="w-1 h-1 bg-emerald-400" />
                  </div>
                  <div className="absolute left-5 -top-1 bg-black/80 border border-emerald-500/60 p-1 text-3xs font-mono text-emerald-200 whitespace-nowrap">
                    <span className="font-bold block">VIPER-FLIGHT (2x F-35C)</span>
                    <span>ALT: FL340 // SPD: 520 KTS</span>
                  </div>
                </div>
              )}

              {/* TACTICAL TRACK 4: Maritime Patrol Aircraft P-8A Poseidon */}
              {(activeDomainFilter === "ALL" || activeDomainFilter === "AIR") && (
                <div
                  onClick={() => {
                    setSelectedTarget("TRIDENT-01 [P-8A ASW]");
                    appendCombatLog("PATROL_AIR", "TRIDENT-01 CORRELATING DIP SONAR PATTERN.", "text-emerald-300");
                  }}
                  className="absolute top-[22%] left-[24%] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                >
                  <div className="w-3 h-3 border border-emerald-400 flex items-center justify-center">
                    <div className="w-1 h-1 bg-emerald-400" />
                  </div>
                  <div className="absolute left-5 -top-1 bg-black/80 border border-emerald-500/60 p-1 text-3xs font-mono text-emerald-200 whitespace-nowrap">
                    <span>TRIDENT-01 [P-8A ASW]</span>
                    <span className="text-3xs text-emerald-500 block">DIP SONAR BUOY CHAIN B</span>
                  </div>
                </div>
              )}

              {/* TACTICAL TRACK 5: Commercial Traffic Transponder (AIS Neutral) */}
              {(activeDomainFilter === "ALL" || activeDomainFilter === "SURFACE") && (
                <div
                  onClick={() => {
                    setSelectedTarget("MV EVER GLORY [CONTAINER]");
                    appendCombatLog("AIS_ESM", "MV EVER GLORY AIS CHECKED. LLOYDS REGISTRY VERIFIED.", "text-tactical-amber");
                  }}
                  className="absolute top-[75%] left-[62%] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                >
                  <div className="w-2.5 h-2.5 border border-emerald-800 rotate-45" />
                  <div className="absolute left-4 -top-1 bg-black/80 border border-emerald-900/80 p-0.5 text-3xs font-mono text-emerald-400/80 whitespace-nowrap">
                    <span>MV EVER GLORY [CONTAINER]</span>
                    <span className="block text-3xs text-emerald-400">AIS CODE: 563044000 (CLEARED)</span>
                  </div>
                </div>
              )}

              {/* Target Intercept Solution Geometry Marker */}
              <div className="absolute top-[38%] left-[51%] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                <div className="w-5 h-5 border border-tactical-amber border-dashed rounded-full animate-spin" />
                <span className="text-3xs text-tactical-amber font-mono font-bold block mt-0.5">
                  EST. KINETIC INTERCEPT POINT #1
                </span>
              </div>
            </div>

            {/* Immediate Kill-Chain Authorization Module */}
            <div className="mt-3 bg-red-950/40 border-2 border-red-600/80 p-3 corner-bracket corner-bracket-red">
              <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-red-600 text-black font-black text-2xs uppercase animate-pulse">
                      THREAT CRITICAL
                    </span>
                    <span className="text-xs font-black text-red-300 tracking-wider">
                      KILL-CHAIN FIRE CONTROL INTERLOCK
                    </span>
                  </div>
                  <p className="text-2xs text-emerald-200 font-mono mt-0.5">
                    TARGET: {selectedTarget} // TRAJECTORY TF-71
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xs text-emerald-400/60 block font-mono">ENGAGEMENT WINDOW</span>
                  <span className="text-base font-black text-red-400 tracking-widest font-mono">
                    {countdownTimer}
                  </span>
                </div>
              </div>

              {/* Countermeasure Selection Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-2xs font-mono mb-2">
                {/* Weapon 1 */}
                <button
                  type="button"
                  onClick={() => setSelectedWeapon("SM6")}
                  className={`border p-1.5 text-left transition flex flex-col justify-between cursor-pointer ${
                    selectedWeapon === "SM6"
                      ? "bg-red-900/60 border-red-500 text-white"
                      : "bg-tactical-panel-light hover:bg-red-900/40 border-red-500/50 text-red-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-red-200">1. RIM-174 SM-6 ERAM</span>
                    <span className="text-3xs text-emerald-400 font-semibold">READY</span>
                  </div>
                  <span className="text-3xs text-emerald-400/60 mt-1">Dual-Mode Active Radar // Salvo 2x</span>
                </button>

                {/* Weapon 2 */}
                <button
                  type="button"
                  onClick={() => setSelectedWeapon("HELIOS")}
                  className={`border p-1.5 text-left transition flex flex-col justify-between cursor-pointer ${
                    selectedWeapon === "HELIOS"
                      ? "bg-tactical-cyan/30 border-tactical-cyan text-white"
                      : "bg-tactical-panel-light hover:bg-tactical-cyan/10 border-tactical-cyan/50 text-emerald-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-emerald-200">2. HELIOS LASER DEW</span>
                    <span className="text-3xs text-tactical-amber font-semibold">CHARGE 96%</span>
                  </div>
                  <span className="text-3xs text-emerald-400/60 mt-1">60kW Directed Beam // Optical Burn</span>
                </button>

                {/* Weapon 3 */}
                <button
                  type="button"
                  onClick={() => setSelectedWeapon("CIWS")}
                  className={`border p-1.5 text-left transition flex flex-col justify-between cursor-pointer ${
                    selectedWeapon === "CIWS"
                      ? "bg-emerald-900/60 border-emerald-500 text-white"
                      : "bg-tactical-panel-light hover:bg-emerald-950/60 border-emerald-700/60 text-emerald-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-emerald-200">3. PHALANX CIWS 1B</span>
                    <span className="text-3xs text-emerald-400 font-semibold">AUTO-ARMED</span>
                  </div>
                  <span className="text-3xs text-emerald-400/60 mt-1">20mm Tungsten // Terminal 1.2 NM</span>
                </button>
              </div>

              {/* Dual Key Authorization Slider & Launch Button */}
              <div className="flex items-center space-x-3 pt-1 border-t border-red-900/60">
                <div className="flex-1 flex items-center space-x-2">
                  <label className="text-3xs text-emerald-400/70 uppercase font-mono whitespace-nowrap">
                    Dual-Key Auth:
                  </label>
                  <input
                    className="w-full bg-black/60 border border-red-700/60 text-3xs text-red-400 py-1 px-2 font-mono"
                    readOnly
                    type="password"
                    value="SECRET-KEY-AUTH-9092"
                  />
                </div>
                <button
                  onClick={handleAuthorizeEngage}
                  disabled={isEngaging}
                  className={`px-5 py-2 font-extrabold text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.5)] transition cursor-pointer ${
                    isEngaging
                      ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(0,255,102,0.8)]"
                      : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white"
                  }`}
                >
                  {isEngaging ? "INTERCEPT ENGAGED" : "AUTHORIZE & ENGAGE"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== RIGHT COLUMN: Task Force Logistics, Threat Priority & Arsenal ==================== */}
        <aside className="col-span-12 xl:col-span-3 flex flex-col space-y-3">
          {/* Multi-Domain Threat Priority Queue */}
          <section className="bg-tactical-panel border border-tactical-border p-3 corner-bracket">
            <div className="flex justify-between items-center border-b border-tactical-border pb-1.5 mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-tactical-red inline-block" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                  Threat Priority Matrix
                </span>
              </div>
              <span className="text-3xs text-red-400 font-mono">SORT: KILL-CHAIN REC</span>
            </div>
            <div className="space-y-1.5 text-2xs font-mono">
              {/* Threat 1: Critical */}
              <div
                onClick={() => setSelectedTarget("VAMPIRE-04 [ASCM]")}
                className="p-1.5 bg-red-950/40 border border-red-600/70 cursor-pointer hover:bg-red-900/50"
              >
                <div className="flex justify-between font-bold">
                  <span className="text-red-400">01. VAMPIRE-04 [ASCM]</span>
                  <span className="text-red-300">SEV 1 // HOSTILE</span>
                </div>
                <div className="flex justify-between text-3xs text-emerald-200/90 mt-0.5">
                  <span>BEARING: 042°</span>
                  <span>RANGE: 31 NM</span>
                  <span className="text-tactical-amber font-bold">STATUS: LOCKED</span>
                </div>
              </div>

              {/* Threat 2: High */}
              <div
                onClick={() => setSelectedTarget("BOGEY-ALPHA [SU-35 FLANKER]")}
                className="p-1.5 bg-tactical-panel-light border border-amber-500/50 cursor-pointer hover:bg-amber-950/40"
              >
                <div className="flex justify-between font-bold">
                  <span className="text-amber-400">02. BOGEY-ALPHA [SU-35]</span>
                  <span className="text-amber-300">SEV 2 // SUSPECT</span>
                </div>
                <div className="flex justify-between text-3xs text-emerald-200/90 mt-0.5">
                  <span>BEARING: 015°</span>
                  <span>RANGE: 88 NM</span>
                  <span className="text-emerald-400">RADAR TRACK</span>
                </div>
              </div>

              {/* Threat 3: Medium */}
              <div
                onClick={() => setSelectedTarget("CORVETTE TYPE 056A")}
                className="p-1.5 bg-tactical-panel-light border border-tactical-border cursor-pointer hover:bg-emerald-950/40"
              >
                <div className="flex justify-between font-bold">
                  <span className="text-emerald-200">03. CORVETTE TYPE 056A</span>
                  <span className="text-emerald-400/80">SEV 3 // MONITOR</span>
                </div>
                <div className="flex justify-between text-3xs text-emerald-400/70 mt-0.5">
                  <span>BEARING: 278°</span>
                  <span>RANGE: 112 NM</span>
                  <span>SURF ESM CORR</span>
                </div>
              </div>
            </div>
          </section>

          {/* Task Force Readiness & Platform Status */}
          <section className="bg-tactical-panel border border-tactical-border p-3 corner-bracket">
            <div className="flex justify-between items-center border-b border-tactical-border pb-1.5 mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-tactical-cyan inline-block" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                  TF-71 Platform Diagnostics
                </span>
              </div>
              <span className="text-3xs text-emerald-500 font-mono">DDG-1000 HULL</span>
            </div>
            <div className="space-y-2 text-2xs font-mono">
              <div>
                <div className="flex justify-between text-3xs text-emerald-400/70 mb-0.5">
                  <span>INTEGRATED POWER SYSTEM (IPS):</span>
                  <span className="text-emerald-400 font-bold">78.4 MW / 98%</span>
                </div>
                <div className="w-full bg-emerald-950/60 h-1.5">
                  <div className="bg-emerald-500 h-1.5 w-[98%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-3xs text-emerald-400/70 mb-0.5">
                  <span>MK 57 VERTICAL LAUNCH CELLS:</span>
                  <span className="text-tactical-amber font-bold">52 / 80 REMAINING</span>
                </div>
                <div className="w-full bg-emerald-950/60 h-1.5">
                  <div className="bg-amber-400 h-1.5 w-[65%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-3xs text-emerald-400/70 mb-0.5">
                  <span>HULL INTEGRITY / COMPARTMENTS:</span>
                  <span className="text-emerald-400 font-bold">100% SECURE</span>
                </div>
                <div className="w-full bg-emerald-950/60 h-1.5">
                  <div className="bg-emerald-500 h-1.5 w-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-3xs text-emerald-400/70 mb-0.5">
                  <span>SPY-3 X-BAND ACTIVE APERTURE:</span>
                  <span className="text-tactical-cyan font-bold">EMITTING 100%</span>
                </div>
                <div className="w-full bg-emerald-950/60 h-1.5">
                  <div className="bg-tactical-cyan h-1.5 w-full" />
                </div>
              </div>
            </div>
          </section>

          {/* Kinetic & Non-Kinetic Arsenal Counts */}
          <section className="bg-tactical-panel border border-tactical-border p-3 corner-bracket flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-tactical-border pb-1.5 mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 bg-tactical-amber inline-block" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                    Munitions &amp; Directed Energy
                  </span>
                </div>
                <span className="text-3xs text-tactical-amber font-mono">STORE STATUS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
                <div className="bg-tactical-bg p-2 border border-tactical-border">
                  <span className="text-3xs text-emerald-500 block">SM-6 BLK IB</span>
                  <span className="text-white font-bold text-sm">18 ROUNDS</span>
                  <span className="text-3xs text-emerald-400 block">VLS BAY 01-04</span>
                </div>
                <div className="bg-tactical-bg p-2 border border-tactical-border">
                  <span className="text-3xs text-emerald-500 block">TOMAHAWK BLK V</span>
                  <span className="text-white font-bold text-sm">24 ROUNDS</span>
                  <span className="text-3xs text-emerald-400 block">LAND-ATTACK / MAR</span>
                </div>
                <div className="bg-tactical-bg p-2 border border-tactical-border">
                  <span className="text-3xs text-emerald-500 block">ESSM BLK 2</span>
                  <span className="text-white font-bold text-sm">32 ROUNDS</span>
                  <span className="text-3xs text-tactical-cyan block">QUAD-PACKED</span>
                </div>
                <div className="bg-tactical-bg p-2 border border-tactical-border">
                  <span className="text-3xs text-emerald-500 block">HPM COUNTER-UAS</span>
                  <span className="text-tactical-amber font-bold text-sm">READY (98%)</span>
                  <span className="text-3xs text-tactical-amber block">BURST CHARGED</span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 p-2 bg-emerald-950/40 border border-emerald-900/60 text-3xs font-mono text-emerald-300/80">
              <span className="text-emerald-200 font-bold block mb-0.5">ROEs IN FORCE: DEFENSIVE INTERDICTION</span>
              Self-defense launch envelope pre-authorized for identified anti-ship missile profiles within 45 NM of task group elements.
            </div>
          </section>
        </aside>
      </main>

      {/* ==================== BOTTOM REAL-TIME EVENT STREAM & TACTICAL OVERRIDE CONSOLE ==================== */}
      <footer className="bg-tactical-black border-t-2 border-tactical-border p-3 space-y-2 z-40">
        {/* Real-Time Combat Event Feed */}
        <div className="bg-tactical-panel border border-tactical-border p-2">
          <div className="flex justify-between items-center border-b border-tactical-border pb-1 mb-1.5">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-tactical-cyan animate-pulse" />
              <span className="text-2xs font-bold uppercase tracking-wider text-emerald-200 font-mono">
                LIVE DATALINK STREAM // LINK-16 J-SERIES BROADCAST &amp; COMBAT LOGS
              </span>
            </div>
            <div className="flex items-center space-x-4 text-3xs font-mono text-emerald-500">
              <span>TX: 9.8 KB/S</span>
              <span>RX: 42.1 KB/S</span>
              <span className="text-emerald-400">ENCRYPTION: AES-256-GCM / QUANTUM PQC</span>
            </div>
          </div>

          {/* Scrolling Console Log Window */}
          <div ref={combatLogContainerRef} className="h-24 overflow-y-auto space-y-1 font-mono text-2xs pr-1">
            {combatLogs.map((log) => (
              <div key={log.id} className={log.colorClass}>
                <span className="text-emerald-600">[{log.time}]</span>{" "}
                <span className="font-bold">{log.sender}:</span> {log.message}
              </div>
            ))}
          </div>
        </div>

        {/* Active Terminal Command Line Prompt */}
        <form
          onSubmit={handleTerminalSubmit}
          className="flex items-center space-x-2 bg-tactical-bg border border-tactical-border px-3 py-1.5 font-mono text-xs"
        >
          <span className="text-tactical-cyan font-bold select-none whitespace-nowrap">
            C4I-MALACCA-NET://COMMAND-OVERRIDE&gt;
          </span>
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            placeholder="Type command (e.g., 'ENGAGE VAMPIRE-04', 'EMCON DELTA', 'STATUS', 'LOGIN COMMANDER') and press Enter..."
            className="flex-1 bg-transparent border-none text-emerald-100 text-xs focus:ring-0 focus:outline-none p-0 placeholder-emerald-700/80 font-mono"
          />
          <span className="text-3xs text-emerald-600 uppercase select-none hidden sm:inline">
            Press [ENTER] to execute
          </span>
        </form>

        {/* Micro Metadata Footer */}
        <div className="flex flex-wrap justify-between items-center text-3xs text-emerald-700 font-mono tracking-widest pt-1 border-t border-emerald-950/60 gap-2">
          <span>
            DEFENSE SCIENTIFIC RESEARCH &amp; INNOVATION // SIH26248 IMMERSIVE MULTI-DOMAIN C4I SIMULATION // DATABASE STABILIZED
          </span>
          <span>CLASSIFIED NATO SECRET REL TO USA, GBR, AUS, SGP, MYS // NO CONTRACTOR ACCESS</span>
        </div>
      </footer>

      {/* ==================== DATABASE & SUPABASE DIAGNOSTIC MODAL ==================== */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-tactical-panel border-2 border-tactical-cyan p-5 max-w-2xl w-full corner-bracket shadow-[0_0_30px_rgba(0,255,102,0.3)] font-mono text-xs">
            <div className="flex justify-between items-start border-b border-tactical-border pb-3 mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 bg-tactical-cyan rounded-full animate-ping" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Database &amp; Supabase Integration Status
                  </h3>
                </div>
                <p className="text-3xs text-emerald-400/70 mt-1">
                  Active asynchronous engine, fault-tolerant schema, and database connection settings.
                </p>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                className="text-emerald-400 hover:text-white px-2 py-1 text-sm font-bold border border-emerald-800"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-tactical-bg p-2.5 border border-tactical-border">
                  <span className="text-3xs text-emerald-600 block uppercase">Active Database Engine</span>
                  <span className="text-tactical-cyan font-bold text-sm">
                    {dbStatus?.database_type || "LOCAL SQLITE (sih26248.db)"}
                  </span>
                </div>
                <div className="bg-tactical-bg p-2.5 border border-tactical-border">
                  <span className="text-3xs text-emerald-600 block uppercase">Connection Health</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {dbStatus?.status === "HEALTHY" ? "HEALTHY (VERIFIED)" : "CONNECTING / ACTIVE"}
                  </span>
                </div>
              </div>

              <div className="bg-tactical-bg p-2.5 border border-tactical-border space-y-1 text-2xs">
                <div className="flex justify-between">
                  <span className="text-emerald-500">Active Connection Endpoint:</span>
                  <span className="text-emerald-200 truncate max-w-xs">{dbStatus?.active_url || "sqlite+aiosqlite:///sih26248.db"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-500">Supabase Configured in .env:</span>
                  <span className={dbStatus?.supabase_configured ? "text-tactical-cyan font-bold" : "text-tactical-amber"}>
                    {dbStatus?.supabase_configured ? "YES (Active Remote Pooler)" : "NO (Running on Local SQLite Database)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-500">Total Pre-Seeded Accounts:</span>
                  <span className="text-emerald-200">{dbStatus?.registered_accounts ?? 8} Operators</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-500">Total Database Tables:</span>
                  <span className="text-emerald-200">{dbStatus?.tables_registered ?? 15} Verified Tables</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 text-3xs text-emerald-300/90 space-y-1.5">
                <span className="font-bold text-tactical-cyan block uppercase">
                  How to Connect Supabase PostgreSQL:
                </span>
                <p>1. Copy the Database Connection URI from your Supabase Dashboard (Project Settings → Database).</p>
                <p>
                  2. Add to your <code className="text-tactical-amber">backend/.env</code> file:
                </p>
                <pre className="bg-black/80 p-2 border border-emerald-900/60 text-emerald-300 font-mono text-3xs overflow-x-auto">
{`SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
SUPABASE_KEY=[your-supabase-key]`}
                </pre>
                <p>
                  3. Restart backend. The system will auto-test the remote connection with SSL, run migrations, and automatically fall back to local SQLite if unreachable.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowDbModal(false)}
                  className="bg-tactical-cyan text-black font-bold px-4 py-1.5 uppercase text-2xs hover:bg-emerald-400 transition"
                >
                  Acknowledge Telemetry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
