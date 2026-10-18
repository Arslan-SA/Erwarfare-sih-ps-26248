# Instructor Operations Manual
## SIH26248: Immersive Multi-Domain Decision-Making Trainer

---

### 1. Doctrinal Philosophy & System Purpose

The **Immersive Multi-Domain Decision-Making Trainer** evaluates military trainees based on their ability to make **defensible, disciplined decisions under sensor degradation and electronic warfare (EW) uncertainty**, rather than rewarding lucky guesses based on hidden ground truth.

As an instructor, your role is not merely to observe, but to actively orchestrate friction, observe trainee cross-examinations, inject dynamic tactical contingencies, and lead structured After Action Reviews (AAR).

---

### 2. Instructor Dashboard Architecture

When navigating the tactical HUD with the role selector set to **INSTRUCTOR**, you access an omniscient command view:

1. **Omniscient Radar & C2 Grid**:
   - Renders **Authoritative Ground Truth** (exact true kinematic coordinates, classifications, and transponder signals).
   - Overlays **Trainee Fog-of-War**: Perimeters showing what Sector 4 Commander, Unit A, and Unit B can currently observe.
   - Highlights active **EW Jamming Cones** (e.g., 30° adversary electronic attack sector across the maritime strait).

2. **Simulation Clock Controls**:
   - **Play / Pause**: Freezes simulation time while maintaining WebSocket voice/telemetry links.
   - **Time Multiplier (1x, 2x, 5x, 10x)**: Accurately paces the chronological priority event queue without inducing drift.
   - **Step Forward (1s)**: Advance the simulation tick-by-tick for close-quarters micro-decision inspection.

3. **Closed-Loop Dynamic Injection Console**:
   - **Override EW Intensity (0% – 100%)**: Adjusts global packet drop probability and telemetry jitter.
   - **Sever Comms Link Toggles**: Instantly terminates or restores datalink between `COMMANDER <-> UNIT_A` or `COMMANDER <-> UNIT_B`.
   - **Contradictory Sensor Report Trigger**: Injects synthetic ambiguous or spoofed intelligence into the queue to test cognitive friction.
   - **Cyber Spoofing Injector**: Dispatches unauthorized friendly reports to test authentication discipline.

---

### 3. Scenario Timeline & Key Teaching Milestones

The baseline demonstration scenario is **"Strait of Malacca - Littoral Defense & Electronic Interdiction" (SCEN-MALACCA-001)**:

| Timestamp ($T$) | Injected Event | Trainee Perception | Tactical Teaching Objective |
| :--- | :--- | :--- | :--- |
| **$T=0$** | Exercise Start | Normal maritime patrol pictures. | Establish baseline situational awareness. |
| **$T=10$s** | Initial Intel Feed | HQ warns of adversary surface action group. | Communication flow down to Units A & B. |
| **$T=60$s** | Unit A Radar Contact | Unit A reports radar cross-section consistent with warship on `TRK-002`. | Cross-domain detection. |
| **$T=120$s** | **Adversary EW Surge (85%)** | Sector 4 datalinks jitter; packets delayed. | Operating under electronic interference. |
| **$T=130$s** | **Conflicting Feed (TRK-002)** | Unit B AIS reports `TRK-002` as civil oil tanker *M/T Ocean Grace*. | **Cognitive Friction**: Trainee faces conflicting cues. |
| **$T=140$s** | Expected Decision Moment | Commander cross-checks Unit B via verification modal, then submits `HOLD_VERIFY`. | **Disciplined Decision**: Prevents civilian fratricide. |
| **$T=180$s** | Hostile FAC closes | Fast Attack Craft `TRK-004` identified closing. | Coordinated fires execution. |
| **$T=420$s** | Scenario End | Clock terminates; AAR view unlocks. | Conduct debriefing. |

---

### 4. Step-by-Step Scenario Execution Walkthrough

#### Step 1: Booting the Session
1. Navigate to `http://localhost:5173`.
2. Select **INSTRUCTOR** from the top right role switcher dropdown.
3. Verify connection status indicator displays `CONNECTED` (green beacon).
4. Click **Start Simulation** on the Master Control Bar.

#### Step 2: Observing Trainee Cognitive Friction
1. At $T=120$s, observe the trainee's alert stream in the live telemetry monitor.
2. If the Commander attempts to issue a premature `ENGAGE` order without querying subordinates, note this in the **Instructor Notes** panel.
3. If the Commander queries Unit B for electro-optical cross-check, the platform automatically logs a **Verification Attempt (+40% Verification Rigor Score)**.

#### Step 3: Triggering Dynamic Injections
1. To escalate pressure, drag the **EW Intensity** slider to 95%.
2. Toggle **Sever Commander - Unit B Link** to observe whether Commander falls back on Unit A or adheres to the Rules of Engagement.

---

### 5. Conducting the After Action Review (AAR)

Once the trainee submits a decision (or when scenario concludes), switch to the **AAR View**:

1. **Inspect 4-Quadrant Classification**:
   - **Optimal**: Good reasoning + Good outcome (Verified contact, engaged true hostile or held fire on civil contact).
   - **Defensible**: Good reasoning + Bad outcome (Disciplined cross-check, but external situation degraded; **High Score**).
   - **Lucky Guess**: Poor reasoning + Good outcome (Fired blindly with no verification and happened to hit enemy; **Low Score**).
   - **Critical Failure**: Poor reasoning + Bad outcome (Fired without checking; committed civilian fratricide; **Low Score**).

2. **Adjust Qualitative Rubric (1–5 scale)**:
   - *Situational Awareness*: Did trainee recognize sensor conflict?
   - *Risk Management*: Did trainee calculate collateral damage / fratricide?
   - *Adaptability under Jamming*: Did trainee maintain command discipline?
   - Click **Save Instructor Evaluation** to recompute the composite score (50% Automated / 50% Rubric).

3. **Exporting Dossiers**:
   - **Formal Dossier / PDF**: Opens the printable military dossier with high-resolution vector SVG radar diagrams.
   - **Metrics CSV**: Downloads tabular evaluation scorecard.
   - **Raw Telemetry CSV**: Exports full chronological log for data analytics.

---

### 6. Troubleshooting & Instructor FAQs

- **Q: Trainee says their screen is frozen.**  
  *A:* Check if the Instructor Master Control Bar is set to **PAUSE**. When paused, trainee screens display a yellow pause banner to prevent out-of-sync actions.
- **Q: A trainee disconnected during an exercise.**  
  *A:* Sockets include an automatic 30-second grace reconnection loop. On reconnect, the state manager automatically streams missed state snapshots.
