from copy import deepcopy

from app.landmarks import *
from app.pose_rules import EVALUATORS
from .fixtures_rules import poses


def mirror_pose(points):
    swap = {
        LEFT_SHOULDER: RIGHT_SHOULDER, RIGHT_SHOULDER: LEFT_SHOULDER,
        LEFT_ELBOW: RIGHT_ELBOW, RIGHT_ELBOW: LEFT_ELBOW,
        LEFT_WRIST: RIGHT_WRIST, RIGHT_WRIST: LEFT_WRIST,
        LEFT_HIP: RIGHT_HIP, RIGHT_HIP: LEFT_HIP,
        LEFT_KNEE: RIGHT_KNEE, RIGHT_KNEE: LEFT_KNEE,
        LEFT_ANKLE: RIGHT_ANKLE, RIGHT_ANKLE: LEFT_ANKLE,
    }
    out = list(points)
    for i in range(33):
        src = swap.get(i, i)
        p = points[src]
        out[i] = Point(1.0 - p.x, p.y, p.z, p.visibility)
    return out


def moved(points, idx, dx=0.0, dy=0.0):
    out = list(points)
    p = out[idx]
    out[idx] = Point(p.x + dx, p.y + dy, p.z, p.visibility)
    return out


def test_triangle_left_and_right_variants_are_correct():
    tri = poses["triangle"]
    assert EVALUATORS["triangle"](tri).identity >= 0.80
    mirrored = mirror_pose(tri)
    result = EVALUATORS["triangle"](mirrored)
    assert result.identity >= 0.80
    assert result.score >= 80


def test_triangle_rejects_missing_side_bend_and_lower_hand():
    tri = poses["triangle"]
    upright = deepcopy(tri)
    upright[LEFT_SHOULDER] = Point(.50, .30, 0, 1)
    upright[RIGHT_SHOULDER] = Point(.70, .30, 0, 1)
    r = EVALUATORS["triangle"](upright)
    assert r.identity < 0.72 or r.score < 80

    hand_up = moved(tri, LEFT_WRIST, dy=-0.35)
    r = EVALUATORS["triangle"](hand_up)
    assert r.identity < 0.72 or r.score < 80
    assert any(k == "lower_hand" for k, _ in r.violations)


def test_triangle_rejects_narrow_stance():
    tri = deepcopy(poses["triangle"])
    tri[LEFT_ANKLE] = Point(.39, .80, 0, 1)
    tri[RIGHT_ANKLE] = Point(.61, .76, 0, 1)
    r = EVALUATORS["triangle"](tri)
    assert r.identity < 0.72 or r.score < 80
    assert any(k == "stance" for k, _ in r.violations)


def test_cobra_canonical_and_common_faults():
    cobra = poses["cobra"]
    good = EVALUATORS["cobra"](cobra)
    assert good.identity >= 0.80
    assert good.score >= 80

    flat = deepcopy(cobra)
    flat[NOSE] = Point(.34, .53, 0, 1)
    flat[LEFT_SHOULDER] = Point(.30, .50, 0, 1)
    flat[RIGHT_SHOULDER] = Point(.40, .51, 0, 1)
    r = EVALUATORS["cobra"](flat)
    assert r.identity < 0.72 or r.score < 80
    assert any(k == "chest" for k, _ in r.violations)

    hands_far = deepcopy(cobra)
    hands_far[LEFT_WRIST] = Point(.02, .20, 0, 1)
    hands_far[RIGHT_WRIST] = Point(.90, .20, 0, 1)
    r = EVALUATORS["cobra"](hands_far)
    # Profile webcam perspective can distort/occlude wrist placement; hand
    # placement is now a soft coaching metric and must not block Cobra.
    assert r.identity >= 0.80
    assert r.score >= 80

    bent = deepcopy(cobra)
    bent[LEFT_KNEE] = Point(.82, .40, 0, 1)
    r = EVALUATORS["cobra"](bent)
    assert r.identity < 0.72 or r.score < 80
    assert any(k == "legs" for k, _ in r.violations)


def test_cobra_allows_natural_variation_and_still_goes_good():
    cobra = deepcopy(poses["cobra"])
    # Slightly less textbook: hands a bit farther forward, softer elbows,
    # and a smaller chest lift. This should remain a valid, coachable Cobra.
    cobra[LEFT_WRIST] = Point(.18, .58, 0, 1)
    cobra[RIGHT_WRIST] = Point(.52, .58, 0, 1)
    cobra[LEFT_ELBOW] = Point(.25, .60, 0, 1)
    cobra[RIGHT_ELBOW] = Point(.45, .61, 0, 1)
    cobra[NOSE] = Point(.30, .29, 0, 1)
    result = EVALUATORS["cobra"](cobra)
    assert result.identity >= 0.80
    assert result.score >= 78
