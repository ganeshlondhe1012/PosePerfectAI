from __future__ import annotations

from dataclasses import dataclass
from math import atan2, degrees, hypot, sqrt
from typing import Iterable

NOSE = 0
LEFT_EYE_INNER = 1
LEFT_EYE = 2
LEFT_EYE_OUTER = 3
RIGHT_EYE_INNER = 4
RIGHT_EYE = 5
RIGHT_EYE_OUTER = 6
LEFT_EAR = 7
RIGHT_EAR = 8
MOUTH_LEFT = 9
MOUTH_RIGHT = 10
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_ELBOW = 13
RIGHT_ELBOW = 14
LEFT_WRIST = 15
RIGHT_WRIST = 16
LEFT_PINKY = 17
RIGHT_PINKY = 18
LEFT_INDEX = 19
RIGHT_INDEX = 20
LEFT_THUMB = 21
RIGHT_THUMB = 22
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26
LEFT_ANKLE = 27
RIGHT_ANKLE = 28
LEFT_HEEL = 29
RIGHT_HEEL = 30
LEFT_FOOT_INDEX = 31
RIGHT_FOOT_INDEX = 32

POSE_CONNECTIONS = [
    (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21),
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22),
    (11, 23), (12, 24), (23, 24),
    (23, 25), (25, 27), (27, 29), (27, 31),
    (24, 26), (26, 28), (28, 30), (28, 32),
    (0, 11), (0, 12), (0, 7), (0, 8),
    (7, 11), (8, 12),
]

@dataclass(frozen=True)
class Point:
    x: float
    y: float
    z: float = 0.0
    visibility: float = 1.0

    def __iter__(self):
        yield self.x
        yield self.y
        yield self.z
        yield self.visibility


def dist(a: Point, b: Point) -> float:
    return hypot(a.x - b.x, a.y - b.y)


def midpoint(a: Point, b: Point) -> Point:
    return Point((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, min(a.visibility, b.visibility))


def angle(a: Point, b: Point, c: Point) -> float:
    bax, bay = a.x - b.x, a.y - b.y
    bcx, bcy = c.x - b.x, c.y - b.y
    mag1 = sqrt(bax * bax + bay * bay)
    mag2 = sqrt(bcx * bcx + bcy * bcy)
    if mag1 < 1e-6 or mag2 < 1e-6:
        return 180.0
    value = max(-1.0, min(1.0, (bax * bcx + bay * bcy) / (mag1 * mag2)))
    return degrees(__import__('math').acos(value))


def point_to_segment_distance(p: Point, a: Point, b: Point) -> float:
    vx, vy = b.x - a.x, b.y - a.y
    wx, wy = p.x - a.x, p.y - a.y
    denom = vx * vx + vy * vy
    if denom < 1e-8:
        return dist(p, a)
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / denom))
    proj = Point(a.x + t * vx, a.y + t * vy)
    return dist(p, proj)


def range_score(value: float, low: float, high: float, margin: float | None = None) -> float:
    if low <= value <= high:
        return 1.0
    margin = margin if margin is not None else max(5.0, (high - low) * 0.5)
    if value < low:
        return max(0.0, 1.0 - (low - value) / margin)
    return max(0.0, 1.0 - (value - high) / margin)


def min_threshold(value: float, threshold: float, full: float | None = None) -> float:
    full = full if full is not None else threshold + 20.0
    return max(0.0, min(1.0, (value - threshold) / max(1e-6, full - threshold)))


def max_threshold(value: float, threshold: float, zero_at: float | None = None) -> float:
    zero_at = zero_at if zero_at is not None else threshold * 2
    if value <= threshold:
        return 1.0
    return max(0.0, min(1.0, 1.0 - (value - threshold) / max(1e-6, zero_at - threshold)))


def avg_visibility(points: Iterable[Point]) -> float:
    values = [p.visibility for p in points]
    return sum(values) / len(values) if values else 0.0


def as_dict(points: list[Point]) -> list[dict]:
    return [
        {"x": round(p.x, 5), "y": round(p.y, 5), "z": round(p.z, 5), "visibility": round(p.visibility, 4)}
        for p in points
    ]
