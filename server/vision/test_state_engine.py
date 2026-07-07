"""
Quick logic test for state_engine.py using mocked RawSignals and a fake
clock, so we can verify debounce/cooldown/priority behavior without needing
a real webcam or YOLO/MediaPipe installed.
"""
import importlib
import state_engine
from state_engine import StateEngine
from vision_engine import RawSignals


class FakeClock:
    def __init__(self, start=1000.0):
        self.t = start

    def time(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


def make_signal(person_count=1, phone=False, brightness=120.0, face=True, ear=0.30, mar=0.2):
    return RawSignals(
        person_count=person_count,
        phone_detected=phone,
        brightness=brightness,
        face_found=face,
        ear=ear,
        mar=mar,
    )


def run_test():
    clock = FakeClock()
    importlib.reload(state_engine)
    state_engine.time.time = clock.time

    engine = StateEngine(use_llm=False)

    results = []

    # 1) Normal focused frame -> should be FOCUSED, no comment
    r = engine.decide(make_signal())
    results.append(("t=0 focused frame", r["detection"]))
    assert r["detection"] == "FOCUSED"

    # 2) Phone appears, but only briefly (1s) -> should NOT fire yet (needs 2.5s sustained)
    clock.advance(1.0)
    r = engine.decide(make_signal(phone=True))
    results.append(("t=1 phone (1s sustained)", r["detection"]))
    assert r["detection"] == "FOCUSED", "should not fire before sustain window"

    # 3) Phone still there after another 2s (total 3s -> 2.0s since first phone frame) -> still not enough
    clock.advance(2.0)
    r = engine.decide(make_signal(phone=True))
    results.append(("t=3 phone (2.0s since started, not enough)", r["detection"]))
    assert r["detection"] == "FOCUSED"

    # 4) Another 0.6s -> now 2.6s sustained -> should fire
    clock.advance(0.6)
    r = engine.decide(make_signal(phone=True))
    results.append(("t=3.6 phone (2.6s sustained)", r["detection"]))
    assert r["detection"] == "DISTRACTED_PHONE"
    assert r["comment"] != ""

    # 5) Phone still there immediately after -> should NOT fire again (cooldown 30s)
    clock.advance(1.0)
    r = engine.decide(make_signal(phone=True))
    results.append(("t=4.6 phone still there (in cooldown)", r["detection"]))
    assert r["detection"] == "FOCUSED", "should be suppressed during cooldown"

    # 6) Two people sustained -> DISTURBED should fire (higher priority than phone)
    clock.advance(3.0)
    r = engine.decide(make_signal(person_count=2, phone=True))
    results.append(("t=7.6 two people (0s sustained)", r["detection"]))
    clock.advance(2.5)
    r = engine.decide(make_signal(person_count=2, phone=True))
    results.append(("t=10.1 two people sustained", r["detection"]))
    assert r["detection"] == "DISTURBED", "DISTURBED should win priority over phone"

    # 7) Dark frame / absent -> highest priority
    clock.advance(5.0)
    r = engine.decide(make_signal(person_count=0, brightness=10.0))
    results.append(("absent, 0s sustained", r["detection"]))
    clock.advance(4.5)
    r = engine.decide(make_signal(person_count=0, brightness=10.0))
    results.append(("absent, sustained", r["detection"]))
    assert r["detection"] == "ABSENT"

    # 8) Sleepy via low EAR sustained
    clock.advance(70)  # clear cooldowns
    r = engine.decide(make_signal(ear=0.10))
    clock.advance(3.5)
    r = engine.decide(make_signal(ear=0.10))
    results.append(("sleepy eyes sustained", r["detection"]))
    assert r["detection"] == "SLEEPY"

    # 9) Sleepy via yawn (high MAR) sustained, after cooldown clears.
    clock.advance(50)
    r = engine.decide(make_signal())
    assert r["detection"] == "FOCUSED"
    r = engine.decide(make_signal(mar=0.8))
    clock.advance(3.5)
    r = engine.decide(make_signal(mar=0.8))
    results.append(("yawn sustained", r["detection"]))
    assert r["detection"] == "SLEEPY"

    # 10) Long focus streak -> motivation should eventually fire.
    r = engine.decide(make_signal())
    assert r["detection"] == "FOCUSED"
    clock.advance(700)  # > MOTIVATION_MIN_FOCUS_STREAK (600s) of clean focus
    r = engine.decide(make_signal())
    results.append(("long focus streak", r["detection"]))
    assert r["detection"] == "MOTIVATION"
    assert r["comment"] != ""

    for label, detection in results:
        print(f"{label:40s} -> {detection}")

    print("\nALL ASSERTIONS PASSED")


if __name__ == "__main__":
    run_test()
