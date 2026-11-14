import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {point2} from './point2.js';
import type {Point2} from './point2.js';
import {algebraicCoordinates2,getPointParameterization2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {Circle2} from './circle2.js';
import {splitCurves2} from './split-curves2.js';
import type {PlanarCurve2,CurveArrangement2,CurveEdge2} from './split-curves2.js';

export interface CurveGerm2 {
  /** Nonunit outgoing tangent, represented exactly. */
  readonly tangent:AlgebraicCoordinates2;
  /** Signed curvature is zero, or curvatureSign / sqrt(radiusSquared). */
  readonly curvatureSign:Sign;
  readonly radiusSquared:Rational|null;
}
export interface CurveHalfEdge2 {
  readonly origin:number;readonly target:number;readonly edge:number;
  readonly twin:number;readonly next:number;readonly previous:number;readonly boundary:number;
  readonly germ:CurveGerm2;
}
export interface CurveBoundaryWalk2 {readonly halfEdges:readonly number[];}
export interface CurveHalfEdgeArrangement2 extends CurveArrangement2 {
  readonly halfEdges:readonly CurveHalfEdge2[];
  /** CCW cyclic germ order: limiting tangent direction, then signed curvature. */
  readonly outgoing:readonly (readonly number[])[];
  /** Edge-bearing left-side boundary walks, not grouped faces. No chord-area surrogate. */
  readonly boundaries:readonly CurveBoundaryWalk2[];
}
type Germ=(
 | {kind:'line';vector:Point2}
 | {kind:'arc';circle:Circle2;side:1|-1}
)&{data:CurveGerm2;half:0|1};
function linearSign(point:AlgebraicCoordinates2,a:Rational,b:Rational,c:Rational):Sign {
  const data=getPointParameterization2(point);
  if(data)return data.parameter.signOf(new Polynomial([
    a.mul(data.origin.x).add(b.mul(data.origin.y)).add(c),
    a.mul(data.direction.x).add(b.mul(data.direction.y)),
  ]));
  return point.x.affine(a,c).add(point.y.affine(b)).sign();
}
function makeGerm(edge:CurveEdge2,point:AlgebraicCoordinates2,forward:1|-1):Germ {
  let data:CurveGerm2,descriptor:{kind:'line';vector:Point2}|{kind:'arc';circle:Circle2;side:1|-1};
  if(edge.kind==='line'){
    const d=edge.interval.line.direction,vector=forward===1?d:point2(d.x.neg(),d.y.neg());
    data=Object.freeze({tangent:algebraicCoordinates2(vector.x,vector.y),curvatureSign:0,radiusSquared:null});
    descriptor={kind:'line',vector};
  }else {
    const side=(edge.arc.direction==='ccw'?forward:-forward) as 1|-1,c=edge.arc.circle;
    data=Object.freeze({tangent:algebraicCoordinates2(point.y.affine(BigInt(-side),c.center.y.mul(new Rational(BigInt(side)))),point.x.affine(BigInt(side),c.center.x.mul(new Rational(BigInt(-side))))),curvatureSign:side,radiusSquared:c.radiusSquared});
    descriptor={kind:'arc',circle:c,side};
  }
  const x=data.tangent.x.sign(),y=data.tangent.y.sign();
  if(x===0&&y===0)throw new Error('A curve half-edge has a zero tangent');
  return {...descriptor,data,half:y<0||y===0&&x<0?1:0};
}
/** Cross signs are linear in the shared origin: cancel quadratic terms before
 * algebraic evaluation, rather than multiplying independently represented roots.
 */
function crossSign(a:Germ,b:Germ,point:AlgebraicCoordinates2):number {
  if(a.kind==='line'&&b.kind==='line')return a.vector.x.mul(b.vector.y).sub(a.vector.y.mul(b.vector.x)).sign();
  if(a.kind==='arc'&&b.kind==='line')return -crossSign(b,a,point);
  if(a.kind==='line'&&b.kind==='arc'){
    const v=a.vector,c=b.circle.center;
    return b.side*linearSign(point,v.x,v.y,v.x.mul(c.x).add(v.y.mul(c.y)).neg());
  }
  const aa=a as Extract<Germ,{kind:'arc'}>,bb=b as Extract<Germ,{kind:'arc'}>,c=aa.circle.center,d=bb.circle.center;
  return aa.side*bb.side*linearSign(point,c.y.sub(d.y),d.x.sub(c.x),c.x.mul(d.y).sub(c.y.mul(d.x)));
}
/** Builds exact curve-germ rotation, twins and left-side boundary walks. Tangencies
 * are ordered by signed curvature; equal germs after noding are invariant errors.
 */
export function buildCurveHalfEdges2(input:readonly PlanarCurve2[]):CurveHalfEdgeArrangement2 {
  const arrangement=splitCurves2(input),outgoing:number[][]=arrangement.vertices.map(()=>[]);
  const halfEdges:{origin:number;target:number;edge:number;twin:number;next:number;previous:number;boundary:number;germ:CurveGerm2}[]=[],germs:Germ[]=[];
  arrangement.edges.forEach((edge,index)=>{
    const first=halfEdges.length;
    for(const [origin,target,twin,forward] of [[edge.start,edge.end,first+1,1],[edge.end,edge.start,first,-1]] as const){
      const germ=makeGerm(edge,arrangement.vertices[origin]!.point,forward);
      outgoing[origin]!.push(halfEdges.length);germs.push(germ);
      halfEdges.push({origin,target,edge:index,twin,next:-1,previous:-1,boundary:-1,germ:germ.data});
    }
  });
  const positions:number[]=[];
  outgoing.forEach((ids,vertex)=>{
    ids.sort((left,right)=>{
      if(left===right)return 0;
      const a=germs[left]!,b=germs[right]!;
      if(a.half!==b.half)return a.half-b.half;
      const cross=crossSign(a,b,arrangement.vertices[vertex]!.point);
      if(cross!==0)return -cross;
      const ka=a.data.curvatureSign,kb=b.data.curvatureSign;
      if(ka!==kb)return ka-kb;
      if(a.kind==='arc'&&b.kind==='arc'){
        const comparison=a.circle.radiusSquared.compare(b.circle.radiusSquared);
        if(comparison!==0)return -ka*comparison;
      }
      throw new Error('Unmerged coincident curve germs at a vertex');
    });
    ids.forEach((id,position)=>{positions[id]=position;});
  });
  halfEdges.forEach((h,id)=>{
    const around=outgoing[h.target]!;
    h.next=around[(positions[h.twin]!+around.length-1)%around.length]!;
    if(halfEdges[h.next]!.previous!==-1)throw new Error('Curve successor is not a permutation');
    halfEdges[h.next]!.previous=id;
  });
  const boundaries:CurveBoundaryWalk2[]=[];
  halfEdges.forEach((start,id)=>{
    if(start.boundary!==-1)return;
    const ids:number[]=[];
    let current=id;
    do {
      const h=halfEdges[current]!;
      if(h.boundary!==-1)throw new Error('Curve boundary walk joined a different orbit');
      h.boundary=boundaries.length;ids.push(current);current=h.next;
    }while(current!==id);
    boundaries.push(Object.freeze({halfEdges:Object.freeze(ids)}));
  });
  return Object.freeze({...arrangement,halfEdges:Object.freeze(halfEdges.map(h=>Object.freeze(h))),outgoing:Object.freeze(outgoing.map(ids=>Object.freeze(ids))),boundaries:Object.freeze(boundaries)});
}
