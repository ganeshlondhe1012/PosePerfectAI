from app.landmarks import Point
from app.pose_rules import evaluate_all

# Synthetic sanity-check only. These tests verify scoring code is importable and finite.
def human_points():
    p=[Point(0.5,0.2,visibility=1)]*33
    p[11]=Point(.42,.35); p[12]=Point(.58,.35)
    p[23]=Point(.44,.58); p[24]=Point(.56,.58)
    p[13]=Point(.38,.46); p[14]=Point(.62,.46)
    p[15]=Point(.35,.58); p[16]=Point(.65,.58)
    p[25]=Point(.44,.76); p[26]=Point(.56,.76)
    p[27]=Point(.44,.94); p[28]=Point(.56,.94)
    p[0]=Point(.5,.17)
    return p

def test_all_pose_rules_return_finite_scores():
    values=evaluate_all(human_points())
    assert set(values)=={"tree","mountain","warrior2","triangle","cobra"}
    for result in values.values():
        assert 0 <= result.score <= 100
        assert 0 <= result.identity <= 1
