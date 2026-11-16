import {assertOwnedSewnNurbsPlaneSplitEdge3,sewnNurbsPlaneSplitEdgePoint3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitEdge3} from './sew-nurbs-plane-split-faces3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import {bivariateFiberRoots} from '../numeric/bivariate-system.js';
import {prepareAlgebraicCurvePolynomialCuts2} from './algebraic-curve-inequalities2.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
export interface SewnNurbsSplitEdgePlane3 {
 readonly source:SewnNurbsPlaneSplitEdge3;readonly plane:Plane3;
 /** Endpoints and all isolated plane zeros, in increasing native parameter. */
 readonly vertices:readonly Readonly<{parameter:AlgebraicReal;point:AlgebraicCoordinates3;sign:-1|0|1}>[];
 /** Constant sign on each open interval. Zero denotes a whole plane overlap. */
 readonly intervals:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal;sign:-1|0|1;sampleParameter:Rational}>[];
}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Complete plane event partition on a finite owned split edge, including
 * implicit graph branches and algebraic constant-coordinate paths. */
export function partitionSewnNurbsSplitEdgeByPlane3(source:SewnNurbsPlaneSplitEdge3,input:Plane3):SewnNurbsSplitEdgePlane3 {
 assertOwnedSewnNurbsPlaneSplitEdge3(source);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),{normal:n,offset}=plane;
 const cuts:AlgebraicReal[]=[source.lower,source.upper],add=(t:AlgebraicReal)=>{if(t.compare(source.lower)>0&&t.compare(source.upper)<0&&!cuts.some(x=>x.compare(t)===0))cuts.push(t);};
 if(source.kind==='source'){
  const span=source.source.topology.edges[source.edge]!.curve.source.map.span,F=span.x.scale(n.x).add(span.y.scale(n.y)).add(span.z.scale(n.z)).add(span.weight.scale(offset));
  if(F.degree>0)AlgebraicReal.isolate(F).forEach(t=>add(t.recognizeRational()));
 }else {
  const local=source.source.topology.edges[source.edge]!.curve,N=local.source,edge=N.edges[local.edge]!,cells=N.source.vertices.cells,E=cells.edges[edge.parent]!,boundary=cells.boundaries[E.boundary]!,path=boundary.edges[E.edge]!.path,cell=cells.source.cells[E.boundary]!,patch=cells.source.complex.source.source.patches[cell.patch]!;
  const F=patch.x.scale(n.x).add(patch.y.scale(n.y)).add(patch.z.scale(n.z)).add(patch.weight.scale(offset));
  if(path.kind==='curve')prepareAlgebraicCurvePolynomialCuts2(cell.graph,[F])(path.edge,source.lower,source.upper).forEach(add);
  else {const roots=path.kind==='u'?bivariateFiberRoots(F,path.u):bivariateFiberRoots(F.transpose(),path.v);if(roots.kind==='finite')roots.roots.forEach(t=>add(t.recognizeRational()));}
 }
 cuts.sort((a,b)=>a.compare(b));
 const sign=(p:AlgebraicCoordinates3)=>AlgebraicReal.linearCombination([{value:p.x,coefficient:n.x},{value:p.y,coefficient:n.y},{value:p.z,coefficient:n.z}],offset).sign();
 const vertices=cuts.map(parameter=>{const point=sewnNurbsPlaneSplitEdgePoint3(source,parameter);return Object.freeze({parameter,point,sign:sign(point)});});
 const intervals=cuts.slice(0,-1).map((lower,i)=>{const upper=cuts[i+1]!,sampleParameter=between(lower,upper),s=sign(sewnNurbsPlaneSplitEdgePoint3(source,sampleParameter));if(s===0&&(vertices[i]!.sign!==0||vertices[i+1]!.sign!==0))throw new Error('Plane-overlap interval lost its closed endpoints');return Object.freeze({lower,upper,sign:s,sampleParameter});});
 return Object.freeze({source,plane,vertices:Object.freeze(vertices),intervals:Object.freeze(intervals)});
}
