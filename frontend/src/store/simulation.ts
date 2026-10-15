// src/store/simulation.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Role,
  TacticalEntity,
  FeedMessage,
  TraineeDecision,
  VerificationRequest,
  EWRule,
  AAREvaluation,
} from "../types/simulation";

export interface SimulationState {
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
  setCurrentRole: (role: Role) => void;
  setActiveView: (view: "TACTICAL" | "AAR") => void;
  setSimTime: (t: number) => void;
  setClockRunning: (running: boolean) => void;
  setTimeMultiplier: (mult: number) => void;
  setConnectionStatus: (status: "connected" | "connecting" | "disconnected") => void;
  
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
    id: "TARGET_X",
    name: "Contact X (Air Vector)",
    domain: "AIR",
    classification: "HOSTILE",
    x: 68,
    y: 35,
    speedKnots: 480,
    headingDeg: 245,
    status: "CONFIRMED",
    observedByRoles: ["COMMANDER", "UNIT_A"],
    divergenceNote: "True identity: Hostile Recon Drone. Jamming causes Commander to see delayed fix at T=3.",
  },
  {
    id: "TARGET_Y",
    name: "Contact Y (Maritime Sector)",
    domain: "SEA",
    classification: "AMBIGUOUS",
    x: 42,
    y: 72,
    speedKnots: 22,
    headingDeg: 120,
    status: "UNKNOWN",
    observedByRoles: ["COMMANDER", "UNIT_B"],
    divergenceNote: "True identity: Neutral commercial cargo vessel with malfunctioning transponder.",
  },
  {
    id: "UNIT_A_POS",
    name: "Unit A (Forward Air Defense)",
    domain: "LAND",
    classification: "FRIENDLY",
    x: 55,
    y: 40,
    speedKnots: 0,
    headingDeg: 0,
    status: "ACTIVE",
    observedByRoles: ["COMMANDER", "UNIT_A"],
  },
  {
    id: "UNIT_B_POS",
    name: "Unit B (Coastal Radar Post)",
    domain: "LAND",
    classification: "FRIENDLY",
    x: 35,
    y: 65,
    speedKnots: 0,
    headingDeg: 0,
    status: "ACTIVE",
    observedByRoles: ["COMMANDER", "UNIT_B"],
  },
];

const INITIAL_FEEDS: FeedMessage[] = [
  {
    id: "FEED-0",
    simTimestamp: 0,
    sourceUnit: "HQ COMMAND",
    targetRole: "COMMANDER",
    domain: "CYBER",
    title: "Exercise Commenced",
    content: "Operation Northern Aegis initiated. All units maintain tactical watch in Sector 4.",
    degradationType: "NORMAL",
  },
];

export const useSimulation = create<SimulationState>()(
  devtools((set, get) => ({
    currentRole: "COMMANDER",
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

    setCurrentRole: (role) => set({ currentRole: role }),
    setActiveView: (view) => set({ activeView: view }),
    setSimTime: (t) => set({ simTime: t }),
    setClockRunning: (running) => set({ clockRunning: running }),
    setTimeMultiplier: (mult) => set({ timeMultiplier: mult }),
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

      get().triggerAAR();
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
                        ? "Unit A radar reports contact bearing 245, confirmed hostile electronic signature."
                        : "Unit B optical sensors report vessel drifting with no weapon emissions. High ambiguity.",
                  }
                : v
            ),
            feeds: [
              {
                id: `FEED-VER-${Date.now()}`,
                simTimestamp: get().simTime,
                sourceUnit: toRole,
                targetRole: "COMMANDER",
                domain: toRole === "UNIT_A" ? "AIR" : "SEA",
                title: `Verification Response: ${toRole}`,
                content:
                  toRole === "UNIT_A"
                    ? "Target X confirmed hostile UAV signature on pulse doppler radar. Divergence resolved."
                    : "Target Y visual contact shows commercial fishing/cargo vessel. Not hostile.",
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

    setEWIntensity: (intensity) => set({ ewIntensity: intensity }),

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
          domain: "AIR",
          title: "CONFLICT ALERT: Target X Confirmed Hostile",
          content: "Unit A radar telemetry locks Target X as Armed Combat Drone on rapid attack vector.",
          degradationType: "CONFLICTING",
          divergenceVariant: "VARIANT_A",
        };
        const msgB: FeedMessage = {
          id: `CONF-B-${Date.now()}`,
          simTimestamp: state.simTime,
          sourceUnit: "UNIT_B (ELINT)",
          targetRole: "COMMANDER",
          domain: "AIR",
          title: "CONFLICT ALERT: Target X Civilian IFF Transponder",
          content: "Unit B intercepts Mode 3/A transponder code 7700 (Emergency Airliner) at Target X coordinates.",
          degradationType: "CONFLICTING",
          divergenceVariant: "VARIANT_B",
        };
        return { feeds: [msgA, msgB, ...state.feeds] };
      });
    },

    resetSimulation: () => {
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
      const outcomeSuccess = lastDecision?.action === "ENGAGE" || lastDecision?.action === "HOLD_VERIFY";

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
        sessionId: "SESSION-SIH26248-PROTOTYPE",
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
            ? "Trainee effectively navigated conflicting reports, initiated verification across units, and submitted a defensible tactical decision under heavy cyber degradation."
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

        return {
          aarEvaluation: {
            ...state.aarEvaluation,
            instructorScores: {
              ...scores,
              overallInstructor,
            },
            finalCompositeScore,
            evaluatorNotes: scores.evaluatorNotes || state.aarEvaluation.evaluatorNotes,
          },
        };
      });
    },
  }))
);
