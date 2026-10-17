# backend/app/engine/ew/degradation.py
"""Electronic Warfare (EW) & Communications Degradation Engine.

Implements latency queuing, packet dropout, data spoofing/conflicting variance,
and spatial EW jamming zone calculations according to SIH-26248 blueprint.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Optional

from app.core.logging import get_logger
from app.schemas.simulation import (
    DegradationType,
    FeedMessageSchema,
    Role,
    TacticalEntitySchema,
    TargetClassification,
)

logger = get_logger(__name__)


@dataclass
class PendingDelayedMessage:
    deliver_at_sim_time: int
    message: FeedMessageSchema


@dataclass
class JammingZone:
    zone_id: str
    center_x: float  # 0 - 100
    center_y: float  # 0 - 100
    radius: float    # in normalized coordinates
    intensity: int   # 0 - 100%
    active: bool = True


class EWEngine:
    """Manages communications degradation and tactical sensor distortions."""

    def __init__(self) -> None:
        self.global_ew_intensity: int = 40
        self.severed_links: set[tuple[str, str]] = set()  # set of (source_role, target_role)
        self.delayed_queue: list[PendingDelayedMessage] = []
        self.jamming_zones: list[JammingZone] = [
            # Default Sector 4 EW jamming cone centered at (65, 45)
            JammingZone(zone_id="SECTOR_4_JAMMER", center_x=65.0, center_y=45.0, radius=22.0, intensity=85, active=True)
        ]
        self.active_degradation_type: DegradationType = DegradationType.DELAYED

    def set_global_intensity(self, intensity: int) -> None:
        """Set EW noise floor intensity (0-100%)."""
        self.global_ew_intensity = max(0, min(100, intensity))
        logger.info("EW intensity updated", intensity=self.global_ew_intensity)

    def sever_link(self, role_a: str, role_b: str) -> None:
        """Sever bidirectional or directional communications."""
        self.severed_links.add((role_a, role_b))
        self.severed_links.add((role_b, role_a))
        logger.warn("Comms link severed", link=(role_a, role_b))

    def restore_link(self, role_a: str, role_b: str) -> None:
        """Restore comms link between roles."""
        self.severed_links.discard((role_a, role_b))
        self.severed_links.discard((role_b, role_a))
        logger.info("Comms link restored", link=(role_a, role_b))

    def is_link_severed(self, source_role: str, target_role: str) -> bool:
        """Check if channel between source and target is severed."""
        return (source_role, target_role) in self.severed_links

    def is_in_jamming_zone(self, x: float, y: float) -> tuple[bool, int]:
        """Calculate if coordinate is within an active EW jamming cone."""
        for zone in self.jamming_zones:
            if not zone.active:
                continue
            distance = math.hypot(x - zone.center_x, y - zone.center_y)
            if distance <= zone.radius:
                return True, zone.intensity
        return False, 0

    def process_outbound_message(
        self,
        message: FeedMessageSchema,
        current_sim_time: int,
    ) -> Optional[FeedMessageSchema]:
        """Apply degradation filter to a message being broadcast to a role.

        Returns:
            - None if dropped due to dropout / severed link.
            - FeedMessageSchema if delivered immediately (possibly altered).
            - None if queued for delayed delivery (buffered in delayed_queue).
        """
        source = message.source_unit
        target = message.target_role.value

        # Check explicit link severing
        if self.is_link_severed(source, target):
            logger.info("Message dropped: link severed", msg_id=message.id, from_role=source, to_role=target)
            return None

        # Determine degradation rule
        rule = message.degradation_type or self.active_degradation_type

        # 1. DROPOUT / PACKET LOSS
        if rule == DegradationType.DROPOUT:
            # Chance to drop increases with EW intensity
            drop_probability = (self.global_ew_intensity / 100.0) * 0.8
            if random.random() < drop_probability:
                logger.info("Message dropped due to EW packet loss", msg_id=message.id)
                return None

        # 2. DELAYED BUFFER
        elif rule == DegradationType.DELAYED:
            delay_seconds = int(10 + (self.global_ew_intensity / 100.0) * 35)  # 10s to 45s delay
            deliver_at = current_sim_time + delay_seconds
            self.delayed_queue.append(
                PendingDelayedMessage(deliver_at_sim_time=deliver_at, message=message)
            )
            logger.info("Message delayed by EW buffer", msg_id=message.id, delay_sec=delay_seconds, deliver_at=deliver_at)
            return None

        # 3. CONFLICTING / SPOOFED
        elif rule == DegradationType.CONFLICTING:
            # Create corrupted variant to introduce tactical ambiguity
            mutated = message.model_copy(deep=True)
            if "Bearing" in mutated.content or "bearing" in mutated.content:
                mutated.content += " [ANOMALY: Secondary sweep reports divergent bearing +32°]"
            else:
                mutated.content += " [UNCONFIRMED: Radar Doppler indicates inconsistent signatures]"
            mutated.divergence_variant = f"DIVERGENT_{random.randint(100, 999)}"
            return mutated

        # 4. NORMAL
        return message

    def drain_delayed_messages(self, current_sim_time: int) -> list[FeedMessageSchema]:
        """Drain and return messages whose simulated delay has elapsed."""
        ready: list[FeedMessageSchema] = []
        remaining: list[PendingDelayedMessage] = []

        for item in self.delayed_queue:
            if item.deliver_at_sim_time <= current_sim_time:
                ready.append(item.message)
            else:
                remaining.append(item)

        self.delayed_queue = remaining
        return ready

    def apply_entity_degradation(
        self,
        entity: TacticalEntitySchema,
        observer_role: Role,
    ) -> TacticalEntitySchema:
        """Apply sensor degradation & divergence to entities based on observer role."""
        if observer_role == Role.INSTRUCTOR:
            # Instructor always gets 100% pure ground truth
            return entity

        in_jamming, zone_intensity = self.is_in_jamming_zone(entity.x, entity.y)
        effective_intensity = max(self.global_ew_intensity, zone_intensity if in_jamming else 0)

        # Clone entity
        projected = entity.model_copy(deep=True)

        # If Unit B is observing an ambiguous submarine/corvette in Sector 4, diverge
        if observer_role == Role.UNIT_B and entity.id == "TRK-002":
            # Unit B sensor drift
            projected.x = min(100, max(0, projected.x + 3.2))
            projected.y = min(100, max(0, projected.y - 2.8))
            projected.speed_knots = max(0, projected.speed_knots - 8)
            projected.classification = TargetClassification.AMBIGUOUS
            projected.divergence_note = "ESM fingerprint ambiguous; intermittent sonar echo"

        # If Unit A is observing TRK-002, reports it as HOSTILE
        elif observer_role == Role.UNIT_A and entity.id == "TRK-002":
            projected.classification = TargetClassification.HOSTILE
            projected.divergence_note = "Acoustic signature cross-matches Type 054 Frigate"

        # General positional jitter under high EW intensity
        if effective_intensity > 60:
            jitter_amount = (effective_intensity / 100.0) * 1.5
            jitter_x = (random.random() - 0.5) * jitter_amount
            jitter_y = (random.random() - 0.5) * jitter_amount
            projected.x = min(100.0, max(0.0, projected.x + jitter_x))
            projected.y = min(100.0, max(0.0, projected.y + jitter_y))

        return projected
