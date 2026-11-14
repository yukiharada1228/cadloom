import {point2,segment2,pointsEqual} from './point2.js';
import type {Point2,Segment2} from './point2.js';
import {compareAlgebraicPoints2,snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {line2,intersectLineCircle2} from './circle2.js';
import type {Circle2} from './circle2.js';
import {circularArc2,fullCircleArc2,reverseCircularArc2,pointOnArc2,splitCircularArc2,intersectArcs2} from './circular-arc2.js';
import type {CircularArc2} from './circular-arc2.js';
import {lineInterval2,canonicalLine2,pointOnLineInterval2,intersectLineIntervals2,intersectLineIntervalArc2} from './line-interval2.js';
import type {LineInterval2} from './line-interval2.js';

export type PlanarCurve2=
 | {readonly kind:'segment';readonly segment:Segment2}
 | {readonly kind:'line';readonly interval:LineInterval2}
 | {readonly kind:'arc';readonly arc:CircularArc2}
 | {readonly kind:'point';readonly point:Point2|AlgebraicCoordinates2};
export interface CurveVertex2 {readonly point:AlgebraicCoordinates2;readonly sources:readonly number[];}
export interface CurveUse2 {readonly source:number;readonly direction:1|-1;}
interface CurveEdgeBase2 {
  /** Vertex IDs in exact lexicographic coordinate order, start < end. */
  readonly start:number;readonly end:number;
  readonly sources:readonly number[];
  /** Input traversal relative to this edge's canonical start->end geometry. */
  readonly uses:readonly CurveUse2[];
}
export type CurveEdge2=CurveEdgeBase2&(
 | {readonly kind:'line';readonly interval:LineInterval2}
 | {readonly kind:'arc';readonly arc:CircularArc2}
);
export interface CurveArrangement2 {readonly vertices:readonly CurveVertex2[];readonly edges:readonly CurveEdge2[];}
type NormalCurve=
 | {kind:'point';point:AlgebraicCoordinates2}
 | {kind:'line';interval:LineInterval2;forward:1|-1}
 | {kind:'arc';arc:CircularArc2};
const same=(a:AlgebraicCoordinates2,b:AlgebraicCoordinates2)=>compareAlgebraicPoints2(a,b)===0;
const circleKey=(c:Circle2)=>`${c.center.x},${c.center.y},${c.radiusSquared}`;
function normalizeLine(input:LineInterval2):NormalCurve {
  const original=lineInterval2(input.line,input.startParameter,input.endParameter),comparison=compareAlgebraicPoints2(original.start,original.end);
  if(comparison===0)return {kind:'point',point:original.start};
  const line=canonicalLine2(original.line),parameter=(p:AlgebraicCoordinates2)=>line.direction.x.sign()===0?p.y:p.x;
  const start=parameter(original.start),end=parameter(original.end);
  return {kind:'line',interval:comparison<0?lineInterval2(line,start,end):lineInterval2(line,end,start),forward:comparison<0?1:-1};
}
function normalize(input:PlanarCurve2):NormalCurve {
  switch(input.kind){
    case 'point':return {kind:'point',point:snapshotExactPoint2(input.point)};
    case 'line':return normalizeLine(input.interval);
    case 'segment':{
      const s=segment2(input.segment.start,input.segment.end);
      return pointsEqual(s.start,s.end)?{kind:'point',point:snapshotExactPoint2(s.start)}:normalizeLine(lineInterval2(line2(s.start,point2(s.end.x.sub(s.start.x),s.end.y.sub(s.start.y))),0n,1n));
    }
    case 'arc':{
      const a=input.arc,arc=a.fullCircle?fullCircleArc2(a.circle,a.direction):circularArc2(a.circle,a.start,a.end,{direction:a.direction});
      return !arc.fullCircle&&same(arc.start,arc.end)?{kind:'point',point:arc.start}:{kind:'arc',arc};
    }
    default:throw new RangeError('Unknown planar curve kind');
  }
}
function contains(point:AlgebraicCoordinates2,curve:NormalCurve):boolean {
  return curve.kind==='point'?same(point,curve.point):curve.kind==='line'?pointOnLineInterval2(point,curve.interval):pointOnArc2(point,curve.arc);
}
function pairCuts(a:NormalCurve,b:NormalCurve):readonly AlgebraicCoordinates2[]{
  if(a.kind==='point')return contains(a.point,b)?[a.point]:[];
  if(b.kind==='point')return contains(b.point,a)?[b.point]:[];
  if(a.kind==='line'&&b.kind==='line'){
    const hit=intersectLineIntervals2(a.interval,b.interval);
    return hit.kind==='none'?[]:hit.kind==='point'?[hit.point]:[hit.interval.start,hit.interval.end];
  }
  if(a.kind==='arc'&&b.kind==='arc'){
    const hit=intersectArcs2(a.arc,b.arc);
    if(hit.kind==='none')return [];
    if(hit.kind==='points')return hit.points;
    return [...hit.points,...hit.arcs.flatMap(arc=>[arc.start,arc.end]),...[a.arc.start,a.arc.end,b.arc.start,b.arc.end].filter(p=>contains(p,a)&&contains(p,b))];
  }
  const line=a.kind==='line'?a:b as Extract<NormalCurve,{kind:'line'}>,arc=a.kind==='arc'?a:b as Extract<NormalCurve,{kind:'arc'}>;
  return intersectLineIntervalArc2(line.interval,arc.arc).map(hit=>hit.point);
}
/** Nodes mixed rational line supports/circles with algebraic trims and isolated points.
 * All pairwise contacts/overlap boundaries become shared vertices. Circle extrema
 * also split arcs into x-monotone pieces, ensuring full circles never form self-loops.
 * Coincident edges merge while preserving source indices and traversal directions.
 */
export function splitCurves2(input:readonly PlanarCurve2[]):CurveArrangement2 {
  const curves=input.map(normalize),cards=new Map<string,readonly AlgebraicCoordinates2[]>();
  const cuts:AlgebraicCoordinates2[][]=curves.map(curve=>{
    if(curve.kind==='point')return [curve.point];
    if(curve.kind==='line')return [curve.interval.start,curve.interval.end];
    const arc=curve.arc,key=circleKey(arc.circle);
    let extremes=cards.get(key);
    if(!extremes){extremes=intersectLineCircle2(line2(arc.circle.center,point2(1n,0n)),arc.circle).map(hit=>hit.point);cards.set(key,extremes);}
    return [arc.start,arc.end,...extremes.filter(p=>pointOnArc2(p,arc))];
  });
  for(let i=0;i<curves.length;i++)for(let j=i+1;j<curves.length;j++){
    const points=pairCuts(curves[i]!,curves[j]!);cuts[i]!.push(...points);cuts[j]!.push(...points);
  }
  const records=cuts.flatMap((points,source)=>points.map(point=>({point,source}))).sort((a,b)=>compareAlgebraicPoints2(a.point,b.point));
  const vertices:{point:AlgebraicCoordinates2;sources:Set<number>}[]=[],cutIds:number[][]=curves.map(()=>[]);
  for(const record of records){
    const last=vertices[vertices.length-1];
    if(!last||!same(last.point,record.point))vertices.push({point:record.point,sources:new Set()});
    const id=vertices.length-1;vertices[id]!.sources.add(record.source);cutIds[record.source]!.push(id);
  }
  const vertexId=(point:AlgebraicCoordinates2)=>{
    let lo=0,hi=vertices.length;
    while(lo<hi){const mid=Math.floor((lo+hi)/2),comparison=compareAlgebraicPoints2(vertices[mid]!.point,point);if(comparison<0)lo=mid+1;else hi=mid;}
    if(lo===vertices.length||!same(vertices[lo]!.point,point))throw new Error('Curve endpoint missing from global vertex set');
    return lo;
  };
  type Geometry={kind:'line';interval:LineInterval2}|{kind:'arc';arc:CircularArc2};
  const edges=new Map<string,{key:string;start:number;end:number;geometry:Geometry;uses:Map<number,1|-1>}>();
  function add(start:number,end:number,geometry:Geometry,source:number,direction:1|-1){
    if(start>=end)throw new Error('Curve edge must have two canonical distinct vertices');
    const key=`${geometry.kind}:${start}:${end}`+(geometry.kind==='arc'?`:${circleKey(geometry.arc.circle)}:${geometry.arc.direction}`:'');
    let edge=edges.get(key);
    if(!edge){edge={key,start,end,geometry,uses:new Map()};edges.set(key,edge);}
    const previous=edge.uses.get(source);
    if(previous!==undefined&&previous!==direction)throw new Error('Source traverses an atomic curve in both directions');
    edge.uses.set(source,direction);
  }
  curves.forEach((curve,source)=>{
    const ids=[...new Set(cutIds[source])].sort((a,b)=>a-b);
    if(curve.kind==='point')return;
    if(curve.kind==='line'){
      const line=curve.interval.line,parameter=(p:AlgebraicCoordinates2)=>line.direction.x.sign()===0?p.y:p.x;
      for(let i=1;i<ids.length;i++){
        const start=ids[i-1]!,end=ids[i]!;
        add(start,end,{kind:'line',interval:lineInterval2(line,parameter(vertices[start]!.point),parameter(vertices[end]!.point))},source,curve.forward);
      }
    } else {
      for(const piece of splitCircularArc2(curve.arc,ids.map(id=>vertices[id]!.point))){
        if(piece.fullCircle)throw new Error('Circle extrema failed to split a full circle');
        const a=vertexId(piece.start),b=vertexId(piece.end),forward=a<b;
        add(Math.min(a,b),Math.max(a,b),{kind:'arc',arc:forward?piece:reverseCircularArc2(piece)},source,forward?1:-1);
      }
    }
  });
  const ordered=[...edges.values()].sort((a,b)=>a.start-b.start||a.end-b.end||(a.key<b.key?-1:a.key>b.key?1:0));
  return Object.freeze({
    vertices:Object.freeze(vertices.map(v=>Object.freeze({point:v.point,sources:Object.freeze([...v.sources].sort((a,b)=>a-b))}))),
    edges:Object.freeze(ordered.map(edge=>{
      const uses=Object.freeze([...edge.uses].sort(([a],[b])=>a-b).map(([source,direction])=>Object.freeze({source,direction})));
      return Object.freeze({...edge.geometry,start:edge.start,end:edge.end,sources:Object.freeze(uses.map(use=>use.source)),uses});
    })),
  });
}
