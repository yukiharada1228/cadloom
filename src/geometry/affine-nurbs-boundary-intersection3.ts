import {AlgebraicReal} from '../numeric/real-roots.js';
import {solveBivariateEquations} from '../numeric/bivariate-system.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedAffineNurbsFace3} from './affine-nurbs-face3.js';
import type {AffineNurbsFace3} from './affine-nurbs-face3.js';
import {nurbsCurveSpans3} from './nurbs-curve3.js';
import {nurbsSpanPairEquations3} from './nurbs-curve-intersection3.js';
import {evaluateNurbsSurfaceBoundaryPiece3} from './nurbs-surface-boundary3.js';
import type {NurbsSurfaceBoundary3} from './nurbs-surface-boundary3.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {restrictAlgebraicCurveRectangle2} from './algebraic-curve-rectangle2.js';
import type {RestrictedAlgebraicCurve2} from './algebraic-curve-rectangle2.js';
export interface AffineNurbsBoundaryRef3 {readonly ring:number;readonly curve:number;readonly piece:number;}
export interface AffineNurbsBoundaryPairPoint3 {readonly first:AffineNurbsBoundaryRef3;readonly second:AffineNurbsBoundaryRef3;readonly firstParameter:AlgebraicReal;readonly secondParameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;}
export interface AffineNurbsBoundaryRelation3 {readonly first:AffineNurbsBoundaryRef3;readonly second:AffineNurbsBoundaryRef3;readonly locus:RestrictedAlgebraicCurve2;}
export interface AffineNurbsBoundaryIntersection3 {
 readonly first:AffineNurbsFace3;readonly second:AffineNurbsFace3;
 /** All finite solutions and all retained relation vertices. These include
  * overlap events, not only spatially isolated intersections. */
 readonly points:readonly AffineNurbsBoundaryPairPoint3[];
 readonly relations:readonly AffineNurbsBoundaryRelation3[];
}
const owned=new WeakSet<AffineNurbsBoundaryIntersection3>();
function pieces(face:AffineNurbsFace3){return face.boundaries.flatMap((r,ring)=>r.flatMap((boundary,curve)=>boundary.pieces.map((piece,index)=>({ref:Object.freeze({ring,curve,piece:index}),boundary,piece,span:nurbsCurveSpans3(boundary.parameterCurve).find(s=>s.index===piece.curveSpan)!}))));}
function boundary(face:AffineNurbsFace3,ref:AffineNurbsBoundaryRef3):NurbsSurfaceBoundary3{return face.boundaries[ref.ring]![ref.curve]!;}
/** Exact intersections of all closed lifted boundary pieces, including
 * nonlinear parameter relations. This is not surface-interior SSI. */
export function intersectAffineNurbsFaceBoundaries3(first:AffineNurbsFace3,second:AffineNurbsFace3):AffineNurbsBoundaryIntersection3 {
 assertOwnedAffineNurbsFace3(first);assertOwnedAffineNurbsFace3(second);const points:AffineNurbsBoundaryPairPoint3[]=[],relations:AffineNurbsBoundaryRelation3[]=[],firstPieces=pieces(first),secondPieces=pieces(second);
 for(const a of firstPieces)for(const b of secondPieces){
  const p=a.piece,q=b.piece,result=solveBivariateEquations(nurbsSpanPairEquations3({...p,index:0,startParameter:a.span.startParameter,endParameter:a.span.endParameter},{...q,index:0,startParameter:b.span.startParameter,endParameter:b.span.endParameter}));
  const add=(u:AlgebraicReal,v:AlgebraicReal)=>{
   if(u.compare(p.startParameter)<0||u.compare(p.endParameter)>0||v.compare(q.startParameter)<0||v.compare(q.endParameter)>0)return;
   const point=evaluateNurbsSurfaceBoundaryPiece3(a.boundary,a.ref.piece,u),other=evaluateNurbsSurfaceBoundaryPiece3(b.boundary,b.ref.piece,v);if(compareAlgebraicPoints3(point,other)!==0)throw new Error('Boundary intersection failed exact forward equality');
   if(!points.some(t=>t.first===a.ref&&t.second===b.ref&&t.firstParameter.compare(u)===0&&t.secondParameter.compare(v)===0))points.push(Object.freeze({first:a.ref,second:b.ref,firstParameter:u,secondParameter:v,point}));
  };
  result.points.forEach(r=>add(r.u,r.v));
  if(result.kind!=='finite'){
   const graph=traceAlgebraicCurve2(result.commonFactor,{uMin:a.span.startParameter,uMax:a.span.endParameter,vMin:b.span.startParameter,vMax:b.span.endParameter});
   const locus=restrictAlgebraicCurveRectangle2(graph,{uMin:p.startParameter,uMax:p.endParameter,vMin:q.startParameter,vMax:q.endParameter});
   if(locus.vertices.length){relations.push(Object.freeze({first:a.ref,second:b.ref,locus}));locus.vertices.forEach(r=>add(r.u,r.v));}
  }
 }
 const report=Object.freeze({first,second,points:Object.freeze(points),relations:Object.freeze(relations)});owned.add(report);return report;
}
export function affineNurbsBoundaryRelationPoint3(report:AffineNurbsBoundaryIntersection3,relation:number,edge:number,parameter:AlgebraicReal|ExactInput):AffineNurbsBoundaryPairPoint3 {
 if(!owned.has(report))throw new RangeError('Operation requires a factory-created boundary intersection');if(!Number.isSafeInteger(relation)||relation<0||relation>=report.relations.length)throw new RangeError('Invalid boundary relation');const r=report.relations[relation]!;
 if(!Number.isSafeInteger(edge)||edge<0||edge>=r.locus.edges.length)throw new RangeError('Invalid boundary relation edge');const e=r.locus.edges[edge]!,t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the restricted relation');
 const uv=evaluateAlgebraicCurveEdge2(r.locus.graph,e.sourceEdge,t),point=evaluateNurbsSurfaceBoundaryPiece3(boundary(report.first,r.first),r.first.piece,uv.u),other=evaluateNurbsSurfaceBoundaryPiece3(boundary(report.second,r.second),r.second.piece,uv.v);if(compareAlgebraicPoints3(point,other)!==0)throw new Error('Boundary relation lost exact equality');return Object.freeze({first:r.first,second:r.second,firstParameter:uv.u,secondParameter:uv.v,point});
}
