// src/hooks/useSimulationSocket.ts
import { useEffect, useRef } from "react";
import { useSimulation } from "../store/simulation";
import type { FeedMessage } from "../types/simulation";

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
    setConnectionStatus,
    addFeed,
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
          if (data.type === "TICK") {
            setSimTime(data.simTime);
          } else if (data.type === "FEED_DELIVERY") {
            addFeed(data.feed);
          } else if (data.type === "AAR_TRIGGER") {
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
  }, [currentUser, currentRole, setConnectionStatus, setSimTime, addFeed, triggerAAR]);

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
 * Strictly matches Page 5 of the SIH26248 Blueprint
 */
function dispatchScheduledScenarioEvents(t: number, addFeed: (feed: FeedMessage) => void) {
  switch (t) {
    case 1:
      addFeed({
        id: `FEED-T1-${Date.now()}`,
        simTimestamp: 1,
        sourceUnit: "TACTICAL RADAR (SECTOR 4)",
        targetRole: "COMMANDER",
        domain: "AIR",
        title: "Sensor Report: Unidentified Radar Track",
        content: "Track #0492 detected at 68,35 altitude 24,000ft. Fast inbound vector.",
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
        title: "CRITICAL: Electronic Warfare Disruption Active",
        content: "High-power jamming detected in Sector 4. Data links experiencing packet latency and distortion.",
        degradationType: "DROPOUT",
      });
      break;

    case 3:
      addFeed({
        id: `FEED-T3A-${Date.now()}`,
        simTimestamp: 3,
        sourceUnit: "UNIT A (FORWARD DEFENSE)",
        targetRole: "UNIT_A",
        domain: "AIR",
        title: "Target X: Delayed Sensor Contact",
        content: "Target X telemetry received with 12s latency. Bearing 245, speed 480kts.",
        degradationType: "DELAYED",
      });
      addFeed({
        id: `FEED-T3B-${Date.now()}`,
        simTimestamp: 3,
        sourceUnit: "UNIT B (COASTAL RADAR)",
        targetRole: "UNIT_B",
        domain: "AIR",
        title: "Target X: Conflicting Commercial Beacon",
        content: "Electronic intercept claims Target X has civilian transponder code. Potential decoy or spoof.",
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
        domain: "AIR",
        title: "WARNING: Discrepancy Detected on Target X",
        content: "Unit A radar reports hostile profile while Unit B reports civilian beacon. Verification advised before kinetic engagement.",
        degradationType: "CONFLICTING",
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
        content: "Hostile jamming counter-measures engaged. Tactical data link bandwidth returning to normal.",
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
        content: "Simulation ended. Dual-timeline reconstruction and forensic decision analysis available in AAR.",
        degradationType: "NORMAL",
      });
      break;

    default:
      break;
  }
}
