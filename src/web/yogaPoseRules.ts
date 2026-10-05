export type Point = { x: number; y: number; z?: number; visibility?: number };
export type PoseName = 'tree' | 'warrior2' | 'mountain' | 'triangle' | 'cobra';
export type PoseValue = { key: string; label: string; current: number; target: string; ok: boolean };
export type PoseResult = {
  pose: PoseName;
  score: number;
  good: boolean;
  identity: boolean;
  corrections: string[];
  variant?: 'left' | 'right';
  values: PoseValue[];
};

export const L = {
  nose: 0,
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
} as const;

// Major MediaPipe body connections used for the visible live skeleton. The
// earlier build only drew a small subset of landmarks, which made the overlay
// look incomplete even when tracking was good. These are kept to the stable
// body landmarks (rather than every facial point) so the overlay stays clean
// and fast.
export const CONNECTIONS: [number, number][] = [
  [0,11],[0,12],[11,12],
  [11,13],[13,15],[15,17],[15,19],[15,21],
  [12,14],[14,16],[16,18],[16,20],[16,22],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[29,31],
  [24,26],[26,28],[28,30],[30,32],
];
export const TRACKED = [0,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32];

const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const avg = (a:number,b:number) => (a+b)/2;
const clamp = (v:number,a=0,b=1) => Math.max(a,Math.min(b,v));
const near = (value:number,target:number,tolerance:number) => Math.max(0, 1 - Math.abs(value-target)/Math.max(1e-6,tolerance));

export function usablePoint(p: Point | undefined) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

export function pointConfidence(p: Point | undefined) {
  if (!p) return 0;
  return Number.isFinite(p.visibility) ? clamp(Number(p.visibility)) : 1;
}

export function angle(a: Point, b: Point, c: Point) {
  const abx=a.x-b.x, aby=a.y-b.y, cbx=c.x-b.x, cby=c.y-b.y;
  const den=Math.hypot(abx,aby)*Math.hypot(cbx,cby);
  if(!den) return 0;
  return Math.acos(clamp((abx*cbx+aby*cby)/den,-1,1))*180/Math.PI;
}

export function pointSegmentDistance(p: Point, a: Point, b: Point) {
  const vx=b.x-a.x, vy=b.y-a.y, wx=p.x-a.x, wy=p.y-a.y;
  const len=vx*vx+vy*vy;
  const t=len?Math.max(0,Math.min(1,(wx*vx+wy*vy)/len)):0;
  return Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy));
}

export function bodyMetrics(p: Point[]) {
  const ls=p[L.leftShoulder], rs=p[L.rightShoulder], lh=p[L.leftHip], rh=p[L.rightHip];
  const shouldersY=avg(ls.y,rs.y), hipsY=avg(lh.y,rh.y);
  const shoulderX=avg(ls.x,rs.x), hipX=avg(lh.x,rh.x);
  const bodyHeight=Math.max(.25, Math.max(...p.slice(23,29).map(q=>q.y)) - Math.min(p[L.nose].y,shouldersY));
  return {
    bodyHeight,
    shoulderWidth:d(ls,rs),
    hipWidth:d(lh,rh),
    ankleSpread:d(p[L.leftAnkle],p[L.rightAnkle]),
    torso:Math.abs(Math.atan2(shoulderX-hipX,Math.abs(shouldersY-hipsY))*180/Math.PI),
    shoulderTilt:Math.min(Math.abs(Math.atan2(rs.y-ls.y,rs.x-ls.x)*180/Math.PI),180-Math.abs(Math.atan2(rs.y-ls.y,rs.x-ls.x)*180/Math.PI)),
    hipTilt:Math.min(Math.abs(Math.atan2(rh.y-lh.y,rh.x-lh.x)*180/Math.PI),180-Math.abs(Math.atan2(rh.y-lh.y,rh.x-lh.x)*180/Math.PI)),
    shoulderMid:{x:shoulderX,y:shouldersY}, hipMid:{x:hipX,y:hipsY},
  };
}

export function calculateAngles(p: Point[]) {
  const m=bodyMetrics(p);
  return {
    leftKnee:angle(p[L.leftHip],p[L.leftKnee],p[L.leftAnkle]),
    rightKnee:angle(p[L.rightHip],p[L.rightKnee],p[L.rightAnkle]),
    leftElbow:angle(p[L.leftShoulder],p[L.leftElbow],p[L.leftWrist]),
    rightElbow:angle(p[L.rightShoulder],p[L.rightElbow],p[L.rightWrist]),
    torso:m.torso, shoulderTilt:m.shoulderTilt, hipTilt:m.hipTilt,
    ankleSpread:m.ankleSpread, bodyHeight:m.bodyHeight, shoulderWidth:m.shoulderWidth, hipWidth:m.hipWidth,
    leftWristAboveShoulder:p[L.leftShoulder].y-p[L.leftWrist].y,
    rightWristAboveShoulder:p[L.rightShoulder].y-p[L.rightWrist].y,
    leftWristBelowShoulder:p[L.leftWrist].y-p[L.leftShoulder].y,
    rightWristBelowShoulder:p[L.rightWrist].y-p[L.rightShoulder].y,
  };
}

function value(key:string,label:string,current:number,target:string,ok:boolean):PoseValue { return {key,label,current,target,ok}; }
// A visible green/correct state is intentionally driven by the displayed score.
// The rule engine still reports identity separately for diagnostics, but a user
// should not be shown a 90–95% match while the UI stays red merely because one
// identity gate is marginal. The product threshold is strictly >78 (79+).
export const GREEN_SCORE_THRESHOLD = 78;

function finalize(pose:PoseName,score:number,identity:boolean,corrections:string[],variant?:'left'|'right',values:PoseValue[]=[],goodThreshold=GREEN_SCORE_THRESHOLD):PoseResult {
  const s=Math.round(clamp(score/100)*100);
  return {pose,score:s,good:s>goodThreshold,identity,corrections,variant,values};
}

function tree(p:Point[]):PoseResult {
  const a=calculateAngles(p);
  const leftRaised=a.leftKnee<a.rightKnee;
  const raised=leftRaised?'left':'right', standing=leftRaised?'right':'left';
  const standingKnee=leftRaised?a.rightKnee:a.leftKnee;
  const raisedKnee=leftRaised?a.leftKnee:a.rightKnee;
  const raisedAnkle=leftRaised?p[L.leftAnkle]:p[L.rightAnkle];
  const standingAnkle=leftRaised?p[L.rightAnkle]:p[L.leftAnkle];
  const standingHip=leftRaised?p[L.rightHip]:p[L.leftHip];
  const raisedKneePt=leftRaised?p[L.leftKnee]:p[L.rightKnee];
  const standingKneePt=leftRaised?p[L.rightKnee]:p[L.leftKnee];
  const footHeight=standingAnkle.y-raisedAnkle.y;
  const footRaised=footHeight>Math.max(.025,a.bodyHeight*.035);
  const footDistance=pointSegmentDistance(raisedAnkle,standingAnkle,standingHip);
  const footNearLeg=footDistance<Math.max(.14,a.bodyHeight*.30);
  const kneeSeparation=Math.abs(raisedKneePt.x-standingKneePt.x);
  const kneeOut=kneeSeparation>Math.max(.055,a.bodyHeight*.055);
  const overhead=Math.min(a.leftWristAboveShoulder,a.rightWristAboveShoulder)>.035;
  const armsStraight=Math.min(a.leftElbow,a.rightElbow)>140;
  const standingStraight=standingKnee>145;
  const raisedBent=raisedKnee<155;
  const upright=a.torso<24&&a.hipTilt<18;
  const identity=standingStraight&&raisedBent&&footRaised&&footNearLeg&&kneeOut&&overhead&&upright;
  const quality=100*(
    near(standingKnee,175,35)*.16+
    near(raisedKnee,85,75)*.12+
    Math.min(1,Math.max(0,footHeight)/Math.max(.08,a.bodyHeight*.16))*.14+
    (footNearLeg?1:Math.max(0,1-footDistance/Math.max(.18,a.bodyHeight*.42)))*.13+
    (kneeOut?1:Math.min(1,kneeSeparation/Math.max(.11,a.bodyHeight*.12)))*.08+
    (overhead?1:Math.min(1,Math.max(0,Math.min(a.leftWristAboveShoulder,a.rightWristAboveShoulder))/.10))*.16+
    near(Math.min(a.leftElbow,a.rightElbow),170,40)*.08+
    near(a.torso,0,30)*.07+
    near(a.hipTilt,0,22)*.06
  );
  const corrections:string[]=[];
  if(!standingStraight) corrections.push(`Straighten your ${standing} standing leg.`);
  if(!raisedBent) corrections.push(`Bend your ${raised} knee and lift that foot.`);
  if(!footRaised) corrections.push(`Lift your ${raised} foot off the floor.`);
  else if(!footNearLeg) corrections.push(`Bring your ${raised} foot closer to the inner ${standing} leg.`);
  if(!kneeOut) corrections.push(`Open your ${raised} knee outward.`);
  if(!overhead) corrections.push('Raise both arms overhead.');
  else if(!armsStraight) corrections.push('Straighten both arms overhead.');
  if(!upright) corrections.push('Keep your torso tall and hips level.');
  return finalize('tree',identity?Math.max(82,quality):Math.min(79,quality),identity&&quality>=78,corrections,leftRaised?'left':'right',[
    value('standingKnee','Standing knee',standingKnee,'>145°',standingStraight),
    value('raisedKnee','Raised knee',raisedKnee,'<155°',raisedBent),
    value('footRaised','Foot height',footHeight,'above standing ankle',footRaised),
    value('footNearLeg','Foot position',footDistance,'near inner leg',footNearLeg),
    value('kneeOut','Knee opening',kneeSeparation,'open outward',kneeOut),
    value('armsOverhead','Arms overhead',Math.min(a.leftWristAboveShoulder,a.rightWristAboveShoulder),'>0.035',overhead)
  ]);
}

function warrior2(p:Point[]):PoseResult {
  const a=calculateAngles(p);
  const leftFront=a.leftKnee<a.rightKnee;
  const front=leftFront?'left':'right', rear=leftFront?'right':'left';
  const frontKnee=leftFront?a.leftKnee:a.rightKnee, rearKnee=leftFront?a.rightKnee:a.leftKnee;
  const wristLevel=Math.abs(p[L.leftWrist].y-p[L.rightWrist].y);
  const leftArmLevel=Math.abs(p[L.leftWrist].y-p[L.leftShoulder].y), rightArmLevel=Math.abs(p[L.rightWrist].y-p[L.rightShoulder].y);
  const armsLevel=wristLevel<.20&&Math.max(leftArmLevel,rightArmLevel)<.24;
  const minExtension=Math.min(Math.abs(p[L.leftWrist].x-p[L.leftShoulder].x),Math.abs(p[L.rightWrist].x-p[L.rightShoulder].x));
  const armsOut=minExtension>Math.max(.10,a.shoulderWidth*.38);
  const wideThreshold=Math.max(.20,a.hipWidth*1.22), wide=a.ankleSpread>wideThreshold;
  const kneeOk=frontKnee>=50&&frontKnee<=145, rearOk=rearKnee>=138;
  const torsoOk=a.torso<34&&a.shoulderTilt<25&&a.hipTilt<25;
  const armsShapeOk=a.leftElbow>=125&&a.rightElbow>=125;
  const identity=kneeOk&&rearOk&&armsLevel&&armsOut&&wide&&torsoOk&&armsShapeOk;
  const armLevelQuality=Math.max(0,1-Math.max(wristLevel,leftArmLevel,rightArmLevel)/.30);
  const extensionQuality=Math.min(1,minExtension/Math.max(.16,a.shoulderWidth*.58));
  const stanceQuality=Math.min(1,a.ankleSpread/Math.max(.30,a.hipWidth*1.70));
  const elbowQuality=Math.min(1,Math.min(a.leftElbow,a.rightElbow)/160);
  const quality=100*(near(frontKnee,95,55)*.24+near(rearKnee,170,45)*.13+armLevelQuality*.16+extensionQuality*.13+stanceQuality*.14+near(a.torso,0,38)*.08+near(a.shoulderTilt,0,28)*.05+near(a.hipTilt,0,28)*.04+elbowQuality*.03);
  const corrections:string[]=[];
  if(frontKnee>145) corrections.push(`Bend your ${front} knee a little more.`); else if(frontKnee<50) corrections.push(`Straighten your ${front} knee slightly.`);
  if(rearKnee<138) corrections.push(`Straighten your ${rear} rear leg.`);
  if(!wide) corrections.push('Move your feet a little farther apart.');
  if(!armsLevel) corrections.push('Bring both arms roughly to shoulder height.'); else if(!armsOut) corrections.push('Extend both arms farther sideways.');
  if(!armsShapeOk) corrections.push('Keep both arms long and relaxed.');
  if(!torsoOk) corrections.push('Keep your torso upright and shoulders level.');
  return finalize('warrior2',identity?Math.max(82,quality):Math.min(79,quality),identity&&quality>=74,corrections,leftFront?'left':'right',[
    value('frontKnee','Front knee',frontKnee,'50–145°',kneeOk),value('rearKnee','Rear knee',rearKnee,'>138°',rearOk),
    value('armsLevel','Arm height',Math.max(wristLevel,leftArmLevel,rightArmLevel),'<0.24',armsLevel),value('armsOut','Arm extension',minExtension,`>${Math.max(.10,a.shoulderWidth*.38).toFixed(2)}`,armsOut),value('stance','Stance width',a.ankleSpread,`>${wideThreshold.toFixed(2)}`,wide)
  ]);
}

function mountain(p:Point[]):PoseResult {
  const a=calculateAngles(p);
  const legsStraight=a.leftKnee>=150&&a.rightKnee>=150;
  const feetClose=a.ankleSpread<=Math.max(.22,a.hipWidth*1.55);
  const armsDown=a.leftWristBelowShoulder>.09&&a.rightWristBelowShoulder>.09;
  const handsBeside=Math.abs(p[L.leftWrist].x-p[L.leftShoulder].x)<.28&&Math.abs(p[L.rightWrist].x-p[L.rightShoulder].x)<.28;
  const elbowsRelaxed=a.leftElbow>125&&a.rightElbow>125;
  const upright=a.torso<24&&a.shoulderTilt<20&&a.hipTilt<20;
  const identity=legsStraight&&feetClose&&armsDown&&handsBeside&&elbowsRelaxed&&upright;
  const quality=100*(near(a.leftKnee,175,35)*.16+near(a.rightKnee,175,35)*.16+(feetClose?1:Math.max(0,1-a.ankleSpread/Math.max(.35,a.hipWidth*2.2)))*.15+(armsDown?1:Math.min(1,Math.max(0,Math.min(a.leftWristBelowShoulder,a.rightWristBelowShoulder))/.18))*.17+(handsBeside?1:.5)*.10+near(a.torso,0,30)*.14+near(a.shoulderTilt,0,24)*.06+near(a.hipTilt,0,24)*.06);
  const corrections:string[]=[];
  if(!legsStraight) corrections.push('Stand with both legs straight and relaxed.');
  if(!feetClose) corrections.push('Bring your feet closer together.');
  if(!armsDown) corrections.push('Let both arms rest naturally beside your thighs.');
  if(!handsBeside) corrections.push('Keep your hands beside your thighs.');
  if(!upright) corrections.push('Stand tall with your shoulders and hips level.');
  return finalize('mountain',identity?Math.max(82,quality):Math.min(79,quality),identity&&quality>=78,corrections,undefined,[
    value('leftKnee','Left knee',a.leftKnee,'>150°',a.leftKnee>=150),value('rightKnee','Right knee',a.rightKnee,'>150°',a.rightKnee>=150),value('feet','Feet',a.ankleSpread,`<${Math.max(.22,a.hipWidth*1.55).toFixed(2)}`,feetClose),value('arms','Arms down',Math.min(a.leftWristBelowShoulder,a.rightWristBelowShoulder),'>0.09',armsDown)
  ]);
}

function lineAngleFromHorizontal(a: Point, b: Point) {
  const deg = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);
  return deg > 90 ? 180 - deg : deg;
}

function triangleCandidate(p: Point[], leftDown: boolean): PoseResult {
  const a = calculateAngles(p);
  const b = bodyMetrics(p);
  const lower = leftDown ? 'left' : 'right';
  const upper = leftDown ? 'right' : 'left';

  const lowerW = leftDown ? p[L.leftWrist] : p[L.rightWrist];
  const upperW = leftDown ? p[L.rightWrist] : p[L.leftWrist];
  const lowerS = leftDown ? p[L.leftShoulder] : p[L.rightShoulder];
  const upperS = leftDown ? p[L.rightShoulder] : p[L.leftShoulder];
  const lowerH = leftDown ? p[L.leftHip] : p[L.rightHip];
  const lowerK = leftDown ? p[L.leftKnee] : p[L.rightKnee];
  const lowerA = leftDown ? p[L.leftAnkle] : p[L.rightAnkle];
  const upperA = leftDown ? p[L.rightAnkle] : p[L.leftAnkle];

  const bodyLen = Math.max(0.08, d(b.shoulderMid, b.hipMid));
  const lowerLegLen = Math.max(0.12,
    d(lowerH, lowerK) + d(lowerK, lowerA));
  const stance = b.ankleSpread >= Math.max(0.28, b.hipWidth * 1.60);
  const legsStraight = a.leftKnee >= 148 && a.rightKnee >= 148;
  const armsLong = a.leftElbow >= 135 && a.rightElbow >= 135;

  // In Triangle, the lower hand is genuinely below the lower shoulder and
  // close to the same-side shin/ankle line. This is much more stable than
  // measuring the raw wrist-to-leg distance alone.
  const lowerNearLeg = pointSegmentDistance(lowerW, lowerH, lowerA) / lowerLegLen <= 0.62;
  const lowerHandDown = lowerW.y - lowerS.y >= Math.max(0.035, b.bodyHeight * 0.10) &&
    lowerW.y >= lowerK.y - Math.max(0.035, b.bodyHeight * 0.06);

  // The opposite hand must be meaningfully above its shoulder.
  const upperHandUp = upperS.y - upperW.y >= Math.max(0.025, b.bodyHeight * 0.055);

  // Both arms should form one long, controlled line through the shoulders.
  const armLine = angle(lowerW, b.shoulderMid, upperW);
  const armsAligned = armLine >= 145;

  // Triangle is a side bend, not a vertical torso. The body-axis angle is
  // deliberately broad to tolerate camera perspective and different heights.
  const torsoTilt = b.torso;
  const sideBend = torsoTilt >= 12 && torsoTilt <= 52;

  // The lower hand/side should remain on the lower side of the pose. This
  // prevents a sideways reach from being mistaken for Triangle.
  const sideOrdering = lowerS.y >= upperS.y - Math.max(0.025, b.bodyHeight * 0.08) &&
    lowerH.y >= (leftDown ? p[L.rightHip].y : p[L.leftHip].y) - Math.max(0.04, b.bodyHeight * 0.10);

  // Feet should be genuinely separated, but do not demand an exaggerated split.
  const stanceQuality = Math.min(1, b.ankleSpread / Math.max(0.34, b.hipWidth * 2.10));
  const legQuality = Math.min(1, Math.min(a.leftKnee, a.rightKnee) / 174);
  const lowerReachQuality = lowerNearLeg
    ? 1
    : Math.max(0, 1 - (pointSegmentDistance(lowerW, lowerH, lowerA) / lowerLegLen) / 0.95);
  const upperReachQuality = Math.min(1, Math.max(0, (upperS.y - upperW.y) / Math.max(0.08, b.bodyHeight * 0.18)));
  const bendQuality = Math.min(1, Math.max(0, (torsoTilt - 8) / 25));
  const armLineQuality = Math.min(1, Math.max(0, (armLine - 120) / 60));
  const elbowQuality = Math.min(1, Math.min(a.leftElbow, a.rightElbow) / 165);
  const orderQuality = sideOrdering ? 1 : 0.35;

  const identity =
    stance &&
    legsStraight &&
    armsLong &&
    lowerNearLeg &&
    lowerHandDown &&
    upperHandUp &&
    armsAligned &&
    sideBend &&
    sideOrdering;

  const quality = 100 * (
    stanceQuality * 0.14 +
    legQuality * 0.15 +
    lowerReachQuality * 0.18 +
    Math.min(1, Math.max(0, lowerHandDown ? 1 : (lowerW.y - lowerS.y) / Math.max(0.08, b.bodyHeight * 0.20))) * 0.10 +
    upperReachQuality * 0.13 +
    armLineQuality * 0.12 +
    bendQuality * 0.10 +
    elbowQuality * 0.05 +
    orderQuality * 0.03
  );

  const corrections: string[] = [];
  if (!stance) corrections.push('Widen your stance and keep both feet firmly planted.');
  if (!legsStraight) corrections.push('Straighten both legs while keeping your knees soft.');
  if (!lowerHandDown || !lowerNearLeg) corrections.push(`Reach your ${lower} hand farther down the ${lower} leg.`);
  if (!upperHandUp) corrections.push(`Reach your ${upper} arm upward above the shoulder.`);
  if (!armsAligned) corrections.push('Keep both arms long in one straight line.');
  if (!sideBend) corrections.push('Lengthen your spine and create a clear side bend.');
  if (!sideOrdering) corrections.push('Keep the lower shoulder and lower hip on the hand-down side.');
  if (!armsLong) corrections.push('Keep both elbows long and controlled.');

  return finalize(
    'triangle',
    identity ? Math.max(82, quality) : Math.min(79, quality),
    identity && quality >= 74,
    corrections,
    leftDown ? 'left' : 'right',
    [
      value('stance', 'Stance width', b.ankleSpread, `>${Math.max(0.28, b.hipWidth * 1.60).toFixed(2)}`, stance),
      value('legs', 'Legs straight', Math.min(a.leftKnee, a.rightKnee), '>148°', legsStraight),
      value('lowerHand', 'Lower-hand reach', pointSegmentDistance(lowerW, lowerH, lowerA) / lowerLegLen, '<0.62', lowerNearLeg),
      value('upperHand', 'Upper-hand reach', upperS.y - upperW.y, '>0.055 bodyH', upperHandUp),
      value('armLine', 'Arm alignment', armLine, '>145°', armsAligned),
      value('sideBend', 'Torso side bend', torsoTilt, '12–52°', sideBend),
    ]
  );
}

function triangle(p: Point[]): PoseResult {
  const candidates = [triangleCandidate(p, true), triangleCandidate(p, false)];
  return candidates.sort((a, b) => (b.identity === a.identity ? b.score - a.score : Number(b.identity) - Number(a.identity)))[0];
}

function cobraSide(p: Point[]): PoseResult {
  const a = calculateAngles(p);
  const b = bodyMetrics(p);
  const bodyLen = Math.max(0.12, d(b.shoulderMid, b.hipMid));
  const axisTilt = lineAngleFromHorizontal(b.shoulderMid, b.hipMid);

  // Side-view Cobra is intentionally evaluated around the visible arm. In a
  // true profile pose, the far hand/arm is often occluded or compressed into
  // the visible arm by MediaPipe. Requiring both hands to satisfy a 2-D
  // distance check was the primary reason real Cobra sessions stayed at 79%.
  const leftArmVis = (pointConfidence(p[L.leftShoulder]) + pointConfidence(p[L.leftElbow]) + pointConfidence(p[L.leftWrist])) / 3;
  const rightArmVis = (pointConfidence(p[L.rightShoulder]) + pointConfidence(p[L.rightElbow]) + pointConfidence(p[L.rightWrist])) / 3;
  const leftHandDx = Math.abs(p[L.leftWrist].x - p[L.leftShoulder].x) / bodyLen;
  const rightHandDx = Math.abs(p[L.rightWrist].x - p[L.rightShoulder].x) / bodyLen;
  const leftHandDrop = (p[L.leftWrist].y - p[L.leftShoulder].y) / bodyLen;
  const rightHandDrop = (p[L.rightWrist].y - p[L.rightShoulder].y) / bodyLen;

  const leftHandPlaced = leftHandDx <= 1.05 && leftHandDrop >= -0.30 && leftHandDrop <= 1.20;
  const rightHandPlaced = rightHandDx <= 1.05 && rightHandDrop >= -0.30 && rightHandDrop <= 1.20;
  const bestHandVisible = Math.max(leftArmVis, rightArmVis) >= 0.20;
  const bestHandPlaced = leftArmVis >= rightArmVis ? leftHandPlaced : rightHandPlaced;
  const farHandAcceptable = leftArmVis >= rightArmVis
    ? (rightArmVis < 0.20 || rightHandPlaced || rightHandDx <= 1.80)
    : (leftArmVis < 0.20 || leftHandPlaced || leftHandDx <= 1.80);
  const handsNearShoulders = bestHandVisible && bestHandPlaced && farHandAcceptable;

  const shoulderLift = (b.hipMid.y - b.shoulderMid.y) / bodyLen;
  const headLift = (b.shoulderMid.y - p[L.nose].y) / bodyLen;
  const horizontalBody = axisTilt <= 65;
  const chestLift = shoulderLift >= 0.015;
  const headRaised = headLift >= 0.045;

  const elbowsBendLeft = angle(p[L.leftShoulder], p[L.leftElbow], p[L.leftWrist]);
  const elbowsBendRight = angle(p[L.rightShoulder], p[L.rightElbow], p[L.rightWrist]);
  const elbowCandidates = [
    { value: elbowsBendLeft, vis: leftArmVis },
    { value: elbowsBendRight, vis: rightArmVis },
  ].filter(x => x.vis >= 0.20);
  const elbowsBend = elbowCandidates.length
    ? elbowCandidates.reduce((sum, x) => sum + x.value, 0) / elbowCandidates.length
    : 110;
  const elbowAngleOk = elbowsBend >= 30 && elbowsBend <= 178;

  const legsStraightLeft = angle(p[L.leftHip], p[L.leftKnee], p[L.leftAnkle]);
  const legsStraightRight = angle(p[L.rightHip], p[L.rightKnee], p[L.rightAnkle]);
  const kneeCandidates = [
    { value: legsStraightLeft, vis: (pointConfidence(p[L.leftHip]) + pointConfidence(p[L.leftKnee]) + pointConfidence(p[L.leftAnkle])) / 3 },
    { value: legsStraightRight, vis: (pointConfidence(p[L.rightHip]) + pointConfidence(p[L.rightKnee]) + pointConfidence(p[L.rightAnkle])) / 3 },
  ].filter(x => x.vis >= 0.20);
  const legsStraight = kneeCandidates.length
    ? Math.min(...kneeCandidates.map(x => x.value)) >= 118
    : false;

  const legFlatness = (
    Math.abs(p[L.leftKnee].y - p[L.leftHip].y) +
    Math.abs(p[L.rightKnee].y - p[L.rightHip].y) +
    Math.abs(p[L.leftAnkle].y - p[L.leftHip].y) +
    Math.abs(p[L.rightAnkle].y - p[L.rightHip].y)
  ) / (4 * bodyLen);
  const legsGrounded = legFlatness <= 1.10;
  const hipsGrounded = b.hipMid.y >= b.shoulderMid.y - b.bodyHeight * 0.10;

  // Profile Cobra is defined primarily by the spine/chest/head lift and a
  // long grounded lower body. Hand placement is a quality cue, not a hard
  // identity gate: in a side view MediaPipe can compress/occlude the far arm
  // and shift the visible wrist substantially while the actual Cobra form is
  // still correct. Requiring the hand gate was the reason real recordings
  // were capped at 79% forever.
  const visibleKneeAngle = kneeCandidates.length ? Math.min(...kneeCandidates.map(x => x.value)) : 0;
  const lowerBodyOk = legsStraight || visibleKneeAngle >= 105;
  const identity =
    horizontalBody &&
    chestLift &&
    headRaised &&
    lowerBodyOk &&
    legsGrounded &&
    hipsGrounded;

  const orientationQ = clamp(1 - Math.max(0, axisTilt - 18) / 55);
  const chestQ = clamp((shoulderLift - 0.005) / 0.10);
  const headQ = clamp(headLift / 0.24);
  const bestHandDx = leftArmVis >= rightArmVis ? leftHandDx : rightHandDx;
  const bestHandDrop = leftArmVis >= rightArmVis ? leftHandDrop : rightHandDrop;
  const handQ = handsNearShoulders
    ? 1
    : clamp(1 - Math.max(0, bestHandDx - 0.75) / 1.20) * 0.65 + clamp(1 - Math.max(0, -bestHandDrop) / 0.35) * 0.35;
  const elbowsQ = clamp(1 - Math.abs(elbowsBend - 105) / 85);
  const visibleKnees = kneeCandidates.length ? Math.min(...kneeCandidates.map(x => x.value)) : 110;
  const legsQ = clamp(visibleKnees / 160);
  const groundedQ = clamp(1 - legFlatness / 1.20);
  const pelvisQ = hipsGrounded ? 1 : clamp(1 - Math.max(0, (b.shoulderMid.y - b.hipMid.y) / Math.max(0.08, b.bodyHeight)) / 0.18);

  // Score the form primarily from the pose-defining body shape. Hand placement
  // is deliberately low-weight in a profile webcam view because occlusion and
  // perspective can move the wrist without changing the underlying Cobra.
  const quality = 100 * (
    orientationQ * 0.12 +
    chestQ * 0.20 +
    headQ * 0.20 +
    handQ * 0.06 +
    elbowsQ * 0.07 +
    legsQ * 0.19 +
    groundedQ * 0.10 +
    pelvisQ * 0.06
  );

  const corrections: string[] = [];
  if (!horizontalBody) corrections.push('Lower your body toward the mat and keep your spine long.');
  if (!chestLift || !headRaised) corrections.push('Lift your chest and head gently while keeping the pelvis grounded.');
  if (!lowerBodyOk || !legsGrounded) corrections.push('Keep both legs long and relaxed on the mat.');
  if (!hipsGrounded) corrections.push('Keep the pelvis and hips heavy on the mat.');
  // Only surface hand/elbow coaching when the core Cobra geometry is not
  // already good. These cues must never block the green/correct state.
  if (!identity && !handsNearShoulders) corrections.push('Place your visible palm under or just outside the shoulder.');
  else if (!identity && !elbowAngleOk) corrections.push('Keep a soft elbow bend and draw the elbow gently toward your ribs.');

  return finalize(
    'cobra',
    identity ? Math.max(82, quality) : Math.min(79, quality),
    identity && quality >= 62,
    corrections,
    undefined,
    [
      value('bodyAxis', 'Body orientation', axisTilt, '<65° from horizontal', horizontalBody),
      value('chestLift', 'Chest lift', shoulderLift, '>0.015', chestLift),
      value('headLift', 'Head/chest line', headLift, '>0.045', headRaised),
      value('handPlacement', 'Visible hand placement', bestHandDx, '<1.05 body length', handsNearShoulders),
      value('legs', 'Legs long', visibleKneeAngle, '>105°', lowerBodyOk),
    ],
    62
  );
}

function cobraFront(p: Point[]): PoseResult {
  const a = calculateAngles(p);
  const b = bodyMetrics(p);
  const shoulderWidth = Math.max(0.08, b.shoulderWidth);
  const verticalStack = b.torso <= 50;
  const bodyHeight = Math.max(0.25, Math.max(p[L.leftHip].y, p[L.rightHip].y, p[L.leftKnee].y, p[L.rightKnee].y, p[L.leftAnkle].y, p[L.rightAnkle].y) - Math.min(p[L.nose].y, b.shoulderMid.y));
  const chestRise = (b.hipMid.y - b.shoulderMid.y) / bodyHeight;
  const headLift = (b.shoulderMid.y - p[L.nose].y) / bodyHeight;
  const kneesStraight = Math.min(a.leftKnee, a.rightKnee) >= 128;
  const elbowsBend = (a.leftElbow + a.rightElbow) / 2;
  const elbowsGood = elbowsBend >= 35 && elbowsBend <= 178;

  const wristGap = Math.max(
    Math.abs(p[L.leftWrist].y - p[L.leftShoulder].y),
    Math.abs(p[L.rightWrist].y - p[L.rightShoulder].y)
  ) / Math.max(0.10, bodyHeight);
  const wristsUnderShoulders = wristGap <= 0.18;

  const handOffset = Math.max(
    Math.abs(p[L.leftWrist].x - p[L.leftShoulder].x),
    Math.abs(p[L.rightWrist].x - p[L.rightShoulder].x)
  ) / shoulderWidth;
  const handsCentered = handOffset <= 1.70;

  const elbowOffset = Math.max(
    Math.abs(p[L.leftElbow].x - p[L.leftShoulder].x),
    Math.abs(p[L.rightElbow].x - p[L.rightShoulder].x)
  ) / shoulderWidth;
  const elbowsUnder = elbowOffset <= 1.35;

  const legsLong = kneesStraight &&
    p[L.leftAnkle].y >= p[L.leftHip].y - b.bodyHeight * 0.18 &&
    p[L.rightAnkle].y >= p[L.rightHip].y - b.bodyHeight * 0.18;

  // Front-view Cobra: core shape is chest/head lift + long grounded legs.
  // Hand placement is deliberately a soft coaching metric because webcam
  // perspective can move the wrists away from the textbook projection.
  const identity =
    verticalStack &&
    chestRise >= 0.02 &&
    headLift >= 0.045 &&
    kneesStraight &&
    legsLong;

  const quality = 100 * (
    clamp(1 - Math.max(0, b.torso - 18) / 45) * 0.12 +
    clamp(chestRise / 0.14) * 0.22 +
    clamp(headLift / 0.20) * 0.20 +
    clamp(1 - Math.abs(elbowsBend - 105) / 90) * 0.08 +
    (wristsUnderShoulders ? 1 : 0.70) * 0.04 +
    (handsCentered ? 1 : 0.75) * 0.04 +
    (elbowsUnder ? 1 : 0.80) * 0.04 +
    clamp(Math.min(a.leftKnee, a.rightKnee) / 165) * 0.17 +
    (legsLong ? 1 : 0.65) * 0.09
  );

  const corrections: string[] = [];
  if (!verticalStack) corrections.push('Keep your chest centered and close to the mat.');
  if (chestRise < 0.02 || headLift < 0.045) corrections.push('Lift your chest and head gently without lifting the pelvis.');
  if (!legsLong) corrections.push('Extend both legs long behind you and relax the knees.');
  if (!identity && (!wristsUnderShoulders || !handsCentered)) corrections.push('Place your palms under or just outside your shoulders.');
  else if (!identity && (!elbowsUnder || !elbowsGood)) corrections.push('Keep a soft bend and keep your elbows close to your sides.');

  return finalize(
    'cobra',
    identity ? Math.max(78, quality) : Math.min(79, quality),
    identity && quality >= 62,
    corrections,
    undefined,
    [
      value('chestRise', 'Chest lift', chestRise, '>0.03', chestRise >= 0.03),
      value('headLift', 'Head lift', headLift, '>0.06', headLift >= 0.06),
      value('elbows', 'Elbow bend', elbowsBend, '35–178°', elbowsGood),
      value('hands', 'Hand position', handOffset, '<1.70', handsCentered),
      value('legs', 'Leg extension', Math.min(a.leftKnee, a.rightKnee), '>128°', kneesStraight),
    ],
    62
  );
}

function cobra(p: Point[]): PoseResult {
  const side = cobraSide(p);
  const front = cobraFront(p);
  return [side, front].sort((a, b) => (b.good === a.good ? b.score - a.score : Number(b.good) - Number(a.good)))[0];
}

export function comparePose(name:PoseName, points:Point[]):PoseResult {
  if(name==='tree') return tree(points);
  if(name==='warrior2') return warrior2(points);
  if(name==='mountain') return mountain(points);
  if(name==='triangle') return triangle(points);
  return cobra(points);
}

export function bodyIsUsable(points:Point[]) {
  if(!points || points.length<33) return false;
  const required=[L.nose,L.leftShoulder,L.rightShoulder,L.leftHip,L.rightHip,L.leftKnee,L.rightKnee,L.leftAnkle,L.rightAnkle,L.leftWrist,L.rightWrist];
  const visible=required.filter(i=>usablePoint(points[i]) && pointConfidence(points[i])>=.10).length;
  return visible>=7;
}
