# Immersive Multi-Domain Decision-Making Trainer (SIH26248)
## Complete End-to-End System Flow & 235-Fragment Prototype Execution Plan

---

### Executive Flow & Architectural Overview

The **Immersive Multi-Domain Decision-Making Trainer** is built around a single doctrinal tenet: **evaluating defensible decisions under uncertainty, rather than rewarding lucky guesses based on hidden ground truth.**

```
+----------------------------------------------------------------------------------------------------+
|                                    1. GROUND TRUTH (AUTHORITATIVE)                                  |
|   Hidden master state managed by FastAPI & stored in PostgreSQL: actual positions, real events     |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                  2. SOFTWARE-DEFINED EW DEGRADATION                                |
|   Rules engine transforms truth into degraded feeds: Normal, Delayed, Conflicting, or Dropout       |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                               3. ASYMMETRIC MULTIPLAYER DELIVERY (WS)                              |
|   Server projects role-specific views to Commander, Unit A, and Unit B (No local client filtering) |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                   4. TRAINEE DECISION & RATIONALE                                   |
|   Trainee verifies conflicting cues, submits action + confidence + structured military rationale   |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                           5. AFTER ACTION REVIEW (AAR) & FORENSIC SCORING                          |
|   Dual-timeline reconstruction (What trainee knew vs. Ground truth) + Rubric + Automated metrics  |
+----------------------------------------------------------------------------------------------------+
```

#### Core Components
1. **Scenario Engine & Simulation Clock (FastAPI/Python)**: Operates on a discrete chronological simulation clock decoupled from real-world server latency. Dispatches events from a priority queue based on scenario time $T$.
2. **Software-Defined EW Degradation Engine**: Deterministic rules engine simulating cyber/electronic warfare without hardware:
   - **Normal**: Zero-latency delivery to designated units.
   - **Delayed**: Enqueued in a timer queue, delivered after simulated latency $T_{delay}$.
   - **Conflicting**: Generates two contradictory reports (e.g., Target X confirmed vs Target X decoy) with identical timestamps to induce cognitive friction.
   - **Dropout**: Drops packet entirely; marks event as undelivered in persistence log.
3. **Role-Based Asymmetric Projection**: Authoritative server acts as gateway. Trainees never receive global ground truth; server sends only degraded, partitioned feeds via WebSockets.
4. **Instructor Closed-Loop Telemetry & Dynamic Injections**: Real-time instructor dashboard streaming live trainee actions, with real-time controls to dial EW intensity, sever links, or inject false sensor anomalies.
5. **AAR & Dual-Timeline Reconstruction**: Compares what the trainee knew at timestamp $T_{decision}$ against the hidden ground truth. Evaluates whether the decision was *defensible*, *optimal*, a *critical failure*, or a *lucky guess*.

---

## 235-Fragment Prototype Implementation Plan

### Phase 1: Environment Setup, Tooling & Base Architecture (Fragments 1–20)
1. Initialize monorepo structure with `/backend` (FastAPI), `/frontend` (React + TypeScript + Vite), and `/shared` (JSON schemas/types).
2. Configure Python 3.11+ virtual environment with Poetry/Pipenv.
3. Configure frontend with Node.js 20+, Vite, React 19 / 18, and TypeScript strict mode.
4. Set up root-level Docker Compose with PostgreSQL 16, Redis (for pub/sub & message queues), and API containers.
5. Define shared code-formatting and linting standards (Ruff/Black for Python; ESLint + Prettier for TypeScript).
6. Set up `.env.example` configurations for database credentials, JWT secrets, CORS domains, and WebSocket ports.
7. Configure FastAPI application entrypoint with CORS middleware, lifespan events, and global exception handlers.
8. Establish centralized structured logging framework in FastAPI using `structlog` with JSON formatting.
9. Configure frontend Vite path aliases (`@components`, `@hooks`, `@services`, `@types`, `@assets`).
10. Set up Tailwind CSS / Vanilla CSS design token system (dark-mode first, tactical military glassmorphism aesthetic).
11. Install core backend packages: `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `asyncpg`, `sqlalchemy[asyncio]`, `alembic`, `websockets`.
12. Install core frontend packages: `lucide-react`, `zustand` (state management), `leaflet` / `@visx/visx` (tactical grid), `canvas-confetti`, `zod`.
13. Configure Git pre-commit hooks for typing and linting checks using `pre-commit` and `husky`.
14. Create automated health-check endpoint `GET /api/health` returning system clock, DB connectivity, and active connections.
15. Set up shared TypeScript types generator from Pydantic schemas using `pydantic2ts` or `openapi-typescript`.
16. Establish standard API error response envelope (`error`, `message`, `timestamp`, `details`).
17. Configure Redis connection pool with asynchronous fallback for local standalone memory queues.
18. Set up automated test runners (`pytest` + `pytest-asyncio` on backend, `vitest` on frontend).
19. Create base mock fixtures for military tactical symbols and NATO standard naming conventions.
20. Document developer quickstart in `README.md` detailing single-command bootstrap (`docker compose up`).

---

### Phase 2: Database Schema, ORM Models & Migrations (PostgreSQL) (Fragments 21–40)
21. Set up Alembic migration environment configured for asynchronous SQLAlchemy.
22. Create `scenarios` table schema (id, name, description, config_json, duration_seconds, created_at, updated_at).
23. Create `simulation_sessions` table (id, scenario_id, status: PENDING|RUNNING|PAUSED|COMPLETED, started_at, ended_at).
24. Create `session_users` table mapping user accounts to session roles (INSTRUCTOR, COMMANDER, UNIT_A, UNIT_B).
25. Create `simulation_clock_events` table (id, session_id, sim_timestamp, event_type, payload_json, is_executed).
26. Create `ground_truth_events` table (id, session_id, sim_timestamp, domain: AIR|SEA|LAND|CYBER, payload_json).
27. Create `comms_degradation_rules` table (id, session_id, rule_type: NORMAL|DELAYED|DROPOUT|CONFLICTING, parameters_json, active_window_start, active_window_end).
28. Create `transmitted_messages` table (id, session_id, original_event_id, source_unit, target_unit, degradation_type, delivered_at, payload_variant).
29. Create `delivery_status_log` table (id, message_id, target_role, status: PENDING|DELIVERED|DROPPED, latency_ms).
30. Create `trainee_decisions` table (id, session_id, user_id, role, sim_timestamp, action_type, target_entity, confidence_score, decision_payload).
31. Create `decision_rationales` table (id, decision_id, structured_reasons: JSON, raw_notes, evidence_message_ids: UUID[]).
32. Create `trainee_verifications` table (id, session_id, user_id, queried_source, sim_timestamp, verification_type).
33. Create `instructor_injections` table (id, session_id, instructor_id, sim_timestamp, injection_type, target_units, payload_override).
34. Create `aar_evaluations` table (id, session_id, decision_id, automated_score, latency_score, verification_score, instructor_score, classification: OPTIMAL|DEFENSIBLE|CRITICAL_FAILURE|LUCKY_GUESS).
35. Create `instructor_rubrics` table (id, session_id, situational_awareness_score, risk_management_score, adaptability_score, notes).
36. Add composite index on `(session_id, sim_timestamp)` across all timeline and logging tables for rapid AAR retrieval.
37. Implement SQLAlchemy model classes for all schema entities with full typing and relationships.
38. Create database seeding script `seed_scenarios.py` with baseline military scenario configs.
39. Write automated migration verification test validating rollback and forward migrations.
40. Implement repository layer pattern in FastAPI for isolated database transactions and query encapsulation.

---

### Phase 3: Scenario Config Specification & Ingestion Engine (Fragments 41–58)
41. Design JSON/YAML Scenario Schema definition specification (`ScenarioConfigV1`).
42. Define `Metadata` schema (scenario_id, name, tactical_context, difficulty, simulated_duration).
43. Define `RoleDefinitions` schema (Commander, Subordinate Units, Liaison, Observers).
44. Define `InitialState` schema (assets, geolocations, sensor coverages, initial comm status).
45. Define `TimelineEvent` schema (sim_time_offset, event_type, domain, authoritative_data, default_recipients).
46. Define `DegradationSchedule` schema (start_time, end_time, affected_channels, condition: DROPOUT|DELAY|CONFLICT).
47. Implement Pydantic V2 validator verifying that chronological events contain no negative timestamps.
48. Implement validator ensuring all referenced recipient roles exist in the scenario role definitions.
49. Create scenario parser with comprehensive error highlighting (line number, invalid key, missing dependencies).
50. Implement scenario loading endpoint `POST /api/scenarios/import` supporting file upload of YAML/JSON.
51. Implement scenario retrieval endpoint `GET /api/scenarios` and `GET /api/scenarios/{id}`.
52. Create pre-built scenario fixture: "Operation Northern Aegis" (Border airspace radar anomalies + cyber comms blackout).
53. Create pre-built scenario fixture: "Operation Trident Jam" (Maritime convoy with conflicting target identification).
54. Implement scenario schema export utility generating JSON Schema (`scenario.schema.json`) for frontend validation.
55. Add scenario cloning and modification API endpoint `POST /api/scenarios/{id}/fork`.
56. Implement scenario dry-run validator simulating full event scheduling without executing side effects.
57. Build unit tests checking invalid scenario configurations (e.g., circular event triggers, orphaned recipient roles).
58. Create scenario documentation generator exporting human-readable scenario brief for instructors.

---

### Phase 4: Authoritative Simulation Clock & Priority Event Queue (Fragments 59–80)
59. Design discrete asynchronous simulation clock engine (`SimulationClock`) running on an independent tick.
60. Implement configurable time-dilation scaling factor (1x real-time, 2x, 5x, 10x, or paused).
61. Build min-heap Priority Queue (`heapq` / `asyncio.PriorityQueue`) sorting events by `sim_timestamp`.
62. Create clock synchronization loop dispatching events exactly when `sim_timestamp <= current_sim_time`.
63. Implement clock control interface: `start()`, `pause()`, `resume()`, `step()`, `stop()`.
64. Isolate simulation clock time from wall-clock time to prevent network latency from affecting scenario pacing.
65. Build `SimulationSessionManager` orchestrating session lifecycles in-memory with PostgreSQL backing.
66. Create event dispatcher routing due events from queue to the Authoritative State Handler.
67. Implement `AuthoritativeState` container holding hidden ground truth (unit health, absolute coordinates, true threats).
68. Implement state mutation handlers executing event logic (e.g., radar detect enemy, missile launch, weather change).
69. Create periodic state snapshot generator capturing authoritative state every $N$ simulation seconds.
70. Build simulation pause lock ensuring in-flight messages freeze during instructor pause.
71. Implement simulation step handler permitting manual frame-by-frame forward ticking for debugging.
72. Build time-warp guard preventing backward clock adjustments during active multiplayer sessions.
73. Implement heartbeat broadcast emitting current `sim_time`, `tick_rate`, and `status` to connected clients.
74. Create watchdog monitor detecting clock stalls or unhandled event execution exceptions.
75. Implement graceful session teardown flushing state to database when clock reaches scenario duration.
76. Write unit tests validating that priority queue strictly maintains chronological execution under rapid insertions.
77. Write stress tests simulating 1,000 simultaneous scheduled events without clock drift.
78. Add simulation event cancellation handler for events invalidated by prior actions.
79. Implement simulation time formatter converting epoch tick integers to military Zulu time (e.g., `140830Z OCT 26`).
80. Expose REST control endpoints `POST /api/sessions/{id}/clock/(start|pause|resume|step)`.

---

### Phase 5: Software-Defined EW & Degradation Rules Engine (Fragments 81–104)
81. Create `DegradationEngine` interface intercepting authoritative events before network dispatch.
82. Implement condition evaluator matching active EW rules against message domain, channel, and recipient.
83. Implement **Normal Condition**: instant pass-through to delivery gateway with zero degradation flag.
84. Implement **Delayed Condition**: enqueues message in delayed buffer with execution time $T_{deliver} = T_{sim} + T_{delay}$.
85. Implement delayed buffer checker running inside simulation tick loop to release matured delayed messages.
86. Implement **Dropout Condition**: silently discards packet; creates audit log entry marked `DELIVERY_DROPPED`.
87. Implement **Conflicting Condition Generator**: takes ground truth event and forks it into Variant A and Variant B.
88. Create conflict mutation strategies: position offset jitter (e.g., +15km East vs +15km West).
89. Create conflict mutation strategies: classification conflict (e.g., "Hostile Su-35" vs "Civilian Airliner B777").
90. Create conflict mutation strategies: status conflict (e.g., "Missile Silo Destroyed" vs "Missile Silo Active/Fueled").
91. Preserve identical transmission timestamp and originating source ID across both conflicting variants.
92. Implement routing logic assigning Variant A to Unit A and Variant B to Unit B or Commander.
93. Build recovery loop mechanism allowing degraded links to recover dynamically upon instructor command or time expiry.
94. Implement channel noise simulation adding random text corruption/garble to tactical radio messages.
95. Implement cyber spoofing rule injecting synthetic unauthorized reports claiming to originate from friendly units.
96. Implement message degradation metadata tag (`degradation_id`, `applied_rule`, `divergence_vector`) for AAR tracking.
97. Ensure degradation engine executes exclusively server-side; clients receive zero instructions revealing degradation status.
98. Implement rate-limiting degradation (bandwidth throttling) simulating high-frequency jamming packet loss.
99. Create rule priority hierarchy (e.g., DROPOUT overrides DELAY; CONFLICT takes precedence over NORMAL).
100. Write unit test verifying that dropped messages never invoke delivery WebSocket handlers.
101. Write unit test verifying that delayed messages arrive at exact designated scenario time regardless of real-world delay.
102. Write unit test asserting conflicting report variants share identical originating message IDs and timestamps.
103. Expose API endpoint `GET /api/sessions/{id}/ew-status` showing currently active jamming sectors and rules.
104. Implement dynamic rule injector allowing ad-hoc EW modifications during a live run.

---

### Phase 6: WebSocket Infrastructure, Session Rooms & Role Routing (Fragments 105–122)
105. Configure FastAPI WebSocket router with route `/ws/session/{session_id}`.
106. Implement authentication handshake using short-lived JWT tokens passed via query param or initial ticket exchange.
107. Create `ConnectionManager` tracking active WebSocket connections keyed by `(session_id, user_id, role)`.
108. Implement connection grouping: `instructor_room`, `commander_room`, `unit_a_room`, `unit_b_room`.
109. Handle unexpected client disconnects with reconnection grace periods (30 seconds) without session disruption.
110. Implement message serialization using compact JSON or MessagePack for tactical low-latency payloads.
111. Create client acknowledgment protocol (`ACK`) confirming receipt of critical role feeds.
112. Implement unacknowledged message retry queue for transient network dropouts (real-world network resilience).
113. Create role authorization guard rejecting unauthorized client requests over WebSocket channels.
114. Implement rate limiter on incoming WebSocket messages to prevent trainee command spamming.
115. Build connection health monitor with automated ping/pong frames every 15 seconds.
116. Build broadcast helper: `broadcast_to_session()`, `send_to_role()`, `send_to_user()`.
117. Implement telemetry stream piping trainee cursor focus and click events to Instructor room in real time.
118. Create WebSocket channel logger capturing all raw ingress and egress frames with millisecond precision.
119. Write integration test establishing 4 simultaneous connections (Instructor, Commander, Unit A, Unit B).
120. Test graceful disconnection and reconnection re-hydrating missed trainee state.
121. Write load test checking WebSocket stability under 50 simultaneous simulated trainee connections.
122. Expose active session participant list endpoint `GET /api/sessions/{id}/participants`.

---

### Phase 7: Role-Based Asymmetric Delivery & Fog-of-War Projection (Fragments 123–140)
123. Implement `ProjectionEngine` converting Authoritative State into role-specific filtered projections.
124. Build **Commander Projection Filter**: receives aggregated unit reports, strategic alerts, delayed tactical sensor feeds.
125. Build **Unit A Projection Filter**: receives local sectoral radar, direct reconnaissance, Unit A status telemetry.
126. Build **Unit B Projection Filter**: receives adjacent sectoral feeds, electronic intercept reports, Unit B asset status.
127. Build **Instructor Projection Filter**: receives full unvarnished ground truth + overlaid trainee view representations.
128. Enforce zero client-side filtering: trainee clients receive strictly stripped data objects with no hidden coordinates.
129. Implement asymmetric intelligence cards delivering partial information fragments to specific trainees.
130. Build cross-talk communication channel allowing trainees to send peer-to-peer verification requests.
131. Route peer-to-peer trainee communications through the Degradation Engine (subjecting peer comms to jamming).
132. Create verification request protocol enabling Commander to query Unit A for confirmation of conflicting reports.
133. Implement latency penalty for peer-to-peer verifications under active cyber degradation.
134. Build unit status reporting schema (ammo, radar lock, fuel, EW detection) projected only to owner and commander.
135. Create "Unknown / Ambiguous" status mapper replacing missing telemetry with explicit visual uncertainty markers.
136. Write unit tests ensuring Unit A never receives Unit B's private sensor feeds unless explicitly relayed.
137. Write security test verifying trainee client memory/DOM inspection reveals zero authoritative ground truth.
138. Implement projection caching layer minimizing serialization overhead during multi-client broadcasts.
139. Test projection updates when instructor drops a comms link mid-exercise.
140. Add audit log logging exact projection payload delivered to each role at each millisecond.

---

### Phase 8: Trainee Client Application (React/TS — Commander & Units) (Fragments 141–164)
141. Scaffold Trainee dashboard layout with tactical grid layout (Header, Map Canvas, Feed Stream, Decision Dock).
142. Build WebSocket connection manager hook (`useSimulationSocket`) with auto-reconnect and status badges.
143. Implement Zustand global trainee store holding received alerts, current role, sim time, and active feeds.
144. Design tactical Tactical Map component using Leaflet / Canvas with military grid reference system (MGRS).
145. Implement custom military map markers (Hostile, Friendly, Unknown, Ambiguous, Jammed Zone).
146. Build Incoming Feed Stream component rendering categorized intelligence reports with arrival timestamps.
147. Add visual cues for degraded data: "Stale Feed" timer badge, "Unverified Source", "Signal Noise Garble".
148. Implement **Conflict Detection Indicator** highlighting discrepancies between incoming reports on the same entity.
149. Build **Verification Request Modal** allowing Commander to order subordinate units to cross-check contacts.
150. Build **Structured Decision Dock**: action selection (e.g., ENGAGE, HOLD, VECTOR, SCRAMBLE, EVACUATE, JAM).
151. Implement **Confidence Slider Component** (0% - 100%) capturing trainee's self-assessed certainty.
152. Implement **Structured Rationale Capture Form**:
    - Primary supporting intelligence item selection (checkboxes linking to received feeds).
    - Assumed risk category (Collateral damage, friendly-fire, asset loss, mission failure).
    - Free-form tactical reasoning input field with minimum character requirement.
153. Build pre-submission confirmation dialog summarizing action, selected evidence, and rationale.
154. Implement instantaneous submission feedback locking the decision card and transmitting payload over WS.
155. Build Unit Subordinate View (Unit A / Unit B): focused local sector view with direct orders inbox.
156. Implement Unit "Report Observation" form allowing subordinate units to submit observations back up the chain.
157. Build audio cues / tactical sound effects (synthesized alerts, radio squelch, jamming static) using Web Audio API.
158. Add keyboard shortcuts for rapid military action dispatch (`Ctrl+Enter` submit, `1-4` action select).
159. Build responsive breakpoint guards warning trainee if viewport size is insufficient for tactical display.
160. Create local offline-state indicator showing clear visual overlay when comms link is severly jammed.
161. Write unit tests for decision form validation (preventing submission without structured rationale).
162. Write component tests for Tactical Map marker positioning and status updates.
163. Implement theme toggle (Night Vision Tactical Green vs High-Contrast Amber vs Modern Dark Slate).
164. Add accessible ARIA announcements for screen readers announcing high-priority alerts.

---

### Phase 9: Instructor Dashboard & Dynamic Closed-Loop Injection Engine (Fragments 165–184)
165. Scaffold Instructor Dashboard layout: Master Control Bar, Omniscient Map, Trainee Telemetry Grid, Injector Panel.
166. Implement Master Control Bar: Start, Pause, Resume, Reset, Time Multiplier (1x, 2x, 5x), Scenario Clock Display.
167. Build **Omniscient Map View**: simultaneously renders Ground Truth (true entity paths) and Trainee Views.
168. Overlay trainee fog-of-war perimeters and degraded sensor cones over the omniscient map.
169. Build **Live Trainee Telemetry Panel**: displays active trainee cursors, open modals, and unread alert counts.
170. Implement **Dynamic Injection Console**:
    - "Override EW Intensity" slider: controls overall packet drop and latency probabilities globally or by sector.
    - "Sever Comms Link" toggle: instantly breaks communication between Commander and selected Unit.
    - "Inject Conflicting Report" button: triggers instant contradictory sensor report into live queue.
    - "Cyber Spoofing Injector": sends falsified order appearing to originate from Commander.
171. Build scenario event timeline progress bar displaying past, current, and upcoming scheduled events.
172. Add ability for instructor to drag-and-drop scheduled events on timeline to alter pacing on the fly.
173. Implement "Freeze for Teaching" feature pausing simulation clock while keeping trainee audio/chat links alive.
174. Create "Instructor Note" feature allowing instructor to attach live timestamped commentary to trainee actions.
175. Build Trainee Decision Monitor showing incoming trainee decisions with real-time alerts.
176. Implement quick-action inject buttons for standard military contingencies (e.g., "Civilian Intrusion", "Sensor Failure").
177. Build visual indicators displaying current WebSocket connection quality and ping for each trainee.
178. Add confirmation safety modals for destructive actions (e.g., Reset Exercise, Terminate Session).
179. Implement split-screen comparison mode comparing Unit A's current screen against Unit B's screen.
180. Write unit tests for instructor dynamic injection command dispatchers.
181. Test instructor timeline pause ensuring trainee screens immediately enter paused state overlay.
182. Build session export button allowing instructor to save session configuration for repeatability.
183. Implement instructor role handover allowing a secondary instructor to observe or take command.
184. Create automated tour / onboarding walkthrough guide for new instructors.

---

### Phase 10: State Snapshotting & Forensic Uncertainty Logging (Fragments 185–200)
185. Implement `ForensicLogger` service intercepting every simulation lifecycle event.
186. Create atomic snapshot recorder capturing the complete state tuple at timestamp $T$:
    $$\Sigma(T) = \langle S_{ground\_truth}, S_{comms\_state}, S_{unitA\_view}, S_{unitB\_view}, S_{commander\_view} \rangle$$
187. Implement event logging for **Decision Moments** ($T_{decision}$): capture the exact "Snapshot of Uncertainty".
188. Store exact set of messages and alerts visible on the trainee's screen at the exact second of decision.
189. Record all unacknowledged, delayed, or dropped messages that the trainee *could not* have seen at $T_{decision}$.
190. Record trainee interaction metrics: time from alert arrival to decision submission (Response Latency).
191. Log all verification actions (e.g., cross-checking Unit A) initiated by trainee prior to decision.
192. Log information-sharing actions (e.g., Commander relaying alert to Unit B).
193. Store snapshot blobs in PostgreSQL `JSONB` format with GIN indexing for fast querying.
194. Implement asynchronous batch flusher writing event logs to database without blocking simulation clock tick.
195. Create data sanitization validator ensuring log entries are tamper-proof and immutable once written.
196. Build database view aggregating session statistics (total messages sent, degraded, dropped, decisions made).
197. Write unit test asserting that decision snapshot strictly excludes events generated after $T_{decision}$.
198. Write stress test validating forensic logger performance under high-throughput event generation.
199. Create integrity checker computing cryptographic hashes (SHA-256) of session log streams to guarantee AAR auditability.
200. Implement retention and cleanup policies for temporary debug logs while preserving core forensic records.

---

### Phase 11: After Action Review (AAR) Dual-Timeline & Scoring Engine (Fragments 201–220)
201. Implement `AARReconstructionEngine` fetching forensic logs and reconstructing the dual timeline.
202. Build **Dual-Timeline Visualizer**:
    - **Top Timeline**: Authoritative Ground Truth (Absolute reality, actual threats, true event times).
    - **Bottom Timeline**: Trainee Observed Reality (Degraded feeds, delayed reports, conflicting cues, blackouts).
203. Implement Interactive Timeline Scrubber allowing instructor to drag time slider $T=0 \to T_{end}$ and inspect synchronized state.
204. Build Decision Inspection View pinning the exact moment $T_{decision}$ with side-by-side view:
    - What Trainee Actually Saw vs. What Was Actually Happening.
205. Implement **Automated Decision Scoring Module**:
    - Latency Score: evaluation of decision timing against scenario urgency thresholds.
    - Verification Score: rewarded for attempting verification when presented with conflicting reports.
    - Information Sharing Score: evaluation of whether critical cues were communicated to relevant subordinates.
    - Information Utilization: assessment of whether selected supporting evidence was logically valid.
206. Implement **Decision Evaluation Matrix Categorization**:
    - **Optimal** (High Score): Good reasoning + Good outcome.
    - **Defensible** (High Score): Good reasoning + Bad outcome (used conflicting info cautiously; situation worsened externally).
    - **Critical Failure** (Low Score): Poor reasoning + Bad outcome (ignored evidence, reckless action).
    - **Lucky Guess** (Low Score): Poor reasoning + Good outcome (ignored evidence; succeeded purely by random chance).
207. Implement **Instructor Evaluation Rubric Form**:
    - Situational Awareness rating (1–5 scale).
    - Risk Management & Caution rating (1–5 scale).
    - Adaptability under Comms Blackout rating (1–5 scale).
    - Qualitative instructor feedback and teaching recommendations text block.
208. Build Composite Score Calculator combining Automated Score ($40\%$) and Instructor Rubric ($60\%$).
209. Create Trainee Self-Reflection Panel allowing trainee to review their decision rationale post-exercise.
210. Implement comparison tool comparing multiple trainees' performance on the identical scenario.
211. Build interactive charts (Radar charts for competencies, timeline scatter plot for latency) using Chart.js / Visx.
212. Create filterable event log table with search by unit, keyword, domain, or degradation status.
213. Implement replay mode animating entity movements along the dual timeline.
214. Build bookmarking tool allowing instructors to flag key teaching moments during review.
215. Create rubric templates customized for different military branches (Air Defense, Maritime Patrol, Cyber Operations).
216. Write unit tests for the 4-quadrant decision classification algorithm (Optimal, Defensible, Failure, Lucky Guess).
217. Test that a lucky guess with no supporting evidence is strictly assigned a Low Score regardless of positive outcome.
218. Test automated scoring resilience when trainee makes zero decisions (handling timeout/inactivity penalty).
219. Build REST endpoints `GET /api/sessions/{id}/aar` and `POST /api/sessions/{id}/aar/rubric`.
220. Implement permission guard ensuring trainees cannot view AAR until instructor officially releases the review.

---

### Phase 12: PDF/CSV Export, E2E Walkthrough Validation & Pilot Run (Fragments 221–235)
221. Build PDF Report Generator service using `WeasyPrint` / `Puppeteer` generating formal military AAR briefing documents.
222. Design PDF report template: Executive Summary, Trainee Scorecard, Dual-Timeline Breakdown, Decision Forensic Analysis, Instructor Comments.
223. Include high-resolution vector diagrams of the ground truth vs trainee perception at decision moments in the PDF.
224. Implement CSV Export service generating raw event logs and telemetry records for scientific data analysis.
225. Build End-to-End automated integration test simulating the blueprint timeline ($T=0 \to T=7$):
    - $T=0$: Instructor starts exercise.
    - $T=1$: Fictional sensor report generated.
    - $T=2$: Delay / EW jamming attack begins.
    - $T=3$: Unit A receives delayed report; Unit B receives conflicting report.
    - $T=4$: Commander notes conflict and transmits verification request.
    - $T=5$: Commander submits structured decision + rationale; snapshot of uncertainty logged.
    - $T=6$: EW disruption ends; comms recover.
    - $T=7$: Exercise ends; AAR engine computes defensible decision score.
226. Validate that automated scoring properly awards High Score for Defensible Decision at $T=5$.
227. Perform cross-browser compatibility testing (Chromium, Firefox, Safari) for Trainee and Instructor UIs.
228. Perform WebSocket load testing under intermittent simulated packet loss and reconnect storms.
229. Conduct UI latency audit ensuring map renders and feed additions operate at 60 FPS without UI jank.
230. Build seed command `make run-demo` spinning up the complete stack with pre-loaded demo session.
231. Conduct end-to-end user acceptance testing with mock Instructor, Commander, and Subordinate roles.
232. Create comprehensive Instructor User Manual detailing scenario customization, dynamic injection, and AAR debriefing.
233. Create Trainee Briefing Sheet explaining the rules of engagement, uncertainty principles, and rationale submission.
234. Perform security audit checking SQL injection, WebSocket origin validation, and XSS vulnerabilities in rationale inputs.
235. Tag Release `v0.1.0-prototype` with complete source code, documentation, and verification test suite.

---

### Summary Verification & Next Steps
- **Total Fragments**: Exactly **235 micro-deliverables** organized into 12 structured development phases.
- **Scope Alignment**: Fully complies with SIH26248 V1 specifications (FastAPI + React/TS + PostgreSQL + WebSockets; deterministic software-defined EW; excludes physical hardware and non-deterministic LLM generation).
- **Execution Ready**: All dependencies, database schemas, engine loops, UI components, and testing milestones are sequenced for direct, sprint-by-sprint execution.
