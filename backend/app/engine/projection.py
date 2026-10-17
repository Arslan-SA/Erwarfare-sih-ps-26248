# backend/app/engine/projection.py
"""Asymmetric Multi-Domain Projection Engine.

Filters and projects omniscient Ground Truth into role-specific operational views
(Commander C2, Unit A Forward, Unit B Coastal Picket, and Instructor God-View).
"""

from __future__ import annotations

from typing import Any

from app.engine.ew.degradation import EWEngine
from app.schemas.simulation import (
    FeedMessageSchema,
    Role,
    TacticalEntitySchema,
)


class ProjectionEngine:
    """Computes asymmetric perspectives from ground truth state and EW conditions."""

    def __init__(self, ew_engine: EWEngine) -> None:
        self.ew_engine = ew_engine

    def project_entities_for_role(
        self,
        ground_truth_entities: list[TacticalEntitySchema],
        role: Role,
    ) -> list[TacticalEntitySchema]:
        """Project ground truth tactical entities into the view visible to `role`."""
        if role == Role.INSTRUCTOR:
            return [e.model_copy(deep=True) for e in ground_truth_entities]

        projected: list[TacticalEntitySchema] = []
        for entity in ground_truth_entities:
            # Check visibility rule
            if entity.observed_by_roles and role not in entity.observed_by_roles and role != Role.COMMANDER:
                continue

            # Apply EW degradation / sensor spoofing / coordinate drift
            degraded_entity = self.ew_engine.apply_entity_degradation(entity, role)
            projected.append(degraded_entity)

        return projected

    def project_feed_for_role(
        self,
        all_messages: list[FeedMessageSchema],
        role: Role,
    ) -> list[FeedMessageSchema]:
        """Filter messages relevant to the given role."""
        if role == Role.INSTRUCTOR:
            return all_messages

        role_feed: list[FeedMessageSchema] = []
        for msg in all_messages:
            # Deliver if message is specifically targeted to this role or global
            if msg.target_role == role or msg.target_role == Role.COMMANDER and role == Role.COMMANDER:
                role_feed.append(msg)
            elif role != Role.COMMANDER and msg.source_unit == role.value:
                # Trainees always see their own outbound/local transmissions
                role_feed.append(msg)

        return role_feed

    def calculate_uncertainty_snapshot(
        self,
        ground_truth_entities: list[TacticalEntitySchema],
        role: Role,
    ) -> dict[str, Any]:
        """Compute quantitative metrics representing information ambiguity at current time."""
        in_jamming_count = 0
        divergence_detected = False

        for entity in ground_truth_entities:
            in_j, _ = self.ew_engine.is_in_jamming_zone(entity.x, entity.y)
            if in_j:
                in_jamming_count += 1
            if entity.id == "TRK-002":
                divergence_detected = True

        return {
            "role": role.value,
            "ew_intensity_percent": self.ew_engine.global_ew_intensity,
            "entities_in_jamming_sector": in_jamming_count,
            "tactical_divergence_present": divergence_detected,
            "links_severed_count": len(self.ew_engine.severed_links) // 2,
            "pending_delayed_messages": len(self.ew_engine.delayed_queue),
        }
