"""
Decision engine: debounce, cooldown, priority logic for vision signals.
Maintains the "brain" that decides what alert to fire based on RawSignals.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

from vision_engine import RawSignals

# Tunables (seconds)
SUSTAIN_WINDOW   = 2.5   # how long a condition must be continuously true before firing
COOLDOWN         = 30.0  # per-type cooldown after firing
ABSENT_WINDOW    = 1.5   # shorter sustain for absent (frame is dark → immediate)
MOTIVATION_STREAK = 600.0  # 10 min of continuous focus → motivation alert

# Priority order (higher = earlier in list)
PRIORITY = [
    "ABSENT",
    "DISTURBED",
    "DISTRACTED_PHONE",
    "SLEEPY",
    "MOTIVATION",
    "FOCUSED",
]

_COMMENTS: dict[str, str] = {
    "ABSENT":            "Naveen! Where did you go? Come back and study!",
    "DISTURBED":         "Hey! Someone else is in frame! Don't get distracted!",
    "DISTRACTED_PHONE":  "Naveen! Put the phone down and focus on your studies!",
    "SLEEPY":            "Naveen! Your eyes are closing! Get up, stretch, drink some water!",
    "MOTIVATION":        "Naveen, you've been studying great! Keep it up, I'm proud of you!",
}


@dataclass
class _Tracker:
    """Tracks the continuous-active state of a single detection type."""
    condition_start: Optional[float] = None
    last_fired: float = -1e9  # allow first fire immediately

    def reset(self) -> None:
        self.condition_start = None


class StateEngine:
    """Decides what detection state to fire based on incoming RawSignals.

    Usage:
        engine = StateEngine()
        engine.load()
        result = engine.decide(signals)  # → {"detection": ..., "comment": ...}
    """

    def __init__(self, use_llm: bool = False) -> None:
        self._use_llm = use_llm
        self._trackers: dict[str, _Tracker] = {k: _Tracker() for k in PRIORITY}
        self._focus_streak_start: Optional[float] = None
        self._last_detection: str = "FOCUSED"

    # ── helpers ────────────────────────────────────────────────────────
    @staticmethod
    def _now() -> float:
        return time.time()

    def _check(
        self,
        key: str,
        condition: bool,
        now: float,
        sustain: float = SUSTAIN_WINDOW,
    ) -> bool:
        """Return True if *key* should fire right now, and update fire bookkeeping."""
        t = self._trackers[key]
        if condition:
            if t.condition_start is None:
                t.condition_start = now
            if (now - t.condition_start) >= sustain and (now - t.last_fired) >= COOLDOWN:
                t.last_fired = now
                t.condition_start = None
                return True
            return False
        else:
            t.reset()
            return False

    # ── decide ─────────────────────────────────────────────────────────
    def decide(self, signals: RawSignals) -> dict:
        now = self._now()
        result: dict = {"detection": "FOCUSED", "comment": ""}

        # Evaluate conditions (highest priority first)
        # ── ABSENT ──────────────────────────────────────────────────────
        absent = signals.person_count == 0 or signals.brightness < 20
        if self._check("ABSENT", absent, now, ABSENT_WINDOW):
            result["detection"] = "ABSENT"
            result["comment"] = _COMMENTS["ABSENT"]
            self._focus_streak_start = None
            self._last_detection = "ABSENT"
            return result

        # ── DISTURBED ───────────────────────────────────────────────────
        disturbed = signals.person_count >= 2
        if self._check("DISTURBED", disturbed, now):
            result["detection"] = "DISTURBED"
            result["comment"] = _COMMENTS["DISTURBED"]
            self._focus_streak_start = None
            self._last_detection = "DISTURBED"
            return result

        # ── DISTRACTED_PHONE ────────────────────────────────────────────
        phone = signals.phone_detected and signals.person_count > 0
        if self._check("DISTRACTED_PHONE", phone, now):
            result["detection"] = "DISTRACTED_PHONE"
            result["comment"] = _COMMENTS["DISTRACTED_PHONE"]
            self._focus_streak_start = None
            self._last_detection = "DISTRACTED_PHONE"
            return result

        # ── SLEEPY ──────────────────────────────────────────────────────
        sleepy = (signals.face_found and signals.ear < 0.15) or signals.mar > 0.70
        if self._check("SLEEPY", sleepy, now):
            result["detection"] = "SLEEPY"
            result["comment"] = _COMMENTS["SLEEPY"]
            self._focus_streak_start = None
            self._last_detection = "SLEEPY"
            return result

        # ── MOTIVATION (long focus streak) ──────────────────────────────
        # Only fires if we've been continuously focused
        if self._focus_streak_start is None:
            self._focus_streak_start = now
        elif (now - self._focus_streak_start) >= MOTIVATION_STREAK:
            # Check cooldown
            mt = self._trackers["MOTIVATION"]
            if (now - mt.last_fired) >= COOLDOWN:
                mt.last_fired = now
                result["detection"] = "MOTIVATION"
                result["comment"] = _COMMENTS["MOTIVATION"]
                self._focus_streak_start = now  # restart streak after motivation
                self._last_detection = "MOTIVATION"
                return result

        # ── FOCUSED ─────────────────────────────────────────────────────
        result["detection"] = "FOCUSED"
        result["comment"] = ""
        self._last_detection = "FOCUSED"
        return result

    # ── utilities ──────────────────────────────────────────────────────
    def reset_cooldowns(self) -> None:
        for t in self._trackers.values():
            t.last_fired = 0.0

    def load(self) -> None:
        """Load sub-engines if needed (no-op for state engine)."""
        pass
