# backend/tests/test_ew.py
"""Unit tests for Electronic Warfare (EW) degradation and jamming engine."""

from app.engine.ew.degradation import EWEngine
from app.schemas.simulation import (
    DegradationType,
    EntityDomain,
    FeedMessageSchema,
    Role,
    TacticalEntitySchema,
    TargetClassification,
)


def test_link_severing() -> None:
    ew = EWEngine()
    assert not ew.is_link_severed("COMMANDER", "UNIT_B")

    ew.sever_link("COMMANDER", "UNIT_B")
    assert ew.is_link_severed("COMMANDER", "UNIT_B")
    assert ew.is_link_severed("UNIT_B", "COMMANDER")

    msg = FeedMessageSchema(
        id="M1",
        sim_timestamp=10,
        source_unit="UNIT_B",
        target_role=Role.COMMANDER,
        domain=EntityDomain.SEA,
        title="Test",
        content="Submarine contact",
    )
    result = ew.process_outbound_message(msg, current_sim_time=10)
    assert result is None  # Dropped because link is severed

    ew.restore_link("COMMANDER", "UNIT_B")
    assert not ew.is_link_severed("COMMANDER", "UNIT_B")


def test_delayed_buffering() -> None:
    ew = EWEngine()
    ew.set_global_intensity(50)

    msg = FeedMessageSchema(
        id="M-DELAY",
        sim_timestamp=20,
        source_unit="UNIT_A",
        target_role=Role.COMMANDER,
        domain=EntityDomain.AIR,
        title="Delayed Target",
        content="Track locked",
        degradation_type=DegradationType.DELAYED,
    )

    immediate = ew.process_outbound_message(msg, current_sim_time=20)
    assert immediate is None  # Buffered
    assert len(ew.delayed_queue) == 1

    # Before delay elapses
    released = ew.drain_delayed_messages(current_sim_time=25)
    assert len(released) == 0

    # After delay elapses
    released = ew.drain_delayed_messages(current_sim_time=90)
    assert len(released) == 1
    assert released[0].id == "M-DELAY"
    assert len(ew.delayed_queue) == 0


def test_jamming_cone_spatial_detection() -> None:
    ew = EWEngine()
    # Zone center is at (65, 45) with radius 22
    in_zone, intensity = ew.is_in_jamming_zone(65.0, 45.0)
    assert in_zone is True
    assert intensity == 85

    # Far point (10, 10)
    in_zone_far, _ = ew.is_in_jamming_zone(10.0, 10.0)
    assert in_zone_far is False


def test_asymmetric_sensor_drift() -> None:
    ew = EWEngine()
    entity = TacticalEntitySchema(
        id="TRK-002",
        name="Unknown Surface",
        domain=EntityDomain.SEA,
        classification=TargetClassification.AMBIGUOUS,
        x=58.0,
        y=42.0,
        speed_knots=14.0,
    )

    # Unit A sees hostile classification
    view_a = ew.apply_entity_degradation(entity, Role.UNIT_A)
    assert view_a.classification == TargetClassification.HOSTILE

    # Unit B sees sensor drift
    view_b = ew.apply_entity_degradation(entity, Role.UNIT_B)
    assert view_b.classification == TargetClassification.AMBIGUOUS
    assert view_b.x != entity.x

    # Instructor gets exact ground truth
    view_inst = ew.apply_entity_degradation(entity, Role.INSTRUCTOR)
    assert view_inst.x == entity.x
    assert view_inst.y == entity.y
