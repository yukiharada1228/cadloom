import {point2,circle2,intersectCircles2,circularArc2,pointOnArc2,splitCircularArc2,intersectLineArc2,line2,intersectArcs2} from '../dist/index.js';
const unit=circle2(point2(0n,0n),1n),common=intersectCircles2(unit,circle2(point2(1n,0n),1n));
if(common.kind!=='points')throw new Error('Expected two circle intersections');
const lower=common.points.find(p=>p.y.sign()<0)!,upper=common.points.find(p=>p.y.sign()>0)!;
const minor=circularArc2(unit,lower,upper);
const overlap=intersectArcs2(circularArc2(unit,point2(1n,0n),point2(0n,-1n)),circularArc2(unit,point2(-1n,0n),point2(1n,0n)));
console.log(JSON.stringify({
  minorContainsEast:pointOnArc2(point2(1n,0n),minor),
  minorContainsWest:pointOnArc2(point2(-1n,0n),minor),
  splitPieces:splitCircularArc2(minor,[point2(1n,0n)]).length,
  axisHits:intersectLineArc2(line2(point2(0n,0n),point2(1n,0n)),minor).length,
  overlap:overlap.kind==='overlap'?{arcs:overlap.arcs.length,isolatedPoints:overlap.points.length}:overlap.kind,
},null,2));
