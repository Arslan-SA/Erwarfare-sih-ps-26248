// src/components/FeedStream.tsx
import { useSimulation } from "../store/simulation";
import type { FeedMessage } from "../types/simulation";

interface FeedStreamProps {
  onOpenVerification?: () => void;
}

export default function FeedStream({ onOpenVerification }: FeedStreamProps) {
  const { feeds, currentRole } = useSimulation();

  // Filter feeds delivered to this role (Instructors see everything)
  const roleFeeds = feeds.filter(
    (f) => currentRole === "INSTRUCTOR" || f.targetRole === currentRole || f.targetRole === "COMMANDER"
  );

  const hasConflict = roleFeeds.some((f) => f.degradationType === "CONFLICTING");

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Tactical Intelligence & Comms Feed</span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            ({roleFeeds.length} RECORDS)
          </span>
        </div>
        {onOpenVerification && (
          <button
            onClick={onOpenVerification}
            className="btn-tactical btn-outline"
            style={{ padding: "4px 8px", fontSize: "0.7rem" }}
          >
            Cross-Check Unit
          </button>
        )}
      </div>

      {/* Conflict Alert Banner */}
      {hasConflict && (
        <div className="conflict-banner">
          <div style={{ fontSize: "1.2rem" }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-amber)" }}>
              SENSOR CONFLICT IN PROGRESS
            </div>
            <div style={{ fontSize: "0.75rem", color: "#fef08a" }}>
              Incongruent reports received on Target X. Cross-examination recommended before kinetic engagement.
            </div>
          </div>
          {onOpenVerification && (
            <button
              onClick={onOpenVerification}
              className="btn-tactical btn-amber"
              style={{ padding: "4px 10px", fontSize: "0.7rem", whiteSpace: "nowrap" }}
            >
              Verify Contact
            </button>
          )}
        </div>
      )}

      {/* Feed List */}
      <div className="feed-list">
        {roleFeeds.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-dim)", fontSize: "0.85rem" }}>
            Awaiting incoming telemetry streams...
          </div>
        ) : (
          roleFeeds.map((item: FeedMessage) => (
            <div key={item.id} className={`feed-card ${item.degradationType}`}>
              <div className="feed-meta">
                <span>
                  [{formatSimTime(item.simTimestamp)}] {item.sourceUnit} → {item.targetRole}
                </span>
                <span className={`badge-tag badge-${item.degradationType.toLowerCase()}`}>
                  {item.degradationType} {item.divergenceVariant ? `(${item.divergenceVariant})` : ""}
                </span>
              </div>
              <div className="feed-title">{item.title}</div>
              <div className="feed-content">{item.content}</div>
              {item.isVerified && (
                <div style={{ marginTop: "4px", fontSize: "0.7rem", color: "#34d399", fontWeight: 600 }}>
                  ✓ VERIFICATION CONFIRMED BY TAC-NET
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatSimTime(t: number): string {
  const mins = Math.floor(t / 60);
  const secs = t % 60;
  return `T+${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
