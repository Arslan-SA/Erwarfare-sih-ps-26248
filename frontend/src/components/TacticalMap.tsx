// src/components/TacticalMap.tsx
import { useEffect, useRef } from "react";
import { useSimulation } from "../store/simulation";

export default function TacticalMap() {
  const {
    currentRole,
    simTime,
    groundTruthEntities,
    ewIntensity,
    commsSeveredUnits,
  } = useSimulation();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef<number>(0);

  // Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) * 0.44;

      // Clear Canvas
      ctx.fillStyle = "#070c18";
      ctx.fillRect(0, 0, width, height);

      // 1. Draw MGRS Tactical Grid Lines
      ctx.strokeStyle = "rgba(40, 80, 140, 0.18)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw Range Rings (50km, 100km, 150km)
      const rings = [0.33, 0.66, 1.0];
      const ringLabels = ["50 KM", "100 KM", "150 KM"];
      rings.forEach((scale, idx) => {
        const radius = maxRadius * scale;
        ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(56, 189, 248, 0.5)";
        ctx.font = "9px ui-monospace";
        ctx.fillText(ringLabels[idx], centerX + 8, centerY - radius + 12);
      });

      // Crosshairs
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius, centerY);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.moveTo(centerX, centerY - maxRadius);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.stroke();

      // 3. Draw EW Jamming Cone if active (Sector 4: top-right quadrant)
      if (simTime >= 2 && simTime <= 6) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius * 1.05, -Math.PI / 4, 0);
        ctx.closePath();
        ctx.fillStyle = `rgba(239, 68, 68, ${0.08 + (ewIntensity / 100) * 0.12})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();

        ctx.fillStyle = "#f87171";
        ctx.font = "10px ui-monospace";
        ctx.fillText(`SECTOR 4 EW JAMMING (${ewIntensity}%)`, centerX + maxRadius * 0.45, centerY - maxRadius * 0.45);
        ctx.restore();
      }

      // 4. Draw Animated Radar Sweep
      sweepAngleRef.current = (sweepAngleRef.current + 0.02) % (Math.PI * 2);
      const sweepAngle = sweepAngleRef.current;
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
      grad.addColorStop(0, "rgba(56, 189, 248, 0.15)");
      grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, maxRadius, sweepAngle - 0.25, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Sweep edge line
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + maxRadius * Math.cos(sweepAngle), centerY + maxRadius * Math.sin(sweepAngle));
      ctx.stroke();
      ctx.restore();

      // 5. Project Entities Based on Role (Asymmetric Delivery)
      groundTruthEntities.forEach((entity) => {
        let isVisible = false;
        let displayedStatus = entity.status;
        let displayedClassification = entity.classification;
        let displayX = (entity.x / 100) * width;
        let displayY = (entity.y / 100) * height;

        if (currentRole === "INSTRUCTOR") {
          isVisible = true; // Omniscient ground truth
        } else if (currentRole === "COMMANDER") {
          isVisible = true;
          if (entity.id === "TRK-002" && (simTime >= 2 || ewIntensity > 0)) {
            displayedStatus = "DELAYED";
            displayX += Math.sin(simTime * 2 + entity.headingDeg) * Math.min(10, Math.max(3, ewIntensity / 10));
            displayY += Math.cos(simTime * 2 + entity.headingDeg) * Math.min(10, Math.max(3, ewIntensity / 10));
          }
        } else if (currentRole === "UNIT_A") {
          isVisible = entity.observedByRoles?.includes("UNIT_A") || entity.id === "TRK-001" || entity.id === "TRK-002" || entity.id === "TRK-003";
          if (entity.id === "TRK-002") {
            displayedClassification = "HOSTILE";
            displayedStatus = "CONFIRMED";
          }
        } else if (currentRole === "UNIT_B") {
          isVisible = entity.observedByRoles?.includes("UNIT_B") || entity.id === "TRK-001" || entity.id === "TRK-002" || entity.id === "TRK-004";
          if (entity.id === "TRK-002") {
            displayedClassification = "AMBIGUOUS";
            displayedStatus = "UNKNOWN";
          }
        }

        if (!isVisible) return;

        const isSevered = (currentRole === "UNIT_A" && commsSeveredUnits.unitA) ||
                          (currentRole === "UNIT_B" && commsSeveredUnits.unitB) ||
                          (entity.id === "TRK-001" && commsSeveredUnits.unitA);

        ctx.save();
        const isHostile = displayedClassification === "HOSTILE";
        const isFriendly = displayedClassification === "FRIENDLY";

        ctx.strokeStyle = isSevered
          ? "#ef4444"
          : isHostile
          ? "#f87171"
          : isFriendly
          ? "#38bdf8"
          : "#fbbf24";

        ctx.fillStyle = isSevered
          ? "rgba(239, 68, 68, 0.3)"
          : isHostile
          ? "rgba(248, 113, 113, 0.25)"
          : isFriendly
          ? "rgba(56, 189, 248, 0.25)"
          : "rgba(251, 191, 36, 0.25)";

        ctx.lineWidth = 2;

        if (isFriendly) {
          ctx.beginPath();
          ctx.rect(displayX - 8, displayY - 8, 16, 16);
          ctx.fill();
          ctx.stroke();
        } else if (isHostile) {
          ctx.beginPath();
          ctx.moveTo(displayX, displayY - 10);
          ctx.lineTo(displayX + 10, displayY);
          ctx.lineTo(displayX, displayY + 10);
          ctx.lineTo(displayX - 10, displayY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(displayX, displayY - 10);
          ctx.lineTo(displayX + 9, displayY + 8);
          ctx.lineTo(displayX - 9, displayY + 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Heading Vector line
        if (entity.speedKnots > 0) {
          const rad = (entity.headingDeg - 90) * (Math.PI / 180);
          ctx.beginPath();
          ctx.moveTo(displayX, displayY);
          ctx.lineTo(displayX + 22 * Math.cos(rad), displayY + 22 * Math.sin(rad));
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px ui-monospace";
        ctx.fillText(entity.name, displayX + 12, displayY - 4);

        ctx.fillStyle = isSevered ? "#ef4444" : "#94a3b8";
        ctx.font = "9px ui-monospace";
        const subText = isSevered
          ? "COMMS SEVERED"
          : `${displayedStatus} | ${entity.speedKnots} KTS`;
        ctx.fillText(subText, displayX + 12, displayY + 8);

        ctx.restore();
      });

      // MGRS Coordinates Watermark
      ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
      ctx.font = "10px ui-monospace";
      ctx.fillText(`MGRS: 38T LN 7482 1943 | GRID CONVERGENCE: -0.84°`, 16, height - 16);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentRole, simTime, groundTruthEntities, ewIntensity, commsSeveredUnits]);

  // Handle Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "360px" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {/* Role View Watermark Overlay */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: "4px 10px",
          background: "rgba(10, 16, 28, 0.8)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "4px",
          fontFamily: "ui-monospace",
          fontSize: "0.75rem",
          color: "#38bdf8",
        }}
      >
        VIEW: {currentRole} {currentRole === "INSTRUCTOR" ? "(GROUND TRUTH)" : "(DEGRADED HORIZON)"}
      </div>

      {/* Comms Dropout Warning */}
      {(commsSeveredUnits.unitA || commsSeveredUnits.unitB) && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            padding: "6px 12px",
            background: "rgba(239, 68, 68, 0.2)",
            border: "1px solid #ef4444",
            borderRadius: "4px",
            fontFamily: "ui-monospace",
            fontSize: "0.75rem",
            color: "#f87171",
          }}
        >
          LINK DROP: {commsSeveredUnits.unitA ? "UNIT A SEVERED " : ""}{commsSeveredUnits.unitB ? "UNIT B SEVERED" : ""}
        </div>
      )}
    </div>
  );
}
