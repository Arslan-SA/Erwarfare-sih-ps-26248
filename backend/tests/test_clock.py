# backend/tests/test_clock.py
"""Unit tests for the priority-queue simulation clock."""

import asyncio
import pytest

from app.engine.clock import ScheduledEvent, SimulationClock


@pytest.mark.asyncio
async def test_clock_priority_queue_ordering() -> None:
    clock = SimulationClock(duration_seconds=10, tick_interval_ms=50)
    dispatched_events: list[str] = []

    async def event_handler(event: ScheduledEvent) -> None:
        dispatched_events.append(event.event_id)

    clock.register_event_handler(event_handler)

    # Schedule out of order
    clock.schedule_event(sim_time=5, event_type="TEST", payload={}, event_id="EVT_5")
    clock.schedule_event(sim_time=2, event_type="TEST", payload={}, event_id="EVT_2")
    clock.schedule_event(sim_time=8, event_type="TEST", payload={}, event_id="EVT_8")

    # Step clock to 6
    await clock.step(6)

    assert clock.current_sim_time == 6
    assert dispatched_events == ["EVT_2", "EVT_5"]

    # Step clock to 10
    await clock.step(4)
    assert clock.current_sim_time == 10
    assert dispatched_events == ["EVT_2", "EVT_5", "EVT_8"]


@pytest.mark.asyncio
async def test_clock_pause_and_resume() -> None:
    clock = SimulationClock(duration_seconds=5, tick_interval_ms=10)
    await clock.start()
    assert clock.is_running is True

    await clock.pause()
    assert clock.is_running is False

    await clock.reset()
    assert clock.current_sim_time == 0
