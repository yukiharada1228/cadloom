import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {Polynomial} from '../numeric/polynomial.js';
import type {Sign} from '../numeric/rational.js';
import {point2} from './point2.js';
import type {Point2,Segment2} from './point2.js';
import {algebraicPoint2,algebraicCoordinates2,compareAlgebraicPoints2,snapshotAlgebraicCoordinates2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {circle2,classifyAlgebraicPointToCircle2,intersectCircles2,intersectLineCircle2,intersectSegmentCircle2} from './circle2.js';
import type {Circle2,Line2,LineCircleHit2} from './circle2.js';

export type ArcDirection2='ccw'|'cw';
export type CircularPointInput2=Point2|AlgebraicCoordinates2;
export interface CircularArcOptions2 {readonly direction?:ArcDirection2;readonly fullCircle?:boolean;}
export interface CircularArc2 {
  readonly circle:Circle2;
  readonly start:AlgebraicCoordinates2;
  readonly end:AlgebraicCoordinates2;
  readonly direction:ArcDirection2;
  /** Equal endpoints mean a point arc unless this flag is true. */
  readonly fullCircle:boolean;
}
export type ArcPointLocation2='outside'|'endpoint'|'interior';
const same=(a:AlgebraicCoordinates2,b:AlgebraicCoordinates2)=>compareAlgebraicPoints2(a,b)===0;
function coordinates(p:CircularPointInput2):AlgebraicCoordinates2 {
  if(p.x instanceof AlgebraicReal&&p.y instanceof AlgebraicReal)return snapshotAlgebraicCoordinates2(p as AlgebraicCoordinates2);
  return algebraicCoordinates2(p.x,p.y);
}
function make(circle:Circle2,start:AlgebraicCoordinates2,end:AlgebraicCoordinates2,direction:ArcDirection2,fullCircle=false):CircularArc2 {
  return Object.freeze({circle,start,end,direction,fullCircle});
}
/** Closed oriented arc. Endpoints may be independent real algebraic coordinates. */
export function circularArc2(input:Circle2,startInput:CircularPointInput2,endInput:CircularPointInput2,options:CircularArcOptions2={}):CircularArc2 {
  const circle=circle2(input.center,input.radiusSquared),start=coordinates(startInput),end=coordinates(endInput);
  const direction=options.direction??'ccw',full=options.fullCircle??false;
  if(direction!=='ccw'&&direction!=='cw')throw new RangeError('Unknown arc direction');
  if(typeof full!=='boolean')throw new TypeError('fullCircle must be boolean');
  if(classifyAlgebraicPointToCircle2(start,circle)!==0||classifyAlgebraicPointToCircle2(end,circle)!==0)throw new RangeError('Arc endpoints must lie on the circle');
  const equal=same(start,end);
  if(full&&!equal)throw new RangeError('A full circle arc requires equal seam endpoints');
  return make(circle,start,equal?start:end,direction,full&&circle.radiusSquared.sign()>0);
}
/** Full positive-radius circle with a rightmost seam; a point circle stays a point. */
export function fullCircleArc2(input:Circle2,direction:ArcDirection2='ccw'):CircularArc2 {
  const circle=circle2(input.center,input.radiusSquared);
  const root=circle.radiusSquared.sign()===0?AlgebraicReal.fromRational(0n):isolateRealRoots(new Polynomial([circle.radiusSquared.neg(),0n,1n]))[1]!;
  const seam=algebraicPoint2(circle.center,point2(1n,0n),root);
  return circularArc2(circle,seam,seam,{direction,fullCircle:true});
}
export function reverseCircularArc2(arc:CircularArc2):CircularArc2 {
  return make(arc.circle,arc.end,arc.start,arc.direction==='ccw'?'cw':'ccw',arc.fullCircle);
}
/** CCW order starting at the positive x ray. Only used for certified circle points.
 * In the upper half x decreases strictly; in the lower half x increases strictly.
 */
function angleCompare(circle:Circle2,a:AlgebraicCoordinates2,b:AlgebraicCoordinates2):Sign {
  if(circle.radiusSquared.sign()===0)return 0;
  const cy=AlgebraicReal.fromRational(circle.center.y),cx=AlgebraicReal.fromRational(circle.center.x);
  const half=(p:AlgebraicCoordinates2)=>{const y=p.y.compare(cy);return y>0||y===0&&p.x.compare(cx)>=0?0:1;};
  const ha=half(a),hb=half(b);
  if(ha!==hb)return ha<hb?-1:1;
  const comparison=a.x.compare(b.x);
  return ha===0?(comparison===0?0:comparison===1?-1:1):comparison;
}
export function comparePointsAroundCircle2(input:Circle2,aInput:CircularPointInput2,bInput:CircularPointInput2):Sign {
  const circle=circle2(input.center,input.radiusSquared),a=coordinates(aInput),b=coordinates(bInput);
  if(classifyAlgebraicPointToCircle2(a,circle)!==0||classifyAlgebraicPointToCircle2(b,circle)!==0)throw new RangeError('Angular ordering requires points on the circle');
  return angleCompare(circle,a,b);
}
function containsOnCircle(p:AlgebraicCoordinates2,arc:CircularArc2):boolean {
  if(arc.fullCircle)return true;
  if(same(arc.start,arc.end))return same(p,arc.start);
  const start=arc.direction==='ccw'?arc.start:arc.end,end=arc.direction==='ccw'?arc.end:arc.start;
  const order=angleCompare(arc.circle,start,end),from=angleCompare(arc.circle,start,p),to=angleCompare(arc.circle,p,end);
  return order<0?from<=0&&to<=0:from<=0||to<=0;
}
export function locatePointOnArc2(point:CircularPointInput2,arc:CircularArc2):ArcPointLocation2 {
  const p=coordinates(point);
  if(classifyAlgebraicPointToCircle2(p,arc.circle)!==0||!containsOnCircle(p,arc))return 'outside';
  return !arc.fullCircle&&(same(p,arc.start)||same(p,arc.end))?'endpoint':'interior';
}
export function pointOnArc2(point:CircularPointInput2,arc:CircularArc2):boolean{return locatePointOnArc2(point,arc)!=='outside';}
function orderAlong(arc:CircularArc2,a:AlgebraicCoordinates2,b:AlgebraicCoordinates2):Sign {
  const side=(p:AlgebraicCoordinates2)=>{
    const c=angleCompare(arc.circle,arc.start,p);
    return arc.direction==='ccw'?(c<=0?0:1):(c>=0?0:1);
  };
  const sa=side(a),sb=side(b);
  if(sa!==sb)return sa<sb?-1:1;
  const c=angleCompare(arc.circle,a,b);
  return arc.direction==='ccw'?c:c===0?0:c===1?-1:1;
}
export function comparePointsOnArc2(arc:CircularArc2,aInput:CircularPointInput2,bInput:CircularPointInput2):Sign {
  const a=coordinates(aInput),b=coordinates(bInput);
  if(locatePointOnArc2(a,arc)==='outside'||locatePointOnArc2(b,arc)==='outside')throw new RangeError('Arc ordering requires points on the arc');
  return orderAlong(arc,a,b);
}
function unique(points:readonly AlgebraicCoordinates2[]):AlgebraicCoordinates2[]{
  return points.filter((p,i)=>points.findIndex(q=>same(p,q))===i);
}
/** Exact oriented subdivision; duplicate cuts/endpoints do not create point pieces. */
export function splitCircularArc2(arc:CircularArc2,cuts:readonly CircularPointInput2[]):readonly CircularArc2[] {
  const points=cuts.map(coordinates);
  if(points.some(p=>locatePointOnArc2(p,arc)==='outside'))throw new RangeError('Arc cut must lie on the arc');
  if(!arc.fullCircle&&same(arc.start,arc.end))return Object.freeze([arc]);
  const ordered=unique([arc.start,...points,arc.end]).sort((a,b)=>orderAlong(arc,a,b));
  if(ordered.length===1)return Object.freeze([arc]);
  const count=arc.fullCircle?ordered.length:ordered.length-1;
  return Object.freeze(Array.from({length:count},(_,i)=>make(arc.circle,ordered[i]!,ordered[(i+1)%ordered.length]!,arc.direction)));
}
export function intersectLineArc2(line:Line2,arc:CircularArc2):readonly LineCircleHit2[]{
  return Object.freeze(intersectLineCircle2(line,arc.circle).filter(hit=>containsOnCircle(hit.point,arc)));
}
export function intersectSegmentArc2(segment:Segment2,arc:CircularArc2):readonly LineCircleHit2[]{
  return Object.freeze(intersectSegmentCircle2(segment,arc.circle).filter(hit=>containsOnCircle(hit.point,arc)));
}
export type ArcIntersection2=
 | {readonly kind:'none'}
 | {readonly kind:'points';readonly points:readonly AlgebraicCoordinates2[]}
 | {readonly kind:'overlap';readonly arcs:readonly CircularArc2[];readonly points:readonly AlgebraicCoordinates2[]};
/** Closed set intersection. Positive-length overlaps follow the first arc's direction;
 * isolated contact points are retained separately from overlapping arc components.
 */
export function intersectArcs2(first:CircularArc2,second:CircularArc2):ArcIntersection2 {
  const support=intersectCircles2(first.circle,second.circle);
  const resultPoints=(points:AlgebraicCoordinates2[]):ArcIntersection2=>points.length?Object.freeze({kind:'points',points:Object.freeze(points.sort((a,b)=>orderAlong(first,a,b)))}):Object.freeze({kind:'none'});
  if(support.kind==='none')return Object.freeze({kind:'none'});
  if(support.kind==='points')return resultPoints(support.points.filter(p=>containsOnCircle(p,first)&&containsOnCircle(p,second)));
  const marks=unique([first.start,first.end,second.start,second.end]).sort((a,b)=>angleCompare(first.circle,a,b));
  const N=marks.length;
  const inCell=(arc:CircularArc2,index:number)=>{
    if(arc.fullCircle)return true;
    const s=marks.findIndex(p=>same(p,arc.direction==='ccw'?arc.start:arc.end)),e=marks.findIndex(p=>same(p,arc.direction==='ccw'?arc.end:arc.start));
    return s<e?s<=index&&index<e:s>e&&(index>=s||index<e);
  };
  const selected=marks.map((_,i)=>inCell(first,i)&&inCell(second,i));
  if(selected.every(Boolean))return Object.freeze({kind:'overlap',arcs:Object.freeze([make(first.circle,first.start,first.start,first.direction,true)]),points:Object.freeze([])});
  const arcs:CircularArc2[]=[],points:AlgebraicCoordinates2[]=[];
  marks.forEach((p,i)=>{
    const previous=selected[(i+N-1)%N]!;
    if(selected[i]&&!previous){
      let end=(i+1)%N;while(selected[end])end=(end+1)%N;
      arcs.push(first.direction==='ccw'?make(first.circle,p,marks[end]!,first.direction):make(first.circle,marks[end]!,p,first.direction));
    }
    if(!selected[i]&&!previous&&containsOnCircle(p,first)&&containsOnCircle(p,second))points.push(p);
  });
  if(!arcs.length)return resultPoints(points);
  return Object.freeze({kind:'overlap',arcs:Object.freeze(arcs.sort((a,b)=>orderAlong(first,a.start,b.start))),points:Object.freeze(points.sort((a,b)=>orderAlong(first,a,b)))});
}
