// src/store/simulation.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Role,
  AuthUser,
  TacticalEntity,
  FeedMessage,
  TraineeDecision,
  VerificationRequest,
  EWRule,
  AAREvaluation,
} from "../types/simulation";

export interface SimulationState {
  currentUser: AuthUser | null;
  currentRole: Role;
  activeView: "TACTICAL" | "AAR";
  simTime: number; // T=0 to T=7 scenario timeline
  clockRunning: boolean;
  timeMultiplier: number;
  connectionStatus: "connected" | "connecting" | "disconnected";
  
  // Authoritative State (Ground Truth)
  groundTruthEntities: TacticalEntity[];

  // Trainee Feed (Projected feeds delivered via WebSocket)
  feeds: FeedMessage[];

  // Trainee Decisions & Rationales
  decisions: TraineeDecision[];

  // Verifications
  verifications: VerificationRequest[];

  // Software-Defined EW Rules (Instructor controlled)
  ewRules: EWRule[];
  commsSeveredUnits: { unitA: boolean; unitB: boolean };
  ewIntensity: number; // 0-100%

  // Uncertainty Snapshot at T=5 (Captured for forensic AAR)
  snapshotAtT5: {
    simTimestamp: number;
    groundTruth: TacticalEntity[];
    visibleFeeds: FeedMessage[];
    commanderPerception: TacticalEntity[];
  } | null;

  // AAR Evaluation
  aarEvaluation: AAREvaluation | null;

  // Actions
  login: (user: AuthUser) => void;
  logout: () => void;
  setCurrentRole: (role: Role) => void;
  setActiveView: (view: "TACTICAL" | "AAR") => void;
  setSimTime: (t: number) => void;
  setClockRunning: (running: boolean) => void;
  setTimeMultiplier: (mult: number) => void;
  setConnectionStatus: (status: "connected" | "connecting" | "disconnected") => void;
  
  setGroundTruthEntities: (entities: TacticalEntity[]) => void;
  setFeeds: (feeds: FeedMessage[]) => void;
  setDecisions: (decisions: TraineeDecision[]) => void;
  setVerifications: (verifications: VerificationRequest[]) => void;
  setAARReport: (report: AAREvaluation) => void;

  addFeed: (feed: FeedMessage) => void;
  submitDecision: (decision: Omit<TraineeDecision, "id" | "submittedAtWallTime">) => void;
  requestVerification: (targetEntityId: string, query: string, toRole: Role) => void;
  respondVerification: (requestId: string, response: string) => void;
  
  // Instructor Dynamic Injections
  setEWIntensity: (intensity: number) => void;
  toggleCommsLink: (unit: "unitA" | "unitB") => void;
  injectConflictingReport: () => void;
  resetSimulation: () => void;
  triggerAAR: () => void;
  updateInstructorRubric: (scores: { situationalAwareness: number; riskManagement: number; adaptability: number; evaluatorNotes: string }) => void;
}

const INITIAL_GROUND_TRUTH: TacticalEntity[] = [
  {
    id: "TRK-001",
    name: "INS Kora (FPV-Bravo)",
    domain: "SEA",
    classification: "FRIENDLY",
    x: 32,
    y: 65,
    speedKnots: 18,
    headingDeg: 45,
    status: "ACTIVE",
    observedByRoles: ["COMMANDER", "UNIT_A", "UNIT_B"],
    divergenceNote: "Authoritative Blue Force lead littoral corvette operating in Sector 4.",
  },
  {
    id: "TRK-002",
    name: "Unknown Surface Contact (M/T Ocean Grace / Type 054)",
    domain: "SEA",
    classification: "AMBIGUOUS",
    x: 58,
    y: 42,
    speedKnots: 14,
    headingDeg: 290,
    status: "ACTIVE",
    observedByRoles: ["COMMANDER", "UNIT_A", "UNIT_B"],
    divergenceNote: "Unit A classifies as Hostile Frigate; Unit B reports civil AIS transponder.",
  },
  {
    id: "TRK-003",
    name: "P-8I Poseidon Maritime Patrol",
    domain: "AIR",
    classification: "FRIENDLY",
    x: 20,
    y: 25,
    speedKnots: 240,
    headingDeg: 120,
    status: "ACTIVE",
    observedByRoles: ["COMMANDER", "UNIT_A"],
    divergenceNote: "Long-range maritime surveillance flight vectoring south-east.",
  },
  {
    id: "TRK-004",
    name: "Boghammer Fast Attack Craft",
    domain: "SEA",
    classification: "HOSTILE",
    x: 82,
    y: 30,
    speedKnots: 32,
    headingDeg: 215,
    status: "ACTIVE",
    observedByRoles: ["COMMANDER", "UNIT_B"],
    divergenceNote: "Adversary high-speed littoral interdiction craft.",
  },
];

const INITIAL_FEEDS: FeedMessage[] = [
  {
    id: "FEED-0",
    simTimestamp: 0,
    sourceUnit: "HQ COMMAND",
    targetRole: "COMMANDER",
    domain: "SEA",
    title: "Exercise Commenced - Strait of Malacca",
    content: "Operation Northern Aegis initiated. High-density maritime choke point under active adversary EW barrage. De-conflict contacts before kinetic action.",
    degradationType: "NORMAL",
  },
];

const getInitialUser = (): AuthUser | null => {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sih_auth_user") : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const initialUser = getInitialUser();

export const useSimulation = create<SimulationState>()(
  devtools((set, get) => ({
    currentUser: initialUser,
    currentRole: initialUser ? initialUser.role : "COMMANDER",
    activeView: "TACTICAL",
    simTime: 0,
    clockRunning: false,
    timeMultiplier: 1,
    connectionStatus: "connected",
    groundTruthEntities: INITIAL_GROUND_TRUTH,
    feeds: INITIAL_FEEDS,
    decisions: [],
    verifications: [],
    ewRules: [
      { id: "EW-1", name: "Sector 4 Cyber Jamming", type: "CONFLICTING", intensityPercent: 75, affectedRole: "ALL", active: true },
      { id: "EW-2", name: "Unit A Sensor Latency", type: "DELAYED", intensityPercent: 60, affectedRole: "UNIT_A", active: true },
    ],
    commsSeveredUnits: { unitA: false, unitB: false },
    ewIntensity: 65,
    snapshotAtT5: null,
    aarEvaluation: null,

    login: (user) => {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("sih_auth_user", JSON.stringify(user));
        }
      } catch (err) {
        console.error("Failed to persist user in localStorage", err);
      }
      set({ currentUser: user, currentRole: user.role, activeView: "TACTICAL" });
    },

    logout: () => {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("sih_auth_user");
        }
      } catch (err) {
        console.error("Failed to clear user from localStorage", err);
      }
      set({ currentUser: null, activeView: "TACTICAL" });
    },

    setGroundTruthEntities: (entities) => set({ groundTruthEntities: entities }),
    setFeeds: (feeds) => set({ feeds }),
    setDecisions: (decisions) => set({ decisions }),
    setVerifications: (verifications) => set({ verifications }),
    setAARReport: (report) => set({ aarEvaluation: report }),

    setCurrentRole: (role) => {
      const { currentUser } = get();
      // Instructors can inspect any station; trainees are locked to their authenticated duty station
      if (!currentUser || currentUser.role === "INSTRUCTOR" || currentUser.role === role) {
        set({ currentRole: role });
      } else {
        console.warn(`RBAC: Trainee ${currentUser.callSign} (${currentUser.role}) cannot switch to ${role}`);
      }
    },
    setActiveView: (view) => set({ activeView: view }),
    setSimTime: (t) => set({ simTime: t }),
    setClockRunning: (running) => {
      set({ clockRunning: running });
      const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
      fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: running ? "start" : "pause" }),
      }).catch(() => {
        // Fallback for standalone prototype mode
      });
    },
    setTimeMultiplier: (mult) => {
      set({ timeMultiplier: mult });
      const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
      fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", time_multiplier: mult }),
      }).catch(() => {
        // Fallback for standalone prototype mode
      });
    },
    setConnectionStatus: (status) => set({ connectionStatus: status }),

    addFeed: (feed) => set((state) => ({ feeds: [feed, ...state.feeds] })),

    submitDecision: (decisionData) => {
      const decision: TraineeDecision = {
        ...decisionData,
        id: `DEC-${Date.now()}`,
        submittedAtWallTime: new Date().toISOString(),
      };

      set((state) => {
        const snapshot = {
          simTimestamp: state.simTime,
          groundTruth: JSON.parse(JSON.stringify(state.groundTruthEntities)),
          visibleFeeds: JSON.parse(JSON.stringify(state.feeds)),
          commanderPerception: JSON.parse(JSON.stringify(state.groundTruthEntities)),
        };

        return {
          decisions: [...state.decisions, decision],
          snapshotAtT5: snapshot,
        };
      });

      // Synchronize with backend REST API
      const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
      fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sim_timestamp: decisionData.simTimestamp,
          role: decisionData.role,
          action: decisionData.action,
          target_entity_id: decisionData.targetEntityId,
          confidence_score: decisionData.confidenceScore,
          rationale: decisionData.rationale,
          assumed_risk: decisionData.assumedRisk,
          evidence_message_ids: decisionData.evidenceMessageIds,
        }),
      }).then(async (res) => {
        if (res.ok) {
          // If backend accepted, refresh authoritative AAR
          try {
            const aarRes = await fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/aar`);
            if (aarRes.ok) {
              const aarData = await aarRes.json();
              get().setAARReport({
                sessionId: aarData.session_id,
                decisionMomentT: aarData.decision_moment_t,
                classification: aarData.classification,
                automatedScores: {
                  responseLatencySec: aarData.automated_scores.response_latency_sec,
                  latencyScore: aarData.automated_scores.latency_score,
                  verificationAttempts: aarData.automated_scores.verification_attempts,
                  verificationScore: aarData.automated_scores.verification_score,
                  informationSharingScore: aarData.automated_scores.information_sharing_score,
                  overallAutomated: aarData.automated_scores.overall_automated,
                },
                instructorScores: aarData.instructor_scores ? {
                  situationalAwareness: aarData.instructor_scores.situational_awareness,
                  riskManagement: aarData.instructor_scores.risk_management,
                  adaptability: aarData.instructor_scores.adaptability,
                  overallInstructor: aarData.instructor_scores.overall_instructor,
                } : {
                  situationalAwareness: 4.0,
                  riskManagement: 4.0,
                  adaptability: 4.0,
                  overallInstructor: 80.0,
                },
                finalCompositeScore: aarData.final_composite_score,
                reasoningQuality: aarData.reasoning_quality,
                outcomeQuality: aarData.outcome_quality,
                evaluatorNotes: aarData.evaluator_notes || "",
              });
            }
          } catch {
            get().triggerAAR();
          }
        } else {
          get().triggerAAR();
        }
      }).catch(() => {
        get().triggerAAR();
      });
    },

    requestVerification: (targetEntityId, query, toRole) => {
      const { simTime, currentRole, commsSeveredUnits } = get();
      const isSevered = (toRole === "UNIT_A" && commsSeveredUnits.unitA) || (toRole === "UNIT_B" && commsSeveredUnits.unitB);
      
      const newReq: VerificationRequest = {
        id: `VER-${Date.now()}`,
        simTimestamp: simTime,
        fromRole: currentRole,
        toRole,
        targetEntityId,
        query,
        status: isSevered ? "JAMMED" : "PENDING",
      };

      set((state) => ({ verifications: [newReq, ...state.verifications] }));

      // Dispatch to authoritative backend
      const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
      fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/verifications?from_role=${currentRole}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_role: toRole,
          target_entity_id: targetEntityId,
          query,
        }),
      }).then(async (res) => {
        if (res.ok) {
          const vData = await res.json();
          set((state) => ({
            verifications: state.verifications.map((v) =>
              v.id === newReq.id
                ? {
                    ...v,
                    status: vData.status,
                    response: vData.response,
                  }
                : v
            ),
          }));
        }
      }).catch(() => {
        // Fallback simulated response
      });

      if (!isSevered) {
        setTimeout(() => {
          set((state) => ({
            verifications: state.verifications.map((v) =>
              v.id === newReq.id
                ? {
                    ...v,
                    status: "ANSWERED",
                    response:
                      toRole === "UNIT_A"
                        ? `[Unit A] Secondary Doppler radar lock on ${targetEntityId}: RCS indicates Type 054 frigate signature.`
                        : `[Unit B] Optical & ESM intercept on ${targetEntityId}: Transponder AIS-8829 confirms civil tanker M/T Ocean Grace.`,
                  }
                : v
            ),
            feeds: [
              {
                id: `FEED-VER-${Date.now()}`,
                simTimestamp: get().simTime,
                sourceUnit: toRole,
                targetRole: "COMMANDER",
                domain: "SEA",
                title: `Verification Telemetry: ${toRole}`,
                content:
                  toRole === "UNIT_A"
                    ? `[Unit A] Re-verified ${targetEntityId}. Radar profile consistent with warship; weapon radar emissions detected.`
                    : `[Unit B] Re-verified ${targetEntityId}. Visual inspection confirms civil tanker profile with no offensive weapon systems.`,
                degradationType: "NORMAL",
                isVerified: true,
              },
              ...state.feeds,
            ],
          }));
        }, 1500);
      }
    },

    respondVerification: (requestId, response) => {
      set((state) => ({
        verifications: state.verifications.map((v) =>
          v.id === requestId ? { ...v, status: "ANSWERED", response } : v
        ),
      }));
    },

    setEWIntensity: (intensity) => {
      set({ ewIntensity: intensity });
      const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
      fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/instructor/ew-intensity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intensity }),
      }).catch(() => {
        // Fallback for standalone mode
      });
    },

    toggleCommsLink: (unit) => {
      set((state) => {
        const nextState = !state.commsSeveredUnits[unit];
        const newComms = { ...state.commsSeveredUnits, [unit]: nextState };
        const alertFeed: FeedMessage = {
          id: `COMM-ALERT-${Date.now()}`,
          simTimestamp: state.simTime,
          sourceUnit: "EW CONTROL",
          targetRole: "COMMANDER",
          domain: "CYBER",
          title: `Comms Link ${unit.toUpperCase()} ${nextState ? "DROPPED" : "RESTORED"}`,
          content: nextState
            ? `WARNING: High-power electronic jamming has severed tactical datalink with ${unit.toUpperCase()}.`
            : `TACTICAL: Datalink re-established with ${unit.toUpperCase()}.`,
          degradationType: nextState ? "DROPOUT" : "NORMAL",
        };

        const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
        fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/instructor/sever-comms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role_a: "COMMANDER",
            role_b: unit === "unitA" ? "UNIT_A" : "UNIT_B",
            sever: nextState,
          }),
        }).catch(() => {
          // Fallback for standalone mode
        });

        return { commsSeveredUnits: newComms, feeds: [alertFeed, ...state.feeds] };
      });
    },

    injectConflictingReport: () => {
      set((state) => {
        const msgA: FeedMessage = {
          id: `CONF-A-${Date.now()}`,
          simTimestamp: state.simTime,
          sourceUnit: "UNIT_A (RADAR)",
          targetRole: "COMMANDER",
          domain: "SEA",
          title: "CONFLICT ALERT: TRK-002 Radar Lock",
          content: "Unit A targeting radar locks TRK-002 as armed adversary frigate on intercept course.",
          degradationType: "CONFLICTING",
          divergenceVariant: "VARIANT_A",
        };
        const msgB: FeedMessage = {
          id: `CONF-B-${Date.now()}`,
          simTimestamp: state.simTime,
          sourceUnit: "UNIT_B (AIS)",
          targetRole: "COMMANDER",
          domain: "SEA",
          title: "CONFLICT ALERT: TRK-002 Commercial AIS Beacon",
          content: "Unit B intercepts AIS transponder for oil tanker M/T Ocean Grace on TRK-002 coordinates.",
          degradationType: "CONFLICTING",
          divergenceVariant: "VARIANT_B",
        };

        const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
        fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/instructor/inject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            injection_type: "INJECT_CONFLICT",
            target_unit: "UNIT_A",
            payload: {
              content: "Contradictory radar signature vs civil AIS transponder on TRK-002.",
            },
          }),
        }).catch(() => {
          // Fallback for standalone mode
        });

        return { feeds: [msgA, msgB, ...state.feeds] };
      });
    },

    resetSimulation: () => {
      const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
      fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      }).catch(() => {
        // Fallback for standalone mode
      });

      set({
        simTime: 0,
        clockRunning: false,
        groundTruthEntities: INITIAL_GROUND_TRUTH,
        feeds: INITIAL_FEEDS,
        decisions: [],
        verifications: [],
        snapshotAtT5: null,
        aarEvaluation: null,
        commsSeveredUnits: { unitA: false, unitB: false },
        activeView: "TACTICAL",
      });
    },

    triggerAAR: () => {
      const { decisions, verifications } = get();
      const lastDecision = decisions[decisions.length - 1];

      const hasVerification = verifications.length > 0;
      const hasStructuredEvidence = lastDecision ? lastDecision.evidenceMessageIds.length > 0 : false;
      const rationaleLength = lastDecision ? lastDecision.rationale.trim().length : 0;
      
      const hasGoodReasoning = (hasVerification || hasStructuredEvidence) && rationaleLength > 20;
      const outcomeSuccess = lastDecision?.action === "HOLD_VERIFY" || lastDecision?.action === "ENGAGE";

      let classification: "OPTIMAL" | "DEFENSIBLE" | "LUCKY_GUESS" | "CRITICAL_FAILURE";
      if (hasGoodReasoning && outcomeSuccess) {
        classification = "OPTIMAL";
      } else if (hasGoodReasoning && !outcomeSuccess) {
        classification = "DEFENSIBLE";
      } else if (!hasGoodReasoning && outcomeSuccess) {
        classification = "LUCKY_GUESS";
      } else {
        classification = "CRITICAL_FAILURE";
      }

      const latencyScore = Math.max(30, 100 - (lastDecision ? (lastDecision.simTimestamp - 2) * 12 : 50));
      const verificationScore = hasVerification ? 95 : 25;
      const sharingScore = 85;
      const overallAutomated = Math.round((latencyScore * 0.3) + (verificationScore * 0.4) + (sharingScore * 0.3));

      const evaluation: AAREvaluation = {
        sessionId: get().currentUser?.sessionId || "SES-MALACCA-001",
        decisionMomentT: lastDecision ? lastDecision.simTimestamp : 5,
        classification,
        automatedScores: {
          responseLatencySec: lastDecision ? lastDecision.simTimestamp : 5,
          latencyScore,
          verificationAttempts: verifications.length,
          verificationScore,
          informationSharingScore: sharingScore,
          overallAutomated,
        },
        instructorScores: {
          situationalAwareness: hasGoodReasoning ? 4.5 : 2.0,
          riskManagement: hasVerification ? 4.8 : 2.2,
          adaptability: 4.2,
          overallInstructor: hasGoodReasoning ? 90 : 45,
        },
        finalCompositeScore: Math.round((overallAutomated * 0.4) + ((hasGoodReasoning ? 90 : 45) * 0.6)),
        reasoningQuality: hasGoodReasoning ? "GOOD" : "POOR",
        outcomeQuality: outcomeSuccess ? "GOOD" : "BAD",
        evaluatorNotes:
          classification === "DEFENSIBLE" || classification === "OPTIMAL"
            ? "Trainee effectively navigated conflicting reports on TRK-002, initiated cross-verification across units, and submitted a defensible tactical decision under heavy cyber degradation."
            : classification === "LUCKY_GUESS"
            ? "Trainee achieved a favorable tactical result but failed to verify conflicting sensor feeds or document defensible evidence. Scored low to discourage reckless guessing."
            : "Critical failure: Trainee acted on incomplete, degraded information without cross-checking units, leading to unmitigated tactical risk.",
      };

      set({ aarEvaluation: evaluation });
    },

    updateInstructorRubric: (scores) => {
      set((state) => {
        if (!state.aarEvaluation) return state;
        const overallInstructor = Math.round(
          ((scores.situationalAwareness + scores.riskManagement + scores.adaptability) / 15) * 100
        );
        const finalCompositeScore = Math.round(
          (state.aarEvaluation.automatedScores.overallAutomated * 0.4) + (overallInstructor * 0.6)
        );

        const updatedReport: AAREvaluation = {
          ...state.aarEvaluation,
          instructorScores: {
            ...scores,
            overallInstructor,
          },
          finalCompositeScore,
          evaluatorNotes: scores.evaluatorNotes || state.aarEvaluation.evaluatorNotes,
        };

        const sessionId = get().currentUser?.sessionId || "SES-MALACCA-001";
        fetch(`http://${window.location.hostname}:8000/api/sessions/${sessionId}/aar/rubric`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            situational_awareness: scores.situationalAwareness,
            risk_management: scores.riskManagement,
            adaptability: scores.adaptability,
            evaluator_notes: scores.evaluatorNotes,
          }),
        }).catch(() => {
          // Fallback for standalone mode
        });

        return { aarEvaluation: updatedReport };
      });
    },
  }))
);
