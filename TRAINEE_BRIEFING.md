# Trainee Operational Briefing & Rules of Engagement
## SIH26248: Immersive Multi-Domain Decision-Making Trainer

---

### 1. General Situation & Rules of Engagement (ROE)

You are deployed in a contested maritime-littoral operating area under active adversary electronic warfare (EW).

Your mission is to defend friendly naval assets, protect international sea lanes, and de-conflict ambiguous surface contacts without committing civil fratricide or escalating unauthorized conflict.

> **CRITICAL DOCTRINE NOTE**:  
> In this simulator, **you are NOT graded on lucky guesses**. Engaging a contact without verification—even if it turns out to be an enemy—will result in a **Low Score (Lucky Guess)**.  
> You are evaluated on **disciplined, defensible decision-making**: cross-checking sensor discrepancies, evaluating risks, and documenting structured military rationale.

---

### 2. Operational Roles & Responsibilities

#### **COMMANDER (Command & Control HQ)**
- **Tactical Grid**: Receives aggregated, strategically filtered radar feeds.
- **Decision Authority**: Empowered to dispatch tactical actions (`ENGAGE`, `HOLD_VERIFY`, `VECTOR_SUPPORT`, `SCRAMBLE_AIR`, `JAM_SECTOR`, `EVACUATE`).
- **Cross-Check Protocol**: Must utilize the **Cross-Check Unit** feature to query Unit A or Unit B whenever conflicting reports appear.
- **Decision Submission**: Must complete the **Structured Decision Dock**, providing:
  1. *Tactical Action* (e.g. `HOLD_VERIFY`)
  2. *Confidence Rating* (0% – 100%)
  3. *Assumed Risk Statement*
  4. *Military Defense Rationale* (minimum 20 characters)
  5. *Supporting Evidence Selections* (checkboxes linking to intelligence feeds)

#### **UNIT A (Forward Air Defense & Radar Picket)**
- **Role Focus**: Operates forward radar pickets and electro-optical search sensors.
- **Telemetry**: Relays raw track signatures (RCS, bearing, speed) to Commander.
- **Reporting**: Transmits prompt field observations when queried by HQ.

#### **UNIT B (Maritime Electronic Support Measures & AIS Intercept)**
- **Role Focus**: Monitors civilian transponder frequencies (AIS), SIGINT, and ESM emissions.
- **Task**: Correlates radar contacts with civilian maritime databases to protect non-combatant vessels.

---

### 3. Understanding Sensor Degradation & Electronic Warfare

During this exercise, adversary cyber/EW units will induce sensor anomalies:
- **Delayed Feeds**: Marked with timestamp differences; packets delivered after a latency penalty.
- **Dropout / Blackout**: Radio silence or severed datalinks where transmissions are temporarily blocked.
- **Conflicting Cues**: Two reports on the same contact ID (e.g., `TRK-002`) reporting contradictory classifications (e.g., *Hostile Frigate* vs *Civilian Oil Tanker*).

**Standard Operating Procedure for Conflicting Cues**:
1. Do not rush to fire.
2. Click **Cross-Check Unit** to request subordinate cross-examination.
3. Weigh the risk: Is the contact within weapons release range ($<12$nm)? If outside immediate engagement horizon, issue `HOLD_VERIFY`.
4. Check your intelligence inbox for secondary verification confirmation before dispatching lethal fires.

---

### 4. How Your Decision Will Be Evaluated (After Action Review)

At the conclusion of the exercise, your decision moment $T_{decision}$ is frozen and scored across four forensic dimensions:

1. **Verification Rigor (40% of Automated Score)**:
   - Evaluates whether you queried subordinate stations or secondary sensors prior to ordering kinetic action.
2. **Decision Latency (35% of Automated Score)**:
   - Measures your response time against scenario urgency. Quick, unverified panic actions are penalized.
3. **Information Sharing & Evidence Referencing (25% of Automated Score)**:
   - Checks whether you cited valid intelligence reports in your submission.
4. **4-Quadrant Classification**:
   - **OPTIMAL**: Sound rationale + verified correct outcome.
   - **DEFENSIBLE**: Sound rationale + adverse outcome due to external fog of war (**High Score**).
   - **LUCKY GUESS**: Unverified / impulsive action that happened to hit an enemy (**Strictly Penalized**).
   - **CRITICAL FAILURE**: Impulsive action causing fratricide or civilian loss (**Severe Penalty**).

---

### 5. Tactical Interface Quick Reference

- **Pan / Zoom Map**: Left-click and drag on Tactical Situation Display; scroll wheel to zoom.
- **Open Cross-Check Modal**: Click `Cross-Check Unit` button in the Feed Stream.
- **Submit Decision**: Complete all fields in the bottom-right Decision Dock and click `Transmit Tactical Decision`.
- **Shortcut**: `Ctrl + Enter` / `Cmd + Enter` transmits the active decision.
