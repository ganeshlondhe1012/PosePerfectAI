from app.pose_rules import EVALUATORS
from app.landmarks import *

def mk(d):
    p=[Point(.5,.5,0,1) for _ in range(33)]
    for i,v in d.items(): p[i]=Point(*v)
    return p

def standing_common():
    return {NOSE:(.5,.15,0,1),LEFT_SHOULDER:(.40,.30,0,1),RIGHT_SHOULDER:(.60,.30,0,1),LEFT_HIP:(.43,.55,0,1),RIGHT_HIP:(.57,.55,0,1)}

def mountain():
    d=standing_common(); d.update({LEFT_KNEE:(.43,.72,0,1),RIGHT_KNEE:(.57,.72,0,1),LEFT_ANKLE:(.43,.90,0,1),RIGHT_ANKLE:(.57,.90,0,1),LEFT_ELBOW:(.42,.43,0,1),RIGHT_ELBOW:(.58,.43,0,1),LEFT_WRIST:(.43,.57,0,1),RIGHT_WRIST:(.57,.57,0,1)}); return mk(d)

def tree():
    d=standing_common(); d.update({LEFT_KNEE:(.43,.72,0,1),LEFT_ANKLE:(.43,.90,0,1),RIGHT_KNEE:(.72,.67,0,1),RIGHT_ANKLE:(.54,.82,0,1),LEFT_ELBOW:(.41,.18,0,1),RIGHT_ELBOW:(.59,.18,0,1),LEFT_WRIST:(.40,.04,0,1),RIGHT_WRIST:(.60,.04,0,1)}); return mk(d)

def warrior2():
    d=standing_common(); d.update({LEFT_HIP:(.44,.55,0,1),RIGHT_HIP:(.56,.55,0,1),LEFT_KNEE:(.44,.68,0,1),LEFT_ANKLE:(.57,.68,0,1),RIGHT_KNEE:(.80,.71,0,1),RIGHT_ANKLE:(1.05,.89,0,1),LEFT_ELBOW:(.24,.30,0,1),LEFT_WRIST:(.04,.30,0,1),RIGHT_ELBOW:(.76,.30,0,1),RIGHT_WRIST:(.96,.30,0,1)}); return mk(d)

def triangle():
    d=standing_common(); d.update({LEFT_HIP:(.43,.54,0,1),RIGHT_HIP:(.57,.46,0,1),LEFT_KNEE:(.32,.70,0,1),RIGHT_KNEE:(.78,.63,0,1),LEFT_ANKLE:(.18,.88,0,1),RIGHT_ANKLE:(.95,.79,0,1),LEFT_SHOULDER:(.28,.30,0,1),RIGHT_SHOULDER:(.48,.22,0,1),LEFT_ELBOW:(.18,.57,0,1),LEFT_WRIST:(.08,.88,0,1),RIGHT_ELBOW:(.58,.07,0,1),RIGHT_WRIST:(.68,-.08,0,1),NOSE:(.53,.18,0,1)}); return mk(d)

def cobra():
    d={NOSE:(.28,.24,0,1),LEFT_SHOULDER:(.30,.48,0,1),RIGHT_SHOULDER:(.40,.49,0,1),LEFT_HIP:(.72,.55,0,1),RIGHT_HIP:(.82,.56,0,1),LEFT_KNEE:(.90,.57,0,1),RIGHT_KNEE:(.98,.58,0,1),LEFT_ANKLE:(1.05,.58,0,1),RIGHT_ANKLE:(1.12,.59,0,1),LEFT_ELBOW:(.27,.56,0,1),RIGHT_ELBOW:(.43,.57,0,1),LEFT_WRIST:(.23,.55,0,1),RIGHT_WRIST:(.47,.56,0,1)}; return mk(d)

poses={'mountain':mountain(),'tree':tree(),'warrior2':warrior2(),'triangle':triangle(),'cobra':cobra()}
print('BASELINE')
for n,p in poses.items():
 r=EVALUATORS[n](p); print(n,round(r.score,1),'id',round(r.identity,3), 'v',[k for k,_ in r.violations])
print('\nMATRIX')
print('actual target->',' '.join(poses))
for n,p in poses.items(): print(n, ' '.join(f'{EVALUATORS[t](p).score:5.1f}' for t in poses))
