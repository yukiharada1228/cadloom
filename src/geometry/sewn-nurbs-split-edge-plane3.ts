import {assertOwnedSewnNurbsPlaneSplitEdge3,sewnNurbsPlaneSplitEdgePoint3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitEdge3} from './sew-nurbs-plane-split-faces3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Polynomial} from '../numeric/polynomial.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import type {ExactInput} from './point2.js';
import type {Vector3} from './point3.js';
import {Rational} from '../numeric/rational.js';
import {bivariateFiberRoots} from '../numeric/bivariate-system.js';
import {prepareAlgebraicCurvePolynomialCuts2} from './algebraic-curve-inequalities2.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
export interface AlgebraicOffsetPlane3 {readonly normal:Vector3;readonly offset:AlgebraicReal;}
export interface SewnNurbsSplitEdgePlane3<P=Plane3> {
 readonly source:SewnNurbsPlaneSplitEdge3;readonly plane:P;
 /** Endpoints and all isolated plane zeros, in increasing native parameter. */
 readonly vertices:readonly Readonly<{parameter:AlgebraicReal;point:AlgebraicCoordinates3;sign:-1|0|1}>[];
 /** Constant sign on each open interval. Zero denotes a whole plane overlap. */
 readonly intervals:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal;sign:-1|0|1;sampleParameter:Rational}>[];
}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Complete plane event partition on a finite owned split edge, including
 * implicit graph branches and algebraic constant-coordinate paths. */
export function partitionSewnNurbsSplitEdgeByPlane3(source:SewnNurbsPlaneSplitEdge3,input:Plane3):SewnNurbsSplitEdgePlane3 {
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),report=partitionSewnNurbsSplitEdgeByAlgebraicPlane3(source,plane);
 return Object.freeze({...report,plane});
}
/** Homogenize the defining polynomial of offset at -N/W. All conjugate
 * levels are candidate events; full selected-root equality filters them. */
function levelPolynomial<T extends {scale(c:Rational):T;mul(p:T):T;add(p:T):T}>(N:T,W:T,one:T,offset:AlgebraicReal):T {
 if(offset.rational!==null)return N.add(W.scale(offset.rational));
 const P=offset.polynomial;let result=one.scale(P.coefficient(P.degree)),power=one;const negative=N.scale(new Rational(-1n));
 for(let i=P.degree-1;i>=0;i--){power=power.mul(W);result=result.mul(negative).add(power.scale(P.coefficient(i)));}
 return result;
}
/** Rational normal, independently represented real-algebraic offset. */
export function partitionSewnNurbsSplitEdgeByAlgebraicPlane3(source:SewnNurbsPlaneSplitEdge3,input:Readonly<{normal:Vector3;offset:AlgebraicReal|ExactInput}>):SewnNurbsSplitEdgePlane3<AlgebraicOffsetPlane3> {
 assertOwnedSewnNurbsPlaneSplitEdge3(source);const n=plane3(input.normal.x,input.normal.y,input.normal.z,0n).normal,offset=(input.offset instanceof AlgebraicReal?input.offset:AlgebraicReal.fromRational(input.offset)).recognizeRational(),plane=Object.freeze({normal:n,offset});
 const sign=(p:AlgebraicCoordinates3)=>AlgebraicReal.linearCombination([{value:p.x,coefficient:n.x},{value:p.y,coefficient:n.y},{value:p.z,coefficient:n.z},{value:offset,coefficient:1n}]).sign();
 const cuts:AlgebraicReal[]=[source.lower,source.upper],add=(t:AlgebraicReal)=>{if(t.compare(source.lower)>0&&t.compare(source.upper)<0&&!cuts.some(x=>x.compare(t)===0)&&sign(sewnNurbsPlaneSplitEdgePoint3(source,t))===0)cuts.push(t);};
 if(source.kind==='source'){
  const span=source.source.topology.edges[source.edge]!.curve.source.map.span,F=levelPolynomial(span.x.scale(n.x).add(span.y.scale(n.y)).add(span.z.scale(n.z)),span.weight,new Polynomial([1n]),offset);
  if(F.degree>0)AlgebraicReal.isolate(F).forEach(t=>add(t.recognizeRational()));
 }else {
  const local=source.source.topology.edges[source.edge]!.curve,N=local.source,edge=N.edges[local.edge]!,cells=N.source.vertices.cells,E=cells.edges[edge.parent]!,boundary=cells.boundaries[E.boundary]!,path=boundary.edges[E.edge]!.path,cell=cells.source.cells[E.boundary]!,patch=cells.source.complex.source.source.patches[cell.patch]!;
  const F=levelPolynomial(patch.x.scale(n.x).add(patch.y.scale(n.y)).add(patch.z.scale(n.z)),patch.weight,new BivariatePolynomial([[1n]]),offset);
  if(path.kind==='curve')prepareAlgebraicCurvePolynomialCuts2(cell.graph,[F])(path.edge,source.lower,source.upper).forEach(add);
  else {const roots=path.kind==='u'?bivariateFiberRoots(F,path.u):bivariateFiberRoots(F.transpose(),path.v);if(roots.kind==='finite')roots.roots.forEach(t=>add(t.recognizeRational()));}
 }
 cuts.sort((a,b)=>a.compare(b));
 const vertices=cuts.map(parameter=>{const point=sewnNurbsPlaneSplitEdgePoint3(source,parameter);return Object.freeze({parameter,point,sign:sign(point)});});
 const intervals=cuts.slice(0,-1).map((lower,i)=>{const upper=cuts[i+1]!,sampleParameter=between(lower,upper),s=sign(sewnNurbsPlaneSplitEdgePoint3(source,sampleParameter));if(s===0&&(vertices[i]!.sign!==0||vertices[i+1]!.sign!==0))throw new Error('Plane-overlap interval lost its closed endpoints');return Object.freeze({lower,upper,sign:s,sampleParameter});});
 return Object.freeze({source,plane,vertices:Object.freeze(vertices),intervals:Object.freeze(intervals)});
}
