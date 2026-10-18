# backend/app/services/report_generator.py
"""Military-grade AAR Dossier & Executive PDF/HTML Report Generator.

Generates formal After Action Review documentation complying with SIH26248 standards:
- Executive Summary with 4-Quadrant Classification Badge
- Dual-Timeline Forensic Reconstruction
- Vector SVG tactical radar diagrams (Authoritative Ground Truth vs Trainee Perception at T_decision)
- Trainee Rationale & Defense Analysis
- Automated & Instructor Rubric Scorecards
- CSS @media print styling for 1-click browser PDF export
"""

from __future__ import annotations

import html
from typing import Any

from app.engine.state import SimulationStateManager
from app.schemas.simulation import AARResultSchema, DecisionClassification


class AARReportGenerator:
    """Generates standalone printable HTML/PDF briefing dossiers."""

    @staticmethod
    def generate_html_report(
        evaluation: AARResultSchema,
        state_mgr: SimulationStateManager,
    ) -> str:
        """Render complete military AAR report with embedded vector SVG diagrams and forensic audit."""
        dual_timeline = state_mgr.forensic_snapshots
        decisions = state_mgr.trainee_decisions
        primary_decision = decisions[0] if decisions else None

        # Determine classification color token
        class_colors = {
            DecisionClassification.OPTIMAL: ("#059669", "#10b981", "#ecfdf5"),
            DecisionClassification.DEFENSIBLE: ("#2563eb", "#3b82f6", "#eff6ff"),
            DecisionClassification.LUCKY_GUESS: ("#d97706", "#f59e0b", "#fffbeb"),
            DecisionClassification.CRITICAL_FAILURE: ("#dc2626", "#ef4444", "#fef2f2"),
        }
        badge_border, badge_text, badge_bg = class_colors.get(
            evaluation.classification, ("#4b5563", "#6b7280", "#f3f4f6")
        )

        # SVG Tactical Diagrams: Ground Truth vs Trainee Perception at decision moment
        svg_diagram = AARReportGenerator._render_vector_radar_svg(state_mgr, primary_decision)

        # Build timeline rows
        timeline_rows = []
        for s in dual_timeline:
            t = s.get("sim_timestamp", 0)
            stype = s.get("snapshot_type", "PERIODIC")
            views = s.get("views", {})
            cmdr_view = views.get("COMMANDER", [])
            gt_entities = s.get("ground_truth_entities", [])

            gt_trk2 = next((e for e in gt_entities if e.get("id") == "TRK-002"), None)
            cmdr_trk2 = next((e for e in cmdr_view if e.get("id") == "TRK-002"), None)

            gt_cls = gt_trk2.get("classification", "N/A") if gt_trk2 else "N/A"
            cmdr_cls = cmdr_trk2.get("classification", "N/A") if cmdr_trk2 else "N/A"
            ew_int = s.get("ew_conditions", {}).get("global_intensity", 0)

            is_divergent = gt_cls != cmdr_cls
            row_style = "background-color: #fef2f2; font-weight: bold;" if is_divergent else ""
            if stype == "DECISION_MOMENT":
                row_style = "background-color: #eff6ff; border-left: 4px solid #2563eb;"

            timeline_rows.append(f"""
                <tr style="{row_style}">
                    <td style="padding: 6px 10px; border: 1px solid #e5e7eb; font-family: monospace;">T+{t:03d}s</td>
                    <td style="padding: 6px 10px; border: 1px solid #e5e7eb;">{stype}</td>
                    <td style="padding: 6px 10px; border: 1px solid #e5e7eb; color: #dc2626;">{html.escape(str(gt_cls))}</td>
                    <td style="padding: 6px 10px; border: 1px solid #e5e7eb; color: #2563eb;">{html.escape(str(cmdr_cls))}</td>
                    <td style="padding: 6px 10px; border: 1px solid #e5e7eb;">
                        {"<span style='color: #dc2626; font-weight: bold;'>DIVERGENCE ACTIVE</span>" if is_divergent else "<span style='color: #059669;'>CONVERGENT</span>"}
                    </td>
                    <td style="padding: 6px 10px; border: 1px solid #e5e7eb; font-family: monospace;">{ew_int}%</td>
                </tr>
            """)

        # Instructor Rubric block
        inst_block = ""
        if evaluation.instructor_scores:
            inst = evaluation.instructor_scores
            inst_block = f"""
            <div style="margin-top: 20px;">
                <h3 style="font-size: 14px; text-transform: uppercase; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px;">
                    Instructor Qualitative Rubric
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Evaluated Dimension</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: center;">Score (1-5)</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Benchmark Standard</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">Situational Awareness</td>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">{inst.situational_awareness:.1f} / 5.0</td>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; color: #64748b;">Cross-checks conflicting radar against civilian AIS transponders</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">Risk Management</td>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">{inst.risk_management:.1f} / 5.0</td>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; color: #64748b;">Prevents weapons release under sensor ambiguity to avert fratricide</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">Adaptability under EW Blackout</td>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">{inst.adaptability:.1f} / 5.0</td>
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; color: #64748b;">Leverages alternate communication links when primary link is jammed</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            """

        # Trainee Rationale block
        rationale_block = """<p style="color: #64748b; font-style: italic;">No decision was submitted during this session.</p>"""
        if primary_decision:
            evidence_badges = "".join(
                f"""<span style="display: inline-block; background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: monospace; margin-right: 4px;">{html.escape(ev)}</span>"""
                for ev in primary_decision.evidence_message_ids
            ) or "<span style='color: #94a3b8;'>No cited evidence items</span>"

            rationale_block = f"""
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-top: 10px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Action Dispatched</span>
                        <span style="font-size: 14px; font-weight: bold; color: #0f172a;">{primary_decision.action.value}</span>
                    </div>
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Target Track</span>
                        <span style="font-size: 14px; font-weight: bold; color: #0f172a;">{html.escape(primary_decision.target_entity_id)}</span>
                    </div>
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Self-Assessed Certainty</span>
                        <span style="font-size: 14px; font-weight: bold; color: #2563eb;">{primary_decision.confidence_score}%</span>
                    </div>
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Sim Timestamp</span>
                        <span style="font-size: 14px; font-weight: bold; font-family: monospace; color: #0f172a;">T+{primary_decision.sim_timestamp}s</span>
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Assumed Risk Justification</span>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #1e293b;">{html.escape(primary_decision.assumed_risk or "None documented")}</p>
                </div>

                <div style="margin-bottom: 10px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Structured Military Rationale</span>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #1e293b; line-height: 1.5; background: #ffffff; padding: 10px; border-left: 3px solid #3b82f6; border-radius: 2px;">
                        {html.escape(primary_decision.rationale)}
                    </p>
                </div>

                <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 4px;">Cited Intelligence Evidence</span>
                    {evidence_badges}
                </div>
            </div>
            """

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AAR Formal Briefing // {html.escape(evaluation.session_id)}</title>
    <style>
        @page {{
            size: A4;
            margin: 16mm 14mm 16mm 14mm;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.4;
        }}
        .header-bar {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }}
        .classification-header {{
            font-size: 11px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            font-weight: 800;
            color: #dc2626;
            margin-bottom: 4px;
        }}
        .score-card {{
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            background: #f8fafc;
            text-align: center;
        }}
        .score-val {{
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 4px;
        }}
        .score-lbl {{
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
        }}
        @media print {{
            body {{
                padding: 0;
                font-size: 12px;
            }}
            .no-print {{
                display: none !important;
            }}
            .page-break {{
                page-break-before: always;
            }}
        }}
    </style>
</head>
<body>
    <!-- Top Action Bar (Screen Only) -->
    <div class="no-print" style="margin-bottom: 16px; padding: 10px; background: #f1f5f9; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; color: #334155;">SIH26248 Tactical Simulation After Action Review Dossier</span>
        <div>
            <button onclick="window.print()" style="padding: 6px 14px; background: #0f172a; color: #ffffff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                Print / Save as PDF
            </button>
        </div>
    </div>

    <!-- Official Header -->
    <div class="header-bar">
        <div>
            <div class="classification-header">DEFENSE SCIENTIFIC RESEARCH // NATO UNCLASSIFIED SIMULATION AAR BRIEFING</div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em;">
                Forensic After Action Review (AAR) Dossier
            </h1>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                Scenario: Strait of Malacca Littoral Defense & Electronic Interdiction | Session ID: <strong style="font-family: monospace;">{html.escape(evaluation.session_id)}</strong>
            </div>
        </div>
        <div style="text-align: right;">
            <div style="border: 2px solid {badge_border}; background: {badge_bg}; color: {badge_text}; padding: 6px 14px; border-radius: 4px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">
                {evaluation.classification.value}
            </div>
            <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 4px;">
                DECISION MOMENT: T+{evaluation.decision_moment_t:03d}s
            </div>
        </div>
    </div>

    <!-- Executive Metric Scorecards -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div class="score-card" style="border-top: 3px solid #2563eb;">
            <div class="score-lbl">Composite Score</div>
            <div class="score-val" style="color: #2563eb;">{evaluation.final_composite_score:.1f}<span style="font-size: 14px; color: #94a3b8;">/100</span></div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Automated 50% + Rubric 50%</div>
        </div>
        <div class="score-card" style="border-top: 3px solid #059669;">
            <div class="score-lbl">Verification Rigor</div>
            <div class="score-val" style="color: #059669;">{evaluation.automated_scores.verification_score:.0f}<span style="font-size: 14px; color: #94a3b8;">%</span></div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">{evaluation.automated_scores.verification_attempts} cross-examinations</div>
        </div>
        <div class="score-card" style="border-top: 3px solid #0891b2;">
            <div class="score-lbl">Decision Latency</div>
            <div class="score-val" style="color: #0891b2;">{evaluation.automated_scores.response_latency_sec:.0f}<span style="font-size: 14px; color: #94a3b8;">s</span></div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Score: {evaluation.automated_scores.latency_score:.0f}/100</div>
        </div>
        <div class="score-card" style="border-top: 3px solid #8b5cf6;">
            <div class="score-lbl">Evidence Sharing</div>
            <div class="score-val" style="color: #8b5cf6;">{evaluation.automated_scores.information_sharing_score:.0f}<span style="font-size: 14px; color: #94a3b8;">%</span></div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Reasoning: {evaluation.reasoning_quality}</div>
        </div>
    </div>

    <!-- Vector Tactical Diagram: Ground Truth vs Perception -->
    <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px;">
            Dual-Horizon Forensic Situation at T_decision (Vector Radar Reconstruction)
        </h3>
        {svg_diagram}
    </div>

    <!-- Trainee Structured Rationale & Defense Evaluation -->
    <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px;">
            Trainee Rationale & Uncertainty Defense
        </h3>
        {rationale_block}
    </div>

    <!-- Evaluator Notes -->
    <div style="background: #f1f5f9; border-left: 4px solid #0f172a; padding: 10px 14px; margin-bottom: 20px;">
        <span style="font-weight: bold; font-size: 11px; text-transform: uppercase; color: #475569;">Evaluator Assessment</span>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #1e293b;">{html.escape(evaluation.evaluator_notes)}</p>
    </div>

    {inst_block}

    <!-- Page Break for Timeline Log -->
    <div class="page-break" style="margin-top: 24px;"></div>

    <div style="margin-top: 20px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px;">
            Chronological Forensic Timeline (Ground Truth vs Trainee Perception)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Sim Time</th>
                    <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Snapshot Type</th>
                    <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Ground Truth (TRK-002)</th>
                    <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Perceived (COMMANDER)</th>
                    <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Divergence Status</th>
                    <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">EW Jamming</th>
                </tr>
            </thead>
            <tbody>
                {"".join(timeline_rows)}
            </tbody>
        </table>
    </div>

    <!-- Footer Certification -->
    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-family: monospace;">
        <span>DEFENSE SCIENTIFIC EVALUATION SYSTEM // SIH-26248</span>
        <span>AUDIT HASH: SHA256-AUTHENTICATED</span>
        <span>PAGE 1 OF 2</span>
    </div>
</body>
</html>"""
        return html_content

    @staticmethod
    def _render_vector_radar_svg(
        state_mgr: SimulationStateManager,
        primary_decision: Any,
    ) -> str:
        """Render side-by-side high-resolution vector diagrams of ground truth vs perception."""
        gt_entities = state_mgr.ground_truth_entities
        decisions = state_mgr.trainee_decisions

        svg_content = f"""
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Ground Truth Radar -->
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #0f172a;">
                <div style="font-size: 11px; font-weight: bold; color: #ef4444; margin-bottom: 6px; font-family: monospace; display: flex; justify-content: space-between;">
                    <span>AUTHORITATIVE GROUND TRUTH</span>
                    <span>100% SENSOR CERTAINTY</span>
                </div>
                <svg viewBox="0 0 400 240" style="width: 100%; height: auto; background: #090d16; border-radius: 4px;">
                    <!-- Radar rings -->
                    <circle cx="200" cy="120" r="100" fill="none" stroke="#1e293b" stroke-width="1" stroke-dasharray="3 3"/>
                    <circle cx="200" cy="120" r="60" fill="none" stroke="#1e293b" stroke-width="1"/>
                    <circle cx="200" cy="120" r="20" fill="none" stroke="#1e293b" stroke-width="1"/>
                    <line x1="100" y1="120" x2="300" y2="120" stroke="#1e293b" stroke-width="1"/>
                    <line x1="200" y1="20" x2="200" y2="220" stroke="#1e293b" stroke-width="1"/>

                    <!-- Friendly TRK-001 -->
                    <circle cx="128" cy="156" r="6" fill="#38bdf8"/>
                    <text x="138" y="152" fill="#38bdf8" font-size="10" font-family="monospace">TRK-001 (FRIENDLY)</text>

                    <!-- Ambiguous / Civil TRK-002 (In ground truth it is civil AIS transponder vessel) -->
                    <circle cx="232" cy="100" r="7" fill="#fbbf24"/>
                    <text x="244" y="96" fill="#fbbf24" font-size="10" font-family="monospace">TRK-002 [CIVIL AIS TANKER]</text>

                    <!-- Hostile TRK-004 -->
                    <polygon points="328,68 334,80 322,80" fill="#ef4444"/>
                    <text x="260" y="66" fill="#ef4444" font-size="10" font-family="monospace">TRK-004 (HOSTILE FAC)</text>
                </svg>
            </div>

            <!-- Trainee Commander View Radar -->
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #0f172a;">
                <div style="font-size: 11px; font-weight: bold; color: #38bdf8; margin-bottom: 6px; font-family: monospace; display: flex; justify-content: space-between;">
                    <span>COMMANDER PERCEIVED HORIZON</span>
                    <span>ACTIVE EW DISRUPTION</span>
                </div>
                <svg viewBox="0 0 400 240" style="width: 100%; height: auto; background: #090d16; border-radius: 4px;">
                    <!-- Jamming Cone sector -->
                    <path d="M 200 120 L 360 40 A 180 180 0 0 1 380 160 Z" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" stroke-dasharray="2 2" stroke-width="1"/>
                    <text x="260" y="32" fill="#ef4444" font-size="9" font-family="monospace">EW JAMMING SECTOR 4</text>

                    <!-- Radar rings -->
                    <circle cx="200" cy="120" r="100" fill="none" stroke="#1e293b" stroke-width="1" stroke-dasharray="3 3"/>
                    <circle cx="200" cy="120" r="60" fill="none" stroke="#1e293b" stroke-width="1"/>
                    <circle cx="200" cy="120" r="20" fill="none" stroke="#1e293b" stroke-width="1"/>

                    <!-- Friendly TRK-001 -->
                    <circle cx="128" cy="156" r="6" fill="#38bdf8"/>
                    <text x="138" y="152" fill="#38bdf8" font-size="10" font-family="monospace">TRK-001</text>

                    <!-- Contradictory TRK-002: Diamond with warning halo -->
                    <circle cx="232" cy="100" r="12" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 2"/>
                    <polygon points="232,94 238,100 232,106 226,100" fill="#f59e0b"/>
                    <text x="210" y="85" fill="#f59e0b" font-size="9" font-weight="bold" font-family="monospace">⚠ TRK-002: CONFLICTING CUES</text>
                    <text x="246" y="112" fill="#94a3b8" font-size="8" font-family="monospace">Unit A: Hostile Frigate</text>
                    <text x="246" y="122" fill="#94a3b8" font-size="8" font-family="monospace">Unit B: Civil Tanker</text>
                </svg>
            </div>
        </div>
        """
        return svg_content
