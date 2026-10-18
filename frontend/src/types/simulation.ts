// src/types/simulation.ts

export type Role = "INSTRUCTOR" | "COMMANDER" | "UNIT_A" | "UNIT_B";

export interface AuthUser {
  serviceId: string;
  callSign: string;
  role: Role;
  sessionId: string;
  clearanceLevel: string;
  token: string;
}

export type DegradationType = "NORMAL" | "DELAYED" | "DROPOUT" | "CONFLICTING";

export type EntityDomain = "AIR" | "SEA" | "LAND" | "CYBER";

export type TargetClassification = "HOSTILE" | "FRIENDLY" | "UNKNOWN" | "AMBIGUOUS";

export interface TacticalEntity {
  id: string;
  name: string;
  domain: EntityDomain;
  classification: TargetClassification;
  x: number; // 0-100 normalized coordinate
  y: number; // 0-100 normalized coordinate
  speedKnots: number;
  headingDeg: number;
  status: "ACTIVE" | "ENGAGED" | "DESTROYED" | "DELAYED" | "CONFIRMED" | "UNKNOWN";
  observedByRoles: Role[];
  divergenceNote?: string;
}

export interface FeedMessage {
  id: string;
  simTimestamp: number;
  sourceUnit: string;
  targetRole: Role;
  domain: EntityDomain;
  title: string;
  content: string;
  degradationType: DegradationType;
  divergenceVariant?: "VARIANT_A" | "VARIANT_B";
  isVerified?: boolean;
}

export interface TraineeDecision {
  id: string;
  simTimestamp: number;
  role: Role;
  action: "ENGAGE" | "HOLD_VERIFY" | "VECTOR_SUPPORT" | "EVACUATE";
  targetEntityId: string;
  confidenceScore: number; // 0 - 100
  rationale: string;
  assumedRisk: string;
  evidenceMessageIds: string[];
  submittedAtWallTime: string;
}

export interface VerificationRequest {
  id: string;
  simTimestamp: number;
  fromRole: Role;
  toRole: Role;
  targetEntityId: string;
  query: string;
  response?: string;
  status: "PENDING" | "ANSWERED" | "JAMMED";
}

export interface EWRule {
  id: string;
  name: string;
  type: DegradationType;
  intensityPercent: number;
  affectedRole: Role | "ALL";
  active: boolean;
}

export interface AAREvaluation {
  sessionId: string;
  decisionMomentT: number;
  classification: "OPTIMAL" | "DEFENSIBLE" | "LUCKY_GUESS" | "CRITICAL_FAILURE";
  automatedScores: {
    responseLatencySec: number;
    latencyScore: number; // 0-100
    verificationAttempts: number;
    verificationScore: number; // 0-100
    informationSharingScore: number; // 0-100
    overallAutomated: number; // 0-100
  };
  instructorScores: {
    situationalAwareness: number; // 1-5
    riskManagement: number; // 1-5
    adaptability: number; // 1-5
    overallInstructor: number; // 0-100
  };
  finalCompositeScore: number; // 0-100
  reasoningQuality: "GOOD" | "POOR";
  outcomeQuality: "GOOD" | "BAD";
  evaluatorNotes: string;
}
