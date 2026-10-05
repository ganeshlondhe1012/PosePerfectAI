from __future__ import annotations

from dataclasses import dataclass, field
from math import atan2, degrees

from .landmarks import (
    LEFT_ANKLE, LEFT_ELBOW, LEFT_HIP, LEFT_KNEE, LEFT_SHOULDER, LEFT_WRIST,
    NOSE, RIGHT_ANKLE, RIGHT_ELBOW, RIGHT_HIP, RIGHT_KNEE, RIGHT_SHOULDER, RIGHT_WRIST,
    Point, angle, dist, max_threshold, midpoint,
    min_threshold, point_to_segment_distance, range_score,
)

POSE_ALIASES = {
    "tree": "tree", "tree_pose": "tree", "TREE": "tree", "TREE_POSE": "tree",
    "mountain": "mountain", "mountain_pose": "mountain", "MOUNTAIN": "mountain", "MOUNTAIN_POSE": "mountain",
    "warrior2": "warrior2", "warrior_ii": "warrior2", "warrior_2": "warrior2", "WARRIOR2": "warrior2", "WARRIOR_II": "warrior2",
    "triangle": "triangle", "triangle_pose": "triangle", "TRIANGLE": "triangle", "TRIANGLE_POSE": "triangle",
    "cobra": "cobra", "cobra_pose": "cobra", "COBRA": "cobra", "COBRA_POSE": "cobra",
}

@dataclass
class RuleResult:
    score: float
    violations: list[tuple[str, str]] = field(default_factory=list)
    identity: float = 0.0


def _base(points: list[Point]):
    ls, rs = points[LEFT_SHOULDER], points[RIGHT_SHOULDER]
    lh, rh = points[LEFT_HIP], points[RIGHT_HIP]
    la, ra = points[LEFT_ANKLE], points[RIGHT_ANKLE]
    le, re = points[LEFT_ELBOW], points[RIGHT_ELBOW]
    lw, rw = points[LEFT_WRIST], points[RIGHT_WRIST]
    lk, rk = points[LEFT_KNEE], points[RIGHT_KNEE]
    shoulder_mid, hip_mid = midpoint(ls, rs), midpoint(lh, rh)
    shoulder_width = max(0.05, dist(ls, rs))
    torso = max(0.08, dist(shoulder_mid, hip_mid))
    left_leg = max(0.08, dist(lh, lk) + dist(lk, la))
    right_leg = max(0.08, dist(rh, rk) + dist(rk, ra))
    return locals()


def _critical_result(score: float, critical: float, violations: list[tuple[str, str]], cap: float = 66.0) -> RuleResult:
    score = max(0.0, min(100.0, score))
    critical = max(0.0, min(1.0, critical))
    # Do not overreact to small single-frame landmark jitter. Correctness is
    # separately gated by identity >= 0.72 and 1.2s temporal stability.
    if critical < 0.30:
        score = min(score, 72.0)
    elif critical < 0.55:
        score = min(score, 81.0)
    return RuleResult(score=score, violations=violations, identity=critical)


def _tree_candidate(p: list[Point], standing_left: bool) -> tuple[float, float, list[tuple[str, str]]]:
    b = _base(p)
    violations: list[tuple[str, str]] = []
    sk, rk = (b["lk"], b["rk"]) if standing_left else (b["rk"], b["lk"])
    sa, ra = (b["la"], b["ra"]) if standing_left else (b["ra"], b["la"])
    sh, rh = (b["lh"], b["rh"]) if standing_left else (b["rh"], b["lh"])
    standing_knee = angle(sh, sk, sa)
    raised_knee = angle(rh, rk, ra)
    standing_leg = b["left_leg"] if standing_left else b["right_leg"]

    straight_leg = min_threshold(standing_knee, 160, 178)
    bent_leg = range_score(raised_knee, 55, 125, 40)
    foot_line = point_to_segment_distance(ra, sh, sa) / standing_leg
    foot_near = max_threshold(foot_line, 0.30, 0.75)
    knee_open = dist(rk, rh) / b["torso"]
    knee_open_score = min_threshold(knee_open, 0.45, 0.75)
    expected_x = sh.x + (sa.x - sh.x) * max(0.0, min(1.0, (ra.y - sh.y) / max(1e-6, sa.y - sh.y)))
    lateral_foot = abs(ra.x - expected_x) / b["shoulder_width"]
    lateral_foot_score = max_threshold(lateral_foot, 0.55, 1.10)
    foot_contact = min(foot_near, lateral_foot_score)

    arm_left = angle(b["ls"], b["le"], b["lw"])
    arm_right = angle(b["rs"], b["re"], b["rw"])
    arms_straight = (min_threshold(arm_left, 150, 178) + min_threshold(arm_right, 150, 178)) / 2
    overhead_left = min_threshold((b["ls"].y - b["lw"].y) / b["torso"], 0.30, 0.62)
    overhead_right = min_threshold((b["rs"].y - b["rw"].y) / b["torso"], 0.30, 0.62)
    overhead = (overhead_left + overhead_right) / 2
    torso_upright = max_threshold(abs(b["shoulder_mid"].x - b["hip_mid"].x) / b["torso"], 0.16, 0.48)

    critical = min(straight_leg, bent_leg, foot_contact, knee_open_score, overhead, torso_upright)
    score = 100 * (
        0.22 * straight_leg + 0.17 * bent_leg + 0.20 * foot_contact +
        0.13 * knee_open_score + 0.16 * overhead + 0.07 * arms_straight +
        0.05 * torso_upright
    )
    if straight_leg < 0.65 or bent_leg < 0.58:
        violations.append(("tree_leg", "Keep one leg straight and bend the other knee outward."))
    if overhead < 0.65 or arms_straight < 0.60:
        violations.append(("tree_arms", "Raise both arms overhead and straighten the elbows."))
    if foot_contact < 0.62:
        violations.append(("tree_foot", "Place the lifted foot firmly against the inner standing leg without drifting away."))
    if knee_open_score < 0.68:
        violations.append(("tree_knee", "Open the lifted knee outward while keeping the pelvis level."))
    if torso_upright < 0.65:
        violations.append(("tree_spine", "Stack your shoulders over your hips and keep your torso upright."))
    return score, critical, violations


def evaluate_tree(p: list[Point]) -> RuleResult:
    candidates = [_tree_candidate(p, True), _tree_candidate(p, False)]
    score, critical, violations = max(candidates, key=lambda x: (x[1], x[0]))
    return _critical_result(score, critical, violations)


def evaluate_mountain(p: list[Point]) -> RuleResult:
    b = _base(p); violations: list[tuple[str, str]] = []
    left_knee = min_threshold(angle(b["lh"], b["lk"], b["la"]), 162, 178)
    right_knee = min_threshold(angle(b["rh"], b["rk"], b["ra"]), 162, 178)
    legs = min(left_knee, right_knee)
    feet = max_threshold(dist(b["la"], b["ra"]) / b["shoulder_width"], 1.45, 2.40)
    arm_left_down = min_threshold((b["lw"].y - b["ls"].y) / b["torso"], 0.35, 0.72)
    arm_right_down = min_threshold((b["rw"].y - b["rs"].y) / b["torso"], 0.35, 0.72)
    arms_down = min(arm_left_down, arm_right_down)
    side_left = max_threshold(abs(b["lw"].x - b["lh"].x) / b["shoulder_width"], 0.70, 1.35)
    side_right = max_threshold(abs(b["rw"].x - b["rh"].x) / b["shoulder_width"], 0.70, 1.35)
    arms_by_side = min(side_left, side_right)
    upright = max_threshold(abs(b["shoulder_mid"].x - b["hip_mid"].x) / b["torso"], 0.14, 0.44)
    head = max_threshold(abs(p[NOSE].x - b["hip_mid"].x) / b["torso"], 0.15, 0.42)
    critical = min(legs, feet, arms_down, arms_by_side, upright, head)
    score = 100 * (0.28 * legs + 0.16 * feet + 0.22 * arms_down + 0.14 * arms_by_side + 0.14 * upright + 0.06 * head)
    if legs < 0.70: violations.append(("legs", "Keep both legs straight and grounded."))
    if feet < 0.60: violations.append(("feet", "Bring your feet closer together under your hips."))
    if arms_down < 0.65: violations.append(("arms", "Relax both arms down beside your body."))
    if upright < 0.65: violations.append(("spine", "Stack your shoulders over your hips and stand tall."))
    if head < 0.65: violations.append(("neck", "Keep your head centered over your spine."))
    return _critical_result(score, critical, violations)


def _warrior_candidate(p: list[Point], front_left: bool) -> RuleResult:
    b = _base(p); v: list[tuple[str, str]] = []
    fk, bk = (b["lk"], b["rk"]) if front_left else (b["rk"], b["lk"])
    fh, bh = (b["lh"], b["rh"]) if front_left else (b["rh"], b["lh"])
    fa, ba = (b["la"], b["ra"]) if front_left else (b["ra"], b["la"])
    front_angle = angle(fh, fk, fa); back_angle = angle(bh, bk, ba)
    stance_ratio = dist(b["la"], b["ra"]) / b["shoulder_width"]
    stance = min_threshold(stance_ratio, 1.90, 2.40)
    bent = range_score(front_angle, 80, 118, 32)
    straight = min_threshold(back_angle, 158, 178)
    knee_stack = max_threshold(abs(fk.x - fa.x) / b["shoulder_width"], 0.70, 1.25)
    arm_l = angle(b["ls"], b["le"], b["lw"]); arm_r = angle(b["rs"], b["re"], b["rw"])
    arms = min(min_threshold(arm_l, 150, 178), min_threshold(arm_r, 150, 178))
    arm_level = max_threshold(abs(b["lw"].y - b["rw"].y) / b["torso"], 0.18, 0.52)
    upright = max_threshold(abs(b["shoulder_mid"].x - b["hip_mid"].x) / b["torso"], 0.18, 0.50)
    critical = min(stance, bent, straight, knee_stack, arms, arm_level, upright)
    score = 100*(0.20*stance + 0.19*bent + 0.17*straight + 0.10*knee_stack + 0.17*arms + 0.09*arm_level + 0.08*upright)
    if stance < .62: v.append(("stance", "Widen your stance so your feet are comfortably apart."))
    if bent < .75: v.append(("front_knee", "Bend the front knee until it is close to a right angle."))
    if straight < .68: v.append(("back_leg", "Straighten the back leg and press the outer foot down."))
    if arms < .68 or arm_level < .68: v.append(("arms", "Extend both arms straight and keep them level."))
    if knee_stack < .60: v.append(("knee_alignment", "Keep the front knee tracking over the front ankle."))
    if upright < .65: v.append(("spine", "Keep your torso upright over your hips."))
    return _critical_result(score, critical, v)


def evaluate_warrior2(p: list[Point]) -> RuleResult:
    return max((_warrior_candidate(p, True), _warrior_candidate(p, False)), key=lambda r: (r.identity, r.score))


def _line_angle_from_horizontal(a: Point, b: Point) -> float:
    value = abs(degrees(atan2(b.y - a.y, b.x - a.x)))
    return 180.0 - value if value > 90.0 else value


def _triangle_candidate(p: list[Point], down_left: bool) -> RuleResult:
    b = _base(p); v: list[tuple[str, str]] = []
    lower_w, upper_w = (b["lw"], b["rw"]) if down_left else (b["rw"], b["lw"])
    lower_s, upper_s = (b["ls"], b["rs"]) if down_left else (b["rs"], b["ls"])
    lower_h = b["lh"] if down_left else b["rh"]
    lower_k = b["lk"] if down_left else b["rk"]
    lower_a = b["la"] if down_left else b["ra"]

    body_len = max(0.08, b["torso"])
    body_height = max(0.25, max(q.y for q in [b["lh"], b["rh"], b["lk"], b["rk"], b["la"], b["ra"]]) - min(p[NOSE].y, b["shoulder_mid"].y))
    lower_leg_len = b["left_leg"] if down_left else b["right_leg"]
    stance = min_threshold(dist(b["la"], b["ra"]) / max(0.05, b["shoulder_width"]), 1.55, 2.35)
    knees = min(
        min_threshold(angle(b["lh"], b["lk"], b["la"]), 148, 176),
        min_threshold(angle(b["rh"], b["rk"], b["ra"]), 148, 176),
    )
    arms = min(
        min_threshold(angle(b["ls"], b["le"], b["lw"]), 135, 176),
        min_threshold(angle(b["rs"], b["re"], b["rw"]), 135, 176),
    )
    lower_hand_distance = point_to_segment_distance(lower_w, lower_h, lower_a) / max(0.12, lower_leg_len)
    lower_hand = max_threshold(lower_hand_distance, 0.55, 0.95)
    lower_hand_down = min_threshold((lower_w.y - lower_s.y) / max(0.08, body_height), 0.08, 0.24)
    upper_hand_up = min_threshold((upper_s.y - upper_w.y) / max(0.08, body_height), 0.055, 0.18)
    arm_line = angle(lower_w, b["shoulder_mid"], upper_w)
    arms_aligned = max_threshold(180.0 - arm_line, 20.0, 45.0)
    torso_tilt = abs(degrees(atan2(b["shoulder_mid"].x - b["hip_mid"].x, abs(b["shoulder_mid"].y - b["hip_mid"].y))))
    side_bend = range_score(torso_tilt, 14, 50, 18)
    side_order = min_threshold(
        (lower_s.y - upper_s.y) / max(0.08, body_height),
        -0.05, 0.08
    )
    identity = min(stance, knees, arms, lower_hand, lower_hand_down, upper_hand_up, arms_aligned, side_bend, side_order)
    score = 100 * (
        0.14 * stance + 0.16 * knees + 0.08 * arms + 0.18 * lower_hand +
        0.10 * lower_hand_down + 0.14 * upper_hand_up + 0.10 * arms_aligned +
        0.07 * side_bend + 0.03 * side_order
    )
    if stance < .65: v.append(("stance", "Widen your stance and keep both feet firmly planted."))
    if knees < .70: v.append(("legs", "Straighten both legs while keeping the knees soft."))
    if lower_hand < .70 or lower_hand_down < .68: v.append(("lower_hand", "Reach the lower hand farther down the same-side leg."))
    if upper_hand_up < .68: v.append(("upper_hand", "Reach the opposite arm upward above the shoulder."))
    if arms_aligned < .70 or arms < .68: v.append(("arms", "Keep both arms long in one controlled line."))
    if side_bend < .68: v.append(("torso", "Lengthen the spine and create a clear side bend."))
    return _critical_result(score, identity, v)


def evaluate_triangle(p: list[Point]) -> RuleResult:
    return max((_triangle_candidate(p, True), _triangle_candidate(p, False)), key=lambda r: (r.identity, r.score))


def _cobra_side(p: list[Point]) -> RuleResult:
    b = _base(p); v: list[tuple[str, str]] = []
    body_len = max(0.12, b["torso"])
    axis_tilt = _line_angle_from_horizontal(b["shoulder_mid"], b["hip_mid"])
    horizontal_body = max_threshold(axis_tilt, 20, 65)
    shoulder_lift = (b["hip_mid"].y - b["shoulder_mid"].y) / body_len
    head_lift = (b["shoulder_mid"].y - p[NOSE].y) / body_len
    chest = max_threshold(shoulder_lift, 0.015, 0.10)
    head = max_threshold(head_lift, 0.045, 0.24)

    ls_vis = (p[LEFT_SHOULDER].visibility + p[LEFT_ELBOW].visibility + p[LEFT_WRIST].visibility) / 3
    rs_vis = (p[RIGHT_SHOULDER].visibility + p[RIGHT_ELBOW].visibility + p[RIGHT_WRIST].visibility) / 3
    body_visible = max(ls_vis, rs_vis) >= 0.20

    left_hand_dx = dist(b["lw"], b["ls"]) / body_len
    right_hand_dx = dist(b["rw"], b["rs"]) / body_len
    left_drop = (b["lw"].y - b["ls"].y) / body_len
    right_drop = (b["rw"].y - b["rs"].y) / body_len
    left_ok = left_hand_dx <= 1.05 and -0.30 <= left_drop <= 1.20
    right_ok = right_hand_dx <= 1.05 and -0.30 <= right_drop <= 1.20
    best_left = ls_vis >= rs_vis
    best_ok = left_ok if best_left else right_ok
    far_ok = (rs_vis < 0.20 or right_ok or right_hand_dx <= 1.80) if best_left else (ls_vis < 0.20 or left_ok or left_hand_dx <= 1.80)
    hands_ok = body_visible and best_ok and far_ok

    left_elbow = angle(b["ls"], b["le"], b["lw"])
    right_elbow = angle(b["rs"], b["re"], b["rw"])
    elbow_vals = [left_elbow, right_elbow]
    elbows_angle = sum(elbow_vals) / len(elbow_vals)
    elbows = range_score(elbows_angle, 30, 178, 48)

    knee_vals = [
        (angle(b["lh"], b["lk"], b["la"]), (p[LEFT_HIP].visibility + p[LEFT_KNEE].visibility + p[LEFT_ANKLE].visibility) / 3),
        (angle(b["rh"], b["rk"], b["ra"]), (p[RIGHT_HIP].visibility + p[RIGHT_KNEE].visibility + p[RIGHT_ANKLE].visibility) / 3),
    ]
    visible_knees = [v for v, vis in knee_vals if vis >= 0.20]
    knee_min = min(visible_knees) if visible_knees else 110.0
    knees = min_threshold(knee_min, 118, 176)

    leg_flat = 1.0 - min(1.0, (
        abs(b["lk"].y - b["lh"].y) + abs(b["rk"].y - b["rh"].y) +
        abs(b["la"].y - b["lh"].y) + abs(b["ra"].y - b["rh"].y)
    ) / max(0.08, 4 * body_len))
    hips_grounded = max_threshold(abs(b["hip_mid"].y - b["shoulder_mid"].y) / max(0.10, body_len), 0.35, 1.00)

    # In profile Cobra, hand placement is a soft quality cue. Perspective and
    # arm occlusion can make the wrist look far from the shoulder even when the
    # core Cobra geometry is correct. Never let that alone block correctness.
    visible_knee_angle = min(visible_knees) if visible_knees else 0.0
    lower_body_ok = visible_knee_angle >= 105.0 and leg_flat >= 0.50
    core_critical = min(horizontal_body, chest, head, max(0.0, min(1.0, leg_flat)), hips_grounded)
    hand_quality = 1.0 if hands_ok else 0.70
    score = 100 * (
        0.12 * horizontal_body + 0.20 * chest + 0.20 * head +
        0.06 * hand_quality + 0.07 * elbows +
        0.19 * min(1.0, visible_knee_angle / 160.0) +
        0.10 * max(0.0, min(1.0, leg_flat)) + 0.06 * hips_grounded
    )
    identity = axis_tilt <= 65 and shoulder_lift >= 0.015 and head_lift >= 0.045 and lower_body_ok and hips_grounded >= 0.60
    if not horizontal_body: v.append(("orientation", "Lower your body toward the mat and keep your spine long."))
    if chest < 0.65 or head < 0.65: v.append(("chest", "Lift your chest and head gently while keeping the pelvis grounded."))
    if knees < 0.62 or leg_flat < 0.60: v.append(("legs", "Keep both legs long and relaxed on the mat."))
    if hips_grounded < 0.60: v.append(("pelvis", "Keep the pelvis and hips heavy on the mat."))
    if not identity and not hands_ok: v.append(("hands", "Place the visible palm under or just outside the shoulder."))
    elif not identity and elbows < 0.55: v.append(("elbows", "Keep a soft elbow bend and draw the elbow gently toward your ribs."))
    if identity:
        score = max(82.0, score)
    else:
        score = min(79.0, score)
    if identity and score >= 66:
        return RuleResult(score=score, violations=[], identity=0.82)
    return RuleResult(score=score, violations=v, identity=core_critical)

def _cobra_front(p: list[Point]) -> RuleResult:
    b = _base(p); v: list[tuple[str, str]] = []
    body_height = max(0.25, max(q.y for q in [b["lh"], b["rh"], b["lk"], b["rk"], b["la"], b["ra"]]) - min(p[NOSE].y, b["shoulder_mid"].y))
    vertical_stack = max_threshold(b["torso"], 18, 50)
    chest_rise = (b["hip_mid"].y - b["shoulder_mid"].y) / max(0.10, body_height)
    head_lift = (b["shoulder_mid"].y - p[NOSE].y) / max(0.10, body_height)
    knees = min(min_threshold(angle(b["lh"], b["lk"], b["la"]), 128, 176), min_threshold(angle(b["rh"], b["rk"], b["ra"]), 128, 176))
    elbows_angle = (angle(b["ls"], b["le"], b["lw"]) + angle(b["rs"], b["re"], b["rw"])) / 2
    elbows = range_score(elbows_angle, 35, 178, 48)
    hand_x = max(abs(b["lw"].x-b["ls"].x), abs(b["rw"].x-b["rs"].x)) / max(0.08, b["shoulder_width"])
    hands = max_threshold(hand_x, 1.70, 2.30)
    wrist_gap = max(abs(b["lw"].y-b["ls"].y), abs(b["rw"].y-b["rs"].y)) / max(0.10, body_height)
    wrists_under = max_threshold(wrist_gap, -0.06, 0.18)
    elbow_offset = max(abs(b["le"].x-b["ls"].x), abs(b["re"].x-b["rs"].x)) / max(0.08, b["shoulder_width"])
    elbows_under = max_threshold(elbow_offset, 1.10, 1.35)
    legs_long = knees >= 0.72 and p[LEFT_ANKLE].y >= p[LEFT_HIP].y - b["torso"] * 0.18 and p[RIGHT_ANKLE].y >= p[RIGHT_HIP].y - b["torso"] * 0.18
    critical = min(vertical_stack, max_threshold(chest_rise, 0.02, 0.15), max_threshold(head_lift, 0.045, 0.20), knees, 1.0 if legs_long else 0.60)
    score = 100*(0.12*vertical_stack + 0.22*max_threshold(chest_rise, 0.02, 0.14) + 0.20*max_threshold(head_lift, 0.045, 0.20) + 0.08*elbows + 0.04*hands + 0.04*wrists_under + 0.04*elbows_under + 0.17*knees + 0.09*(1.0 if legs_long else 0.65))
    identity = b["torso"] <= 50 and chest_rise >= 0.02 and head_lift >= 0.045 and knees >= 0.72 and legs_long
    if not vertical_stack: v.append(("orientation", "Keep your chest centered and close to the mat."))
    if chest_rise < 0.02 or head_lift < 0.045: v.append(("chest", "Lift your chest and head gently without lifting the pelvis."))
    if not legs_long: v.append(("legs", "Extend both legs long behind you and relax the knees."))
    if not identity and (wrists_under < 0.68 or hands < 0.68): v.append(("hands", "Place your palms under or just outside your shoulders."))
    elif not identity and (elbows_under < 0.65 or elbows < 0.60): v.append(("elbows", "Keep a soft bend and keep your elbows close to your sides."))
    if identity:
        score = max(82.0, score)
    else:
        score = min(79.0, score)
    if identity and score >= 68:
        return RuleResult(score=score, violations=[], identity=0.80)
    return RuleResult(score=score, violations=v, identity=critical)

def evaluate_cobra(p: list[Point]) -> RuleResult:
    return max((_cobra_side(p), _cobra_front(p)), key=lambda r: (r.identity, r.score))

EVALUATORS = {"tree": evaluate_tree, "mountain": evaluate_mountain, "warrior2": evaluate_warrior2, "triangle": evaluate_triangle, "cobra": evaluate_cobra}


def normalize_pose_name(value: str) -> str:
    key=value.strip().lower().replace(" ", "_")
    return POSE_ALIASES.get(key, key)


def evaluate_all(points: list[Point]) -> dict[str, RuleResult]:
    return {name:evaluator(points) for name,evaluator in EVALUATORS.items()}
