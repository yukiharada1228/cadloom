import {assertOwnedNurbsPlaneCapBoundary3,nurbsPlaneCapBoundaryPoint3} from './nurbs-plane-cap-boundary3.js';
import type {NurbsPlaneCapBoundaryCertificate3} from './nurbs-plane-cap-boundary3.js';
import {partitionSewnNurbsSplitEdgeByAlgebraicPlane3} from './sewn-nurbs-split-edge-plane3.js';
import {snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {Point2} from './point2.js';
import {point3,dot3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
export type NurbsPlaneCapWinding3=
 | Readonly<{kind:'boundary';source:NurbsPlaneCapBoundaryCertificate3;point:AlgebraicCoordinates2;loop:number;edge:number}>
 | Readonly<{kind:'located';source:NurbsPlaneCapBoundaryCertificate3;point:AlgebraicCoordinates2;windings:readonly number[];slope:Rational;attempts:number}>
 | Readonly<{kind:'unresolved';source:NurbsPlaneCapBoundaryCertificate3;point:AlgebraicCoordinates2;reason:'direction-budget';attempts:number}>;
/** Exact per-loop winding at a real-algebraic cap-chart point. This is a curve query,
 * not a material/embedding certificate or a choice of polygonal fill. */
export function queryNurbsPlaneCapWinding3(source:NurbsPlaneCapBoundaryCertificate3,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):NurbsPlaneCapWinding3 {
 assertOwnedNurbsPlaneCapBoundary3(source);const point=snapshotExactPoint2(input),budget=options.maxDirections??16;
 if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const boundary=(loop:number,edge:number):NurbsPlaneCapWinding3=>Object.freeze({kind:'boundary',source,point,loop,edge});
 const x=point.x,y=point.y,T=source.source.topology;
 const at=(edge:number,t:AlgebraicReal)=>nurbsPlaneCapBoundaryPoint3(source,edge,t);
 // Catch query vertices independently of the retry direction.
 for(const [loop,uses] of source.loops.entries())for(const u of uses){const e=T.edges[u.edge]!.curve,q=at(u.edge,e.lower);if(q.x.compare(x)===0&&q.y.compare(y)===0)return boundary(loop,u.edge);}
 const {u,v,origin}=source.frame,uu=dot3(u,u),vv=dot3(v,v);
 if(dot3(u,v).sign()!==0)throw new Error('Cap winding requires its factory orthogonal chart');
 for(let attempt=0;attempt<budget;attempt++){
  // 0, +1, -1, +2, -2, ...; finitely many vertex slopes are excluded.
  const k=new Rational(attempt===0?0n:BigInt(Math.ceil(attempt/2))*(attempt%2===1?1n:-1n));
  const n=point3(...(['x','y','z'] as const).map(key=>v[key].div(vv).sub(u[key].mul(k).div(uu))) as Parameters<typeof point3>);
  const offset=AlgebraicReal.linearCombination([{value:point.y,coefficient:-1n},{value:point.x,coefficient:k}],dot3(n,origin).neg()),plane={normal:n,offset},windings:number[]=[];let retry=false;
  for(const [loop,uses] of source.loops.entries()){
   let winding=0;
   for(const use of uses){
    const report=partitionSewnNurbsSplitEdgeByAlgebraicPlane3(T.edges[use.edge]!.curve,plane);
    for(const vertex of report.vertices)if(vertex.sign===0){const q=at(use.edge,vertex.parameter);if(q.x.compare(x)===0)return boundary(loop,use.edge);}
    for(const interval of report.intervals)if(interval.sign===0){const a=at(use.edge,interval.lower),b=at(use.edge,interval.upper);if(a.x.compare(x)*b.x.compare(x)<=0)return boundary(loop,use.edge);retry=true;}
    if(report.vertices[0]!.sign===0||report.vertices[report.vertices.length-1]!.sign===0){retry=true;continue;}
    for(let i=1;i+1<report.vertices.length;i++)if(report.vertices[i]!.sign===0){const before=report.intervals[i-1]!.sign,after=report.intervals[i]!.sign;if(before===0||after===0){retry=true;continue;}if(before!==after&&at(use.edge,report.vertices[i]!.parameter).x.compare(x)>0)winding+=after*use.direction;}
   }
   windings.push(winding);
  }
  if(!retry)return Object.freeze({kind:'located',source,point,windings:Object.freeze(windings),slope:k,attempts:attempt+1});
 }
 return Object.freeze({kind:'unresolved',source,point,reason:'direction-budget',attempts:budget});
}
