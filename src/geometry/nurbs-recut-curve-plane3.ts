import {nurbsRecutJoinedCurvePoint3} from './nurbs-recut-face-join3.js';
import type {NurbsRecutJoinedCurve3} from './nurbs-recut-face-join3.js';
import {partitionSewnNurbsSplitEdgeByAlgebraicPlane3,nurbsSplitFaceEdgePlaneParameters3} from './sewn-nurbs-split-edge-plane3.js';
import type {AlgebraicOffsetPlane3,SewnNurbsSplitEdgePlane3} from './sewn-nurbs-split-edge-plane3.js';
import {plane3} from './plane3.js';
import {dot3} from './point3.js';
import type {Vector3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import type {ExactInput} from './point2.js';
export type NurbsRecutCurvePlane3=Readonly<Omit<SewnNurbsSplitEdgePlane3<AlgebraicOffsetPlane3>,'source'>&{source:NurbsRecutJoinedCurve3}>;
export function partitionNurbsRecutCurveByAlgebraicPlane3(source:NurbsRecutJoinedCurve3,input:Readonly<{normal:Vector3;offset:AlgebraicReal|ExactInput}>):NurbsRecutCurvePlane3 {
 // Evaluation also checks curve ownership before trusting its native limits.
 nurbsRecutJoinedCurvePoint3(source,source.lower);const n=plane3(input.normal.x,input.normal.y,input.normal.z,0n).normal,offset=(input.offset instanceof AlgebraicReal?input.offset:AlgebraicReal.fromRational(input.offset)).recognizeRational(),plane:AlgebraicOffsetPlane3=Object.freeze({normal:n,offset});
 const point=(t:AlgebraicReal)=>nurbsRecutJoinedCurvePoint3(source,t),sign=(t:AlgebraicReal)=>{const p=point(t);return AlgebraicReal.linearCombination([...(['x','y','z'] as const).map(k=>({value:p[k],coefficient:n[k]})),{value:offset,coefficient:1n}]).sign();},cuts=[source.lower,source.upper],add=(t:AlgebraicReal)=>{if(t.compare(source.lower)>0&&t.compare(source.upper)<0&&!cuts.some(q=>q.compare(t)===0)&&sign(t)===0)cuts.push(t);};
 if(source.kind==='source')nurbsSplitFaceEdgePlaneParameters3(source.source,source.edge,n,offset,source.lower,source.upper).forEach(add);
 else if(source.kind==='shared'||source.kind==='sewn-source'){
  const old=source.kind==='shared'?source.source.chains[source.chain]!.curve:source.source.topology.edges[source.edge]!.curve;
  partitionSewnNurbsSplitEdgeByAlgebraicPlane3(old,plane).vertices.forEach(v=>add(v.parameter));
 }else {
  const c=source.source.topology.edges[source.edge]!.curve;
  if(c.kind==='boundary')partitionSewnNurbsSplitEdgeByAlgebraicPlane3(c.source,plane).vertices.forEach(v=>add(v.parameter));
  else {const denominator=dot3(n,c.line.direction);if(denominator.sign()!==0)add(offset.affine(-1n,dot3(n,c.line.origin).neg()).affine(new Rational(1n).div(denominator)));}
 }
 cuts.sort((a,b)=>a.compare(b));const vertices=cuts.map(parameter=>Object.freeze({parameter,point:point(parameter),sign:sign(parameter)})),intervals=cuts.slice(0,-1).map((lower,i)=>{const upper=cuts[i+1]!;let a=lower,b=upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}const sampleParameter=a.upper.add(b.lower).div(new Rational(2n)),s=sign(AlgebraicReal.fromRational(sampleParameter));if(s===0&&(vertices[i]!.sign!==0||vertices[i+1]!.sign!==0))throw new Error('Recut plane overlap lost closed endpoints');return Object.freeze({lower,upper,sign:s,sampleParameter});});
 return Object.freeze({source,plane,vertices:Object.freeze(vertices),intervals:Object.freeze(intervals)});
}
