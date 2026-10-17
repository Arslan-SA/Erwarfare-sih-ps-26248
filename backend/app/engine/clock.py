# backend/app/engine/clock.py
"""Priority-queue driven simulation clock with variable speed and pause/step controls."""

from __future__ import annotations

import asyncio
import heapq
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(order=True)
class ScheduledEvent:
    sim_time: int
    priority: int = 10
    event_id: str = field(compare=False, default="")
    event_type: str = field(compare=False, default="")
    payload: dict[str, Any] = field(compare=False, default_factory=dict)


class SimulationClock:
    """Manages the simulation timeline, dispatching events at the appropriate tick."""

    def __init__(
        self,
        duration_seconds: int = 420,
        time_multiplier: float = 1.0,
        tick_interval_ms: int = 1000,
    ) -> None:
        self.duration_seconds = duration_seconds
        self.time_multiplier = time_multiplier
        self.tick_interval_ms = tick_interval_ms

        self.current_sim_time: int = 0
        self.is_running: bool = False
        self._task: Optional[asyncio.Task] = None
        self._event_queue: list[ScheduledEvent] = []
        self._callbacks: list[Callable[[int], Coroutine[Any, Any, None]]] = []
        self._event_handlers: list[Callable[[ScheduledEvent], Coroutine[Any, Any, None]]] = []
        self._state_lock = asyncio.Lock()

    def schedule_event(
        self,
        sim_time: int,
        event_type: str,
        payload: dict[str, Any],
        priority: int = 10,
        event_id: str = "",
    ) -> None:
        """Add an event to the min-heap priority queue."""
        event = ScheduledEvent(
            sim_time=sim_time,
            priority=priority,
            event_id=event_id,
            event_type=event_type,
            payload=payload,
        )
        heapq.heappush(self._event_queue, event)

    def register_tick_callback(
        self, callback: Callable[[int], Coroutine[Any, Any, None]]
    ) -> None:
        """Register a coroutine callback executed on every second tick."""
        self._callbacks.append(callback)

    def register_event_handler(
        self, handler: Callable[[ScheduledEvent], Coroutine[Any, Any, None]]
    ) -> None:
        """Register an event dispatcher coroutine."""
        self._event_handlers.append(handler)

    async def start(self) -> None:
        """Start or resume the clock loop."""
        async with self._state_lock:
            if self.is_running:
                return
            self.is_running = True
            if self._task is None or self._task.done():
                self._task = asyncio.create_task(self._run_loop())
            logger.info("Simulation clock started", sim_time=self.current_sim_time, multiplier=self.time_multiplier)

    async def pause(self) -> None:
        """Pause the clock."""
        async with self._state_lock:
            self.is_running = False
            logger.info("Simulation clock paused", sim_time=self.current_sim_time)

    async def resume(self) -> None:
        """Resume running."""
        await self.start()

    async def step(self, seconds: int = 1) -> None:
        """Advance the simulation by fixed seconds while paused."""
        async with self._state_lock:
            target = min(self.current_sim_time + seconds, self.duration_seconds)
            while self.current_sim_time < target:
                self.current_sim_time += 1
                await self._process_tick(self.current_sim_time)
            logger.info("Simulation clock stepped", new_sim_time=self.current_sim_time)

    async def reset(self) -> None:
        """Reset the simulation clock to 0 and halt."""
        async with self._state_lock:
            self.is_running = False
            if self._task and not self._task.done():
                self._task.cancel()
            self.current_sim_time = 0
            self._event_queue.clear()
            logger.info("Simulation clock reset")

    def set_multiplier(self, multiplier: float) -> None:
        """Adjust playback speed multiplier (e.g., 0.5x, 1x, 2x, 4x)."""
        if multiplier > 0:
            self.time_multiplier = multiplier
            logger.info("Clock multiplier updated", multiplier=multiplier)

    async def _run_loop(self) -> None:
        """Internal asynchronous ticking loop."""
        try:
            while self.is_running and self.current_sim_time < self.duration_seconds:
                sleep_duration = (self.tick_interval_ms / 1000.0) / self.time_multiplier
                await asyncio.sleep(sleep_duration)

                if not self.is_running:
                    break

                self.current_sim_time += 1
                await self._process_tick(self.current_sim_time)

            if self.current_sim_time >= self.duration_seconds:
                self.is_running = False
                logger.info("Simulation reached maximum duration", duration=self.duration_seconds)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Error in simulation clock loop", exc_info=e)
            self.is_running = False

    async def _process_tick(self, current_time: int) -> None:
        """Drain events scheduled up to the current sim timestamp and execute tick listeners."""
        # Drain scheduled events due at or before current_time
        while self._event_queue and self._event_queue[0].sim_time <= current_time:
            event = heapq.heappop(self._event_queue)
            for handler in self._event_handlers:
                try:
                    await handler(event)
                except Exception as err:
                    logger.error("Error dispatching scheduled event", event_id=event.event_id, error=str(err))

        # Invoke generic per-tick callbacks (state updates, motion, projections)
        for cb in self._callbacks:
            try:
                await cb(current_time)
            except Exception as err:
                logger.error("Error executing tick callback", sim_time=current_time, error=str(err))
