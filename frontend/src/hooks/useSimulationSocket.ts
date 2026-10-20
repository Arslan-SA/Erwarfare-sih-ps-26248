// src/hooks/useSimulationSocket.ts
import { useEffect, useRef } from "react";
import { useSimulation } from "../store/simulation";
import type {
  FeedMessage,
  TacticalEntity,
  TraineeDecision,
  VerificationRequest,
} from "../types/simulation";

/**
 * Normalization utilities mapping FastAPI snake_case schemas
 * to TypeScript camelCase frontend models.
 */
function normalizeEntity(raw: any): TacticalEntity {
  return {
    id: raw.id || `TRK-${Math.floor(Math.random() * 1000)}`,
    name: raw.name || "Unknown Track",
    domain: raw.domain || "SEA",
    classification: raw.classification || "UNKNOWN",
    x: typeof raw.x === "number" ? raw.x : 50,
    y: typeof raw.y === "number" ? raw.y : 50,
    speedKnots: typeof raw.speed_knots === "number" ? raw.speed_knots : (raw.speedKnots ?? 0),
    headingDeg: typeof raw.heading_deg === "number" ? raw.heading_deg : (raw.headingDeg ?? 0),
    status: raw.status || "ACTIVE",
    observedByRoles: raw.observed_by_roles || raw.observedByRoles || ["COMMANDER"],
    divergenceNote: raw.divergence_note || raw.divergenceNote,
  };
}

function normalizeFeed(raw: any): FeedMessage {
  return {
    id: raw.id || `FEED-${Date.now()}`,
    simTimestamp: typeof raw.sim_timestamp === "number" ? raw.sim_timestamp : (raw.simTimestamp ?? 0),
    sourceUnit: raw.source_unit || raw.sourceUnit || "HQ_C2",
    targetRole: raw.target_role || raw.targetRole || "COMMANDER",
    domain: raw.domain || "SEA",
    title: raw.title || "Tactical Report",
    content: raw.content || "",
    degradationType: raw.degradation_type || raw.degradationType || "NORMAL",
    divergenceVariant: raw.divergence_variant || raw.divergenceVariant,
    isVerified: !!(raw.is_verified ?? raw.isVerified),
  };
}

function normalizeDecision(raw: any): TraineeDecision {
  return {
    id: raw.id || `DEC-${Date.now()}`,
    simTimestamp: typeof raw.sim_timestamp === "number" ? raw.sim_timestamp : (raw.simTimestamp ?? 0),
    role: raw.role || "COMMANDER",
    action: raw.action || "HOLD_VERIFY",
    targetEntityId: raw.target_entity_id || raw.targetEntityId || "TRK-002",
    confidenceScore: typeof raw.confidence_score === "number" ? raw.confidence_score : (raw.confidenceScore ?? 75),
    rationale: raw.rationale || "",
    assumedRisk: raw.assumed_risk || raw.assumedRisk || "",
    evidenceMessageIds: raw.evidence_message_ids || raw.evidenceMessageIds || [],
    submittedAtWallTime: raw.submitted_at_wall_time || raw.submittedAtWallTime || new Date().toISOString(),
  };
}

function normalizeVerification(raw: any): VerificationRequest {
  return {
    id: raw.id || `VERIF-${Date.now()}`,
    simTimestamp: typeof raw.sim_timestamp === "number" ? raw.sim_timestamp : (raw.simTimestamp ?? 0),
    fromRole: raw.from_role || raw.fromRole || "COMMANDER",
    toRole: raw.to_role || raw.toRole || "UNIT_A",
    targetEntityId: raw.target_entity_id || raw.targetEntityId || "TRK-002",
    query: raw.query || "",
    response: raw.response,
    status: raw.status || "PENDING",
  };
}

/**
 * Manages WebSocket connectivity to FastAPI backend with an integrated
 * scenario clock generator for standalone prototype execution (T=0 to T=7).
 */
export default function useSimulationSocket() {
  const {
    currentUser,
    currentRole,
    clockRunning,
    setSimTime,
    setClockRunning,
    setTimeMultiplier,
    setConnectionStatus,
    setGroundTruthEntities,
    setFeeds,
    setDecisions,
    setVerifications,
    addFeed,
    setEWIntensity,
    triggerAAR,
    timeMultiplier,
  } = useSimulation();

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);

  // WebSocket connection attempt
  useEffect(() => {
    if (!currentUser) {
      setConnectionStatus("disconnected");
      return;
    }

    const sessionId = currentUser.sessionId || "SES-MALACCA-001";
    const role = currentRole || currentUser.role;
    const wsUrl = `ws://${window.location.hostname}:8000/ws/${sessionId}/${role}`;
    let isMounted = true;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type;

          if (type === "INITIAL_STATE" && data.payload) {
            const p = data.payload;
            if (Array.isArray(p.entities)) {
              setGroundTruthEntities(p.entities.map(normalizeEntity));
            }
            if (Array.isArray(p.feeds)) {
              setFeeds(p.feeds.map(normalizeFeed));
            }
            if (Array.isArray(p.decisions)) {
              setDecisions(p.decisions.map(normalizeDecision));
            }
            if (Array.isArray(p.verifications)) {
              setVerifications(p.verifications.map(normalizeVerification));
            }
            if (typeof p.sim_time === "number") {
              setSimTime(p.sim_time);
            }
            if (typeof p.clock_running === "boolean") {
              setClockRunning(p.clock_running);
            }
            if (typeof p.time_multiplier === "number") {
              setTimeMultiplier(p.time_multiplier);
            }
          } else if (type === "TICK") {
            const newSimTime = data.sim_time ?? data.simTime;
            if (typeof newSimTime === "number") {
              setSimTime(newSimTime);
            }
            if (data.payload) {
              const p = data.payload;
              if (Array.isArray(p.entities)) {
                setGroundTruthEntities(p.entities.map(normalizeEntity));
              }
              if (Array.isArray(p.feeds)) {
                setFeeds(p.feeds.map(normalizeFeed));
              }
              if (Array.isArray(p.decisions)) {
                setDecisions(p.decisions.map(normalizeDecision));
              }
              if (Array.isArray(p.verifications)) {
                setVerifications(p.verifications.map(normalizeVerification));
              }
            }
          } else if (type === "CLOCK_STATUS") {
            if (typeof data.sim_time === "number") {
              setSimTime(data.sim_time);
            }
            if (typeof data.running === "boolean") {
              setClockRunning(data.running);
            }
          } else if (type === "FEED_DELIVERY" || type === "NEW_FEED") {
            const rawFeed = data.feed || data.payload;
            if (rawFeed) {
              addFeed(normalizeFeed(rawFeed));
            }
          } else if (type === "EW_UPDATE") {
            if (typeof data.intensity === "number") {
              setEWIntensity(data.intensity);
            }
          } else if (type === "DECISION_LOGGED") {
            if (data.decision) {
              const norm = normalizeDecision(data.decision);
              const existing = useSimulation.getState().decisions;
              if (!existing.some((d) => d.id === norm.id)) {
                setDecisions([...existing, norm]);
              }
            }
          } else if (type === "VERIFICATION_UPDATE") {
            if (data.verification) {
              const norm = normalizeVerification(data.verification);
              const existing = useSimulation.getState().verifications;
              const idx = existing.findIndex((v) => v.id === norm.id);
              if (idx >= 0) {
                const nextList = [...existing];
                nextList[idx] = norm;
                setVerifications(nextList);
              } else {
                setVerifications([norm, ...existing]);
              }
            }
          } else if (type === "AAR_TRIGGER") {
            triggerAAR();
          }
        } catch (e) {
          console.warn("WebSocket parse error", e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setConnectionStatus("connected");
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setConnectionStatus("connected");
      };
    } catch {
      setConnectionStatus("connected");
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [
    currentUser,
    currentRole,
    setConnectionStatus,
    setSimTime,
    setClockRunning,
    setTimeMultiplier,
    setGroundTruthEntities,
    setFeeds,
    setDecisions,
    setVerifications,
    addFeed,
    setEWIntensity,
    triggerAAR,
  ]);

  // Simulation Clock Tick Loop (Runs locally if clockRunning is true)
  useEffect(() => {
    if (!clockRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.max(200, 1000 / timeMultiplier);
    timerRef.current = window.setInterval(() => {
      const nextTime = useSimulation.getState().simTime + 1;
      if (nextTime > 7) {
        useSimulation.getState().setClockRunning(false);
        useSimulation.getState().triggerAAR();
        return;
      }

      setSimTime(nextTime);
      dispatchScheduledScenarioEvents(nextTime, addFeed);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clockRunning, timeMultiplier, setSimTime, addFeed]);

  return { getSocket: () => wsRef.current };
}

/**
 * Timeline Walkthrough: Ground truth vs what trainees see (T=0 -> T=7)
 * Strictly matches Page 5 of the SIH26248 Blueprint for Strait of Malacca
 */
function dispatchScheduledScenarioEvents(t: number, addFeed: (feed: FeedMessage) => void) {
  switch (t) {
    case 1:
      addFeed({
        id: `FEED-T1-${Date.now()}`,
        simTimestamp: 1,
        sourceUnit: "TACTICAL RADAR (SECTOR 4)",
        targetRole: "COMMANDER",
        domain: "SEA",
        title: "Sensor Report: Unidentified Surface Track TRK-002",
        content: "Track TRK-002 painted at grid 58,42 speed 14kts heading 290. Radar cross-section indicates combatant vessel.",
        degradationType: "NORMAL",
      });
      break;

    case 2:
      addFeed({
        id: `FEED-T2-${Date.now()}`,
        simTimestamp: 2,
        sourceUnit: "CYBER DEFENSE COMMAND",
        targetRole: "COMMANDER",
        domain: "CYBER",
        title: "CRITICAL: Electronic Warfare Barrage Jamming Active",
        content: "Broadband barrage jamming detected across 2.4 - 5.8 GHz in Sector 4. Tactical datalink packet loss and latency elevated.",
        degradationType: "DROPOUT",
      });
      break;

    case 3:
      addFeed({
        id: `FEED-T3A-${Date.now()}`,
        simTimestamp: 3,
        sourceUnit: "UNIT A (FORWARD DEFENSE)",
        targetRole: "UNIT_A",
        domain: "SEA",
        title: "TRK-002: Hostile Warship Telemetry Lock",
        content: "Unit A targeting radar locks TRK-002. ESM signature matches Type 054 guided-missile frigate on intercept course.",
        degradationType: "DELAYED",
        divergenceVariant: "VARIANT_A",
      });
      addFeed({
        id: `FEED-T3B-${Date.now()}`,
        simTimestamp: 3,
        sourceUnit: "UNIT B (COASTAL RADAR)",
        targetRole: "UNIT_B",
        domain: "SEA",
        title: "TRK-002: Civilian AIS Transponder Intercept",
        content: "Unit B intercepts civil transponder AIS-8829 on TRK-002 coordinates: Registered oil tanker M/T Ocean Grace. No missile radar emissions.",
        degradationType: "CONFLICTING",
        divergenceVariant: "VARIANT_B",
      });
      break;

    case 4:
      addFeed({
        id: `FEED-T4-${Date.now()}`,
        simTimestamp: 4,
        sourceUnit: "HQ COMBAT SYSTEMS",
        targetRole: "COMMANDER",
        domain: "SEA",
        title: "WARNING: Sensor Discrepancy on TRK-002",
        content: "Unit A reports hostile frigate profile while Unit B reports civilian transponder. Verification cross-check strongly advised before firing.",
        degradationType: "CONFLICTING",
      });
      break;

    case 5:
      addFeed({
        id: `FEED-T5-${Date.now()}`,
        simTimestamp: 5,
        sourceUnit: "HQ COMMAND",
        targetRole: "COMMANDER",
        domain: "SEA",
        title: "Rules of Engagement Action Window Open",
        content: "Task Force Commander decision window active. Submit structured tactical decision and documented justification.",
        degradationType: "NORMAL",
      });
      break;

    case 6:
      addFeed({
        id: `FEED-T6-${Date.now()}`,
        simTimestamp: 6,
        sourceUnit: "EW CONTROL",
        targetRole: "COMMANDER",
        domain: "CYBER",
        title: "EW Attack Subsiding - Comms Recovering",
        content: "Hostile jamming counter-measures engaged. Tactical data link bandwidth returning to normal baseline.",
        degradationType: "NORMAL",
      });
      break;

    case 7:
      addFeed({
        id: `FEED-T7-${Date.now()}`,
        simTimestamp: 7,
        sourceUnit: "HQ COMMAND",
        targetRole: "COMMANDER",
        domain: "CYBER",
        title: "Exercise Concluded - AAR Generating",
        content: "Simulation ended. Dual-timeline reconstruction and forensic decision analysis available in AAR view.",
        degradationType: "NORMAL",
      });
      break;

    default:
      break;
  }
}
