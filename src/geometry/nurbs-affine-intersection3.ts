import {AlgebraicReal} from '../numeric/real-roots.js';
import {solveBivariateEquations} from '../numeric/bivariate-system.js';
import type {ExactInput} from './point2.js';
import type {NurbsSurface3} from './nurbs-surface3.js';
import type {NurbsAffineProjectionCertificate3} from './nurbs-affine-projection3.js';
import {nurbsAffineIntersectionEquations3,assertOwnedNurbsAffineIntersectionEquations3,nurbsAffineIntersectionContains3,nurbsAffineIntersectionPoint3} from './nurbs-affine-intersection-equations3.js';
import type {NurbsAffineIntersectionEquations3,NurbsAffineIntersectionPoint3} from './nurbs-affine-intersection-equations3.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';
import {restrictAlgebraicCurveInequalities2,witnessBivariateInequalities2} from './algebraic-curve-inequalities2.js';
export interface NurbsAffineIntersectionEdge3 {readonly graph:AlgebraicCurveTopology2;readonly sourceEdge:number;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;readonly from:number;readonly to:number;}
export interface NurbsAffineIntersectionPatch3 {
 readonly pair:number;readonly vertices:readonly NurbsAffineIntersectionPoint3[];readonly edges:readonly NurbsAffineIntersectionEdge3[];
 /** A nonempty implicit closed set. May be disconnected or lower-dimensional;
  * its witness does not assert positive area or a boundary enumeration. */
 readonly region:Readonly<{witness:NurbsAffineIntersectionPoint3;contains(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):boolean}>|null;
}
export interface NurbsAffineIntersection3 {readonly equations:NurbsAffineIntersectionEquations3;readonly patches:readonly NurbsAffineIntersectionPatch3[];readonly empty:boolean;}
const owned=new WeakSet<NurbsAffineIntersection3>();
/** Complete closed one-sided patch intersection for a general source and an
 * affine-invertible target. Curves/isolated points are explicit graphs; wholly
 * coincident patches retain nonempty implicit inequality regions. */
export function solveNurbsAffineIntersectionEquations3(equations:NurbsAffineIntersectionEquations3):NurbsAffineIntersection3 {
 assertOwnedNurbsAffineIntersectionEquations3(equations);const patches:NurbsAffineIntersectionPatch3[]=[];
 equations.pairs.forEach((p,pair)=>{
  const source=p.sourcePatch,target=p.targetPatch,bounds={uMin:source.startU,uMax:source.endU,vMin:source.startV,vMax:source.endV},W=source.weight,A=p.uNumerator,B=p.vNumerator,constraints=[A.sub(W.scale(target.startU)),W.scale(target.endU).sub(A),B.sub(W.scale(target.startV)),W.scale(target.endV).sub(B)],solutions=solveBivariateEquations(p.equations),vertices:NurbsAffineIntersectionPoint3[]=[],edges:NurbsAffineIntersectionEdge3[]=[];
  const add=(u:AlgebraicReal,v:AlgebraicReal)=>{let id=vertices.findIndex(q=>q.u.compare(u)===0&&q.v.compare(v)===0);if(id<0){id=vertices.length;vertices.push(nurbsAffineIntersectionPoint3(equations,pair,u,v));}return id;};
  for(const q of solutions.points)if(nurbsAffineIntersectionContains3(equations,pair,q.u,q.v))add(q.u,q.v);
  let region:NurbsAffineIntersectionPatch3['region']=null;
  if(solutions.kind==='all'){
   const witness=witnessBivariateInequalities2(constraints,bounds);if(witness)region=Object.freeze({witness:nurbsAffineIntersectionPoint3(equations,pair,witness.u,witness.v),contains:(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput)=>nurbsAffineIntersectionContains3(equations,pair,u,v)});
  }else if(solutions.kind==='shared'){
   const graph=traceAlgebraicCurve2(solutions.commonFactor,bounds),clipped=restrictAlgebraicCurveInequalities2(graph,constraints),ids=clipped.vertices.map(q=>add(q.u,q.v));
   for(const e of clipped.edges)edges.push(Object.freeze({graph,sourceEdge:e.sourceEdge,lower:e.lower,upper:e.upper,from:ids[e.from]!,to:ids[e.to]!}));
  }
  if(vertices.length||edges.length||region)patches.push(Object.freeze({pair,vertices:Object.freeze(vertices),edges:Object.freeze(edges),region}));
 });
 const report=Object.freeze({equations,patches:Object.freeze(patches),empty:patches.length===0});owned.add(report);return report;
}
export function intersectNurbsSurfaceAffineTarget3(source:NurbsSurface3,target:NurbsAffineProjectionCertificate3):NurbsAffineIntersection3 {return solveNurbsAffineIntersectionEquations3(nurbsAffineIntersectionEquations3(source,target));}
export function assertOwnedNurbsAffineIntersection3(report:NurbsAffineIntersection3):void {if(!owned.has(report))throw new RangeError('Operation requires a factory-created NURBS affine intersection');}
function patchAt(report:NurbsAffineIntersection3,patch:number):NurbsAffineIntersectionPatch3 {
 assertOwnedNurbsAffineIntersection3(report);if(!Number.isSafeInteger(patch)||patch<0||patch>=report.patches.length)throw new RangeError('Invalid intersection patch index');return report.patches[patch]!;
}
/** u on a normal graph branch, v on a vertical branch; closed retained range. */
export function nurbsAffineIntersectionEdgePoint3(report:NurbsAffineIntersection3,patch:number,edge:number,parameter:AlgebraicReal|ExactInput):NurbsAffineIntersectionPoint3 {
 const p=patchAt(report,patch);if(!Number.isSafeInteger(edge)||edge<0||edge>=p.edges.length)throw new RangeError('Invalid intersection edge index');const e=p.edges[edge]!,t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the retained intersection edge');const uv=evaluateAlgebraicCurveEdge2(e.graph,e.sourceEdge,t);return nurbsAffineIntersectionPoint3(report.equations,p.pair,uv.u,uv.v);
}
export function nurbsAffineIntersectionRegionPoint3(report:NurbsAffineIntersection3,patch:number,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsAffineIntersectionPoint3 {
 const p=patchAt(report,patch);if(!p.region)throw new RangeError('Intersection patch has no implicit region');return nurbsAffineIntersectionPoint3(report.equations,p.pair,u,v);
}
