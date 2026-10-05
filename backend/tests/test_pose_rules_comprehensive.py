import sys, random, math
from app.pose_rules import EVALUATORS, normalize_pose_name, evaluate_all
from app.landmarks import *
from .fixtures_rules import poses


def test_comprehensive_pose_rules():

    PASS=FAIL=0

    def check(cond,msg):
        nonlocal PASS,FAIL
        if cond: PASS+=1
        else: FAIL+=1; print('FAIL:',msg)

    def mutate(p, **changes):
        q=list(p)
        for idx,delta in changes.items():
            idx=globals()[idx] if isinstance(idx,str) else idx
            o=q[idx]; q[idx]=Point(o.x+delta[0],o.y+delta[1],o.z,o.visibility)
        return q

    # 1 aliases
    aliases={'tree':'tree','TREE':'tree','tree pose':'tree','TREE_POSE':'tree','warrior ii':'warrior2','warrior_2':'warrior2','cobra pose':'cobra','mountain_pose':'mountain','triangle_pose':'triangle'}
    for inp,exp in aliases.items(): check(normalize_pose_name(inp)==exp, f'alias {inp}->{normalize_pose_name(inp)} expected {exp}')
    check(normalize_pose_name('unknown_pose')=='unknown_pose','unknown alias preservation')

    # 2 exact canonical quality
    thresholds={'mountain':90,'tree':85,'warrior2':85,'triangle':80,'cobra':85}
    for name,p in poses.items():
        r=EVALUATORS[name](p)
        check(r.score>=thresholds[name],f'{name} canonical score {r.score:.1f} < {thresholds[name]}')
        check(r.identity>=0.72,f'{name} canonical identity {r.identity:.3f} < .72')
        check(not r.violations,f'{name} canonical emitted violations {r.violations}')

    # 3 cross-pose separation: target should score materially below canonical on other synthetic poses
    for actual,p in poses.items():
        own=EVALUATORS[actual](p).score
        for target in poses:
            if target==actual: continue
            other=EVALUATORS[target](p).score
            check(other <= own-12, f'{target} on {actual} is too high: {other:.1f} vs own {own:.1f}')

    # 4 targeted faults
    faults=[
     ('tree_arms','tree',mutate(poses['tree'],LEFT_WRIST=(0,.42),RIGHT_WRIST=(0,.42)), 'tree_arms'),
     ('tree_foot','tree',mutate(poses['tree'],RIGHT_ANKLE=(.36,.82)), 'tree_foot'),
     ('tree_knee','tree',mutate(poses['tree'],RIGHT_KNEE=(-.25,0)), 'tree_knee'),
     ('tree_spine','tree',mutate(poses['tree'],LEFT_SHOULDER=(.18,0),RIGHT_SHOULDER=(.18,0)), 'tree_spine'),
     ('mountain_knee','mountain',mutate(poses['mountain'],LEFT_KNEE=(.08,-.10)), 'legs'),
     ('mountain_arms','mountain',mutate(poses['mountain'],LEFT_WRIST=(0,-.35),RIGHT_WRIST=(0,-.35)), 'arms'),
     ('mountain_feet','mountain',mutate(poses['mountain'],RIGHT_ANKLE=(.32,0)), 'feet'),
     ('mountain_spine','mountain',mutate(poses['mountain'],LEFT_SHOULDER=(.30,0),RIGHT_SHOULDER=(.50,0)), 'spine'),
     ('warrior_stance','warrior2',mutate(poses['warrior2'],RIGHT_ANKLE=(-.30,0)), 'stance'),
     ('warrior_front_knee','warrior2',mutate(poses['warrior2'],LEFT_KNEE=(.10,0)), 'front_knee'),
     ('warrior_back_knee','warrior2',mutate(poses['warrior2'],RIGHT_KNEE=(0,-.18)), 'back_leg'),
     ('warrior_arms','warrior2',mutate(poses['warrior2'],LEFT_WRIST=(0,.20)), 'arms'),
     ('triangle_stance','triangle',mutate(poses['triangle'],RIGHT_ANKLE=(-.35,0)), 'stance'),
     ('triangle_knee','triangle',mutate(poses['triangle'],LEFT_KNEE=(.12,-.12)), 'legs'),
     ('triangle_lower_hand','triangle',mutate(poses['triangle'],LEFT_WRIST=(.35,-.40)), 'arms'),
     ('triangle_upper_hand','triangle',mutate(poses['triangle'],RIGHT_WRIST=(0,.35)), 'upper_hand'),
     ('cobra_chest','cobra',mutate(poses['cobra'],NOSE=(0,.25),LEFT_SHOULDER=(0,.18),RIGHT_SHOULDER=(0,.18)), 'chest'),
     ('cobra_hands','cobra',mutate(poses['cobra'],LEFT_WRIST=(-.30,0),RIGHT_WRIST=(.30,0)), 'hands'),
     ('cobra_legs','cobra',mutate(poses['cobra'],LEFT_KNEE=(0,-.20),RIGHT_KNEE=(0,-.20)), 'legs'),
    ]
    for label,target,p,key in faults:
        r=EVALUATORS[target](p)
        check(key in [k for k,_ in r.violations], f'{label}: missing violation {key}; score={r.score:.1f}, got={[k for k,_ in r.violations]}')
        check(r.identity<0.72 or r.score<80, f'{label}: still looks correct score={r.score:.1f}, id={r.identity:.3f}')

    # 5 random perturbation robustness: small noise should retain some quality; large noise should not be stable.
    random.seed(42)
    for name,p in poses.items():
        for sigma, min_score in [(0.006,70),(0.015,55)]:
            for trial in range(50):
                q=[]
                for pt in p:
                    q.append(Point(pt.x+random.gauss(0,sigma),pt.y+random.gauss(0,sigma),pt.z,pt.visibility))
                r=EVALUATORS[name](q)
                check(r.score>=min_score, f'{name} noise sigma={sigma} trial={trial} score={r.score:.1f} < {min_score}')
        low=0
        for trial in range(50):
            q=[Point(pt.x+random.gauss(0,.07),pt.y+random.gauss(0,.07),pt.z,pt.visibility) for pt in p]
            if EVALUATORS[name](q).identity<0.72 or EVALUATORS[name](q).score<80: low+=1
        check(low>=35, f'{name} high-noise false-stable rate too high: {low}/50 rejected')

